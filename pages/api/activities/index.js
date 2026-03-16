import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import ActivityLog from '@/models/ActivityLog';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const querySchema = z
  .object({
    representative: objectIdSchema.optional()
  })
  .strict();
const createSchema = z
  .object({
    representative: objectIdSchema,
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    activityType: z.enum(['event', 'project', 'meeting', 'field_visit', 'other']).optional(),
    location: z.string().trim().max(300).optional(),
    activityDate: z.string().datetime(),
    visibility: z.enum(['public', 'internal']).optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const parsedQuery = querySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query' });
    }

    try {
      const query = {};
      if (parsedQuery.data.representative) {
        query.representative = parsedQuery.data.representative;
      }

      const activities = await ActivityLog.find(query)
        .populate('representative')
        .sort({ activityDate: -1 })
        .limit(100);

      return res.status(200).json({ activities });
    } catch (error) {
      logger.error('activities_get_failed', { error: error.message, path: req.url });
      return res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  }

  if (req.method === 'POST') {
    const bodyAllowed = enforceMaxBodySize(req, res, 128 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin', 'agent']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'activities_create',
      windowMs: 60_000,
      max: 20,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = createSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    try {
      const activity = await ActivityLog.create(parsedBody.data);
      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'activity.created',
        targetType: 'ActivityLog',
        targetId: activity._id
      });
      return res.status(201).json({ activity });
    } catch (error) {
      logger.error('activities_create_failed', { error: error.message, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to create activity log' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

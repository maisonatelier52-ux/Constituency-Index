import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import ActivityLog from '@/models/ActivityLog';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const idQuerySchema = z.object({ id: objectIdSchema }).strict();
const updateSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    activityType: z.enum(['event', 'project', 'meeting', 'field_visit', 'other']).optional(),
    location: z.string().trim().max(300).optional(),
    activityDate: z.string().datetime().optional(),
    visibility: z.enum(['public', 'internal']).optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();
  const parsedQuery = idQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid id' });
  }
  const { id } = parsedQuery.data;

  if (req.method === 'GET') {
    try {
      const activity = await ActivityLog.findById(id).populate('representative');
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      return res.status(200).json({ activity });
    } catch (error) {
      logger.error('activity_get_failed', { error: error.message, id });
      return res.status(500).json({ error: 'Failed to fetch activity' });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 128 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin', 'agent']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'activity_update',
      windowMs: 60_000,
      max: 30,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = updateSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    try {
      const activity = await ActivityLog.findByIdAndUpdate(id, parsedBody.data, {
        new: true,
        runValidators: true
      });

      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'activity.updated',
        targetType: 'ActivityLog',
        targetId: id
      });
      return res.status(200).json({ activity });
    } catch (error) {
      logger.error('activity_update_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to update activity' });
    }
  }

  if (req.method === 'DELETE') {
    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    try {
      const activity = await ActivityLog.findByIdAndDelete(id);
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'activity.deleted',
        targetType: 'ActivityLog',
        targetId: id
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('activity_delete_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to delete activity' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

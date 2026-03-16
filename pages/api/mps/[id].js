import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Representative from '@/models/Representative';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { LOCAL_BODY_TYPES, OFFICE_LEVELS, STATUS_TYPES } from '@/lib/politicsScope';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const idQuerySchema = z.object({ id: objectIdSchema }).strict();
const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    type: z.enum(['MP', 'MLA']).optional(),
    officeLevel: z.enum(OFFICE_LEVELS).optional(),
    officeTitle: z.string().trim().max(200).optional(),
    jurisdictionType: z.string().trim().max(80).optional(),
    jurisdictionCode: z.string().trim().max(120).optional(),
    country: z.enum(['IN', 'US']).optional(),
    state: z.string().trim().max(120).optional(),
    district: z.string().trim().max(120).optional(),
    block: z.string().trim().max(120).optional(),
    ward: z.string().trim().max(120).optional(),
    localBodyType: z.enum(LOCAL_BODY_TYPES).optional(),
    localBodyName: z.string().trim().max(160).optional(),
    normalizedName: z.string().trim().max(240).optional(),
    transliteratedName: z.string().trim().max(240).optional(),
    party: z.string().trim().max(120).optional(),
    termStart: z.coerce.date().optional(),
    termEnd: z.coerce.date().optional(),
    sourceUrl: z.string().url().max(500).optional(),
    sourceLastUpdated: z.coerce.date().optional(),
    status: z.enum(STATUS_TYPES).optional(),
    constituency: objectIdSchema.optional().nullable(),
    attendanceRate: z.number().min(0).max(100).optional(),
    engagementLevel: z.enum(['low', 'moderate', 'high']).optional(),
    manifesto: z.array(z.string().trim().max(500)).optional(),
    achievements: z.array(z.string().trim().max(500)).optional(),
    ongoingProjects: z.array(z.string().trim().max(500)).optional()
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
      const representative = await Representative.findById(id).populate('constituency');
      if (!representative) {
        return res.status(404).json({ error: 'Representative not found' });
      }

      return res.status(200).json({ representative });
    } catch (error) {
      logger.error('representative_get_failed', { error: error.message, id });
      return res.status(500).json({ error: 'Failed to fetch representative' });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 256 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'representative_update',
      windowMs: 60_000,
      max: 20,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = updateSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    try {
      const representative = await Representative.findByIdAndUpdate(id, parsedBody.data, {
        new: true,
        runValidators: true
      });

      if (!representative) {
        return res.status(404).json({ error: 'Representative not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'representative.updated',
        targetType: 'Representative',
        targetId: id
      });
      return res.status(200).json({ representative });
    } catch (error) {
      logger.error('representative_update_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to update representative' });
    }
  }

  if (req.method === 'DELETE') {
    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    try {
      const representative = await Representative.findByIdAndDelete(id);

      if (!representative) {
        return res.status(404).json({ error: 'Representative not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'representative.deleted',
        targetType: 'Representative',
        targetId: id
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('representative_delete_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to delete representative' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

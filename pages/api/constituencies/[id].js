import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Constituency from '@/models/Constituency';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const idQuerySchema = z.object({ id: objectIdSchema }).strict();
const updateSchema = z
  .object({
    country: z.enum(['IN', 'US']).optional(),
    name: z.string().trim().min(2).max(200).optional(),
    code: z.string().trim().max(100).optional(),
    state: z.string().trim().max(120).optional(),
    constituencyType: z.enum(['parliamentary', 'assembly', 'congressional_district', 'senate_statewide']).optional(),
    profileType: z.enum(['urban', 'rural', 'universal']).optional(),
    representative: objectIdSchema.optional().nullable()
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
      const constituency = await Constituency.findById(id).populate('representative');

      if (!constituency) {
        return res.status(404).json({ error: 'Constituency not found' });
      }

      return res.status(200).json({ constituency });
    } catch (error) {
      logger.error('constituency_get_failed', { error: error.message, id });
      return res.status(500).json({ error: 'Failed to fetch constituency' });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 256 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'constituency_update',
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
      const constituency = await Constituency.findByIdAndUpdate(id, parsedBody.data, {
        new: true,
        runValidators: true
      });

      if (!constituency) {
        return res.status(404).json({ error: 'Constituency not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'constituency.updated',
        targetType: 'Constituency',
        targetId: id
      });
      return res.status(200).json({ constituency });
    } catch (error) {
      logger.error('constituency_update_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to update constituency' });
    }
  }

  if (req.method === 'DELETE') {
    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    try {
      const constituency = await Constituency.findByIdAndDelete(id);

      if (!constituency) {
        return res.status(404).json({ error: 'Constituency not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'constituency.deleted',
        targetType: 'Constituency',
        targetId: id
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('constituency_delete_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to delete constituency' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

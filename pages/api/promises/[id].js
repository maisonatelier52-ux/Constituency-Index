import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import PromiseModel from '@/models/Promise';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const idQuerySchema = z.object({ id: objectIdSchema }).strict();
const updateSchema = z
  .object({
    description: z.string().trim().min(3).max(3000).optional(),
    status: z.enum(['pending', 'fulfilled', 'broken']).optional(),
    representative: objectIdSchema.optional().nullable(),
    constituency: objectIdSchema.optional().nullable()
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
      const promise = await PromiseModel.findById(id).populate('representative').populate('constituency');

      if (!promise) {
        return res.status(404).json({ error: 'Promise not found' });
      }

      return res.status(200).json({ promise });
    } catch (error) {
      logger.error('promise_get_failed', { error: error.message, id });
      return res.status(500).json({ error: 'Failed to fetch promise' });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 128 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin', 'agent']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'promise_update',
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
      const promise = await PromiseModel.findByIdAndUpdate(id, parsedBody.data, {
        new: true,
        runValidators: true
      });

      if (!promise) {
        return res.status(404).json({ error: 'Promise not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'promise.updated',
        targetType: 'Promise',
        targetId: id
      });
      return res.status(200).json({ promise });
    } catch (error) {
      logger.error('promise_update_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to update promise' });
    }
  }

  if (req.method === 'DELETE') {
    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    try {
      const promise = await PromiseModel.findByIdAndDelete(id);
      if (!promise) {
        return res.status(404).json({ error: 'Promise not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'promise.deleted',
        targetType: 'Promise',
        targetId: id
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('promise_delete_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to delete promise' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

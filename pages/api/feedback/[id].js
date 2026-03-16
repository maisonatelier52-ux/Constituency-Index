import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Feedback from '@/models/Feedback';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const idQuerySchema = z.object({ id: objectIdSchema }).strict();
const updateSchema = z
  .object({
    content: z.string().trim().min(3).max(3000).optional(),
    rating: z.number().int().min(1).max(5).optional()
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
    const session = await requireAuth(req, res, ['admin', 'agent']);
    if (!session) return;

    try {
      const feedback = await Feedback.findById(id).populate('author').populate('representative').populate('issue');

      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      return res.status(200).json({ feedback });
    } catch (error) {
      logger.error('feedback_single_get_failed', { error: error.message, id });
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 128 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'feedback_update',
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
      const feedback = await Feedback.findByIdAndUpdate(id, parsedBody.data, {
        new: true,
        runValidators: true
      });

      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'feedback.updated',
        targetType: 'Feedback',
        targetId: id
      });
      return res.status(200).json({ feedback });
    } catch (error) {
      logger.error('feedback_update_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to update feedback' });
    }
  }

  if (req.method === 'DELETE') {
    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    try {
      const feedback = await Feedback.findByIdAndDelete(id);

      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'feedback.deleted',
        targetType: 'Feedback',
        targetId: id
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('feedback_delete_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to delete feedback' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

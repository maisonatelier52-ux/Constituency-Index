import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Feedback from '@/models/Feedback';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const createSchema = z
  .object({
    content: z.string().trim().min(3).max(3000),
    rating: z.number().int().min(1).max(5).optional(),
    representative: objectIdSchema.optional(),
    issue: objectIdSchema.optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const session = await requireAuth(req, res, ['admin', 'agent']);
    if (!session) return;

    try {
      const feedback = await Feedback.find({})
        .populate('author')
        .populate('representative')
        .populate('issue')
        .sort({ createdAt: -1 });

      return res.status(200).json({ feedback });
    } catch (error) {
      logger.error('feedback_get_failed', { error: error.message, path: req.url });
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  }

  if (req.method === 'POST') {
    const bodyAllowed = enforceMaxBodySize(req, res, 128 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['citizen', 'admin', 'agent']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'feedback_create',
      windowMs: 60_000,
      max: 20,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = createSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    try {
      const entry = await Feedback.create({
        ...parsedBody.data,
        author: session.user.id
      });
      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'feedback.created',
        targetType: 'Feedback',
        targetId: entry._id
      });
      return res.status(201).json({ feedback: entry });
    } catch (error) {
      logger.error('feedback_create_failed', { error: error.message, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to create feedback' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

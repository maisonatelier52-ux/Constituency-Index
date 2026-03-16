import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import PromiseModel from '@/models/Promise';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const createSchema = z
  .object({
    description: z.string().trim().min(3).max(3000),
    status: z.enum(['pending', 'fulfilled', 'broken']).optional(),
    representative: objectIdSchema.optional(),
    constituency: objectIdSchema.optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const promises = await PromiseModel.find({})
        .populate('representative')
        .populate('constituency')
        .sort({ createdAt: -1 });

      return res.status(200).json({ promises });
    } catch (error) {
      logger.error('promises_get_failed', { error: error.message, path: req.url });
      return res.status(500).json({ error: 'Failed to fetch promises' });
    }
  }

  if (req.method === 'POST') {
    const bodyAllowed = enforceMaxBodySize(req, res, 128 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin', 'agent']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'promises_create',
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
      const promise = await PromiseModel.create(parsedBody.data);
      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'promise.created',
        targetType: 'Promise',
        targetId: promise._id
      });
      return res.status(201).json({ promise });
    } catch (error) {
      logger.error('promise_create_failed', { error: error.message, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to create promise' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

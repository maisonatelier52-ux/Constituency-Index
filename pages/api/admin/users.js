import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';

const patchSchema = z
  .object({
    userId: z.string().min(5).max(64),
    role: z.enum(['citizen', 'agent', 'admin']).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export default async function handler(req, res) {
  const session = await requireAuth(req, res, ['admin']);
  if (!session) return;

  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_users_get',
      windowMs: 60_000,
      max: 60,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const users = await User.find({})
      .select('name email role isActive emailVerifiedAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ users });
  }

  if (req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 32 * 1024);
    if (!bodyAllowed) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_users_patch',
      windowMs: 60_000,
      max: 30,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid patch payload' });
    }

    const { userId, role, isActive } = parsed.data;
    const update = {};
    if (role) update.role = role;
    if (typeof isActive === 'boolean') update.isActive = isActive;

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select('name email role isActive emailVerifiedAt updatedAt')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await writeAuditLog(req, {
      actorUser: session.user.id,
      action: 'admin.user_updated',
      targetType: 'User',
      targetId: userId,
      metadata: { role, isActive }
    });

    return res.status(200).json({ user });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

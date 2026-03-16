import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/Notification';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const patchSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid notification id').optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const session = await requireAuth(req, res, ['citizen', 'admin', 'agent']);
    if (!session) return;

    try {
      const notifications = await Notification.find({ user: session.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const unreadCount = notifications.filter((n) => !n.read).length;
      return res.status(200).json({ notifications, unreadCount });
    } catch (error) {
      logger.error('notifications_get_failed', { error: error.message, userId: session.user.id });
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  if (req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 32 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['citizen', 'admin', 'agent']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'notifications_patch',
      windowMs: 60_000,
      max: 40,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = patchSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    try {
      const { id } = parsedBody.data;

      if (id) {
        await Notification.updateOne({ _id: id, user: session.user.id }, { $set: { read: true } });
      } else {
        await Notification.updateMany({ user: session.user.id, read: false }, { $set: { read: true } });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: id ? 'notification.mark_read_one' : 'notification.mark_read_all',
        targetType: 'Notification',
        targetId: id || null
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error('notifications_patch_failed', { error: error.message, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to update notifications' });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

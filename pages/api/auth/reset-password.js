import bcrypt from 'bcryptjs';
import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { consumeAuthToken } from '@/lib/authTokens';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';

const schema = z
  .object({
    token: z.string().trim().min(10).max(512),
    password: z.string().min(8).max(128)
  })
  .strict();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const bodyAllowed = enforceMaxBodySize(req, res, 32 * 1024);
  if (!bodyAllowed) return;

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'auth_reset_password',
    windowMs: 60_000,
    max: 10,
    id: getClientIp(req)
  });
  if (!allowed) return;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reset payload' });
  }

  await dbConnect();
  const tokenDoc = await consumeAuthToken({
    token: parsed.data.token,
    type: 'password_reset'
  });

  if (!tokenDoc) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const password = await bcrypt.hash(parsed.data.password, 12);
  await User.findByIdAndUpdate(tokenDoc.user, { $set: { password } });

  await writeAuditLog(req, {
    actorUser: tokenDoc.user,
    action: 'auth.password_reset_completed',
    targetType: 'User',
    targetId: tokenDoc.user
  });

  return res.status(200).json({ ok: true, message: 'Password has been reset successfully' });
}

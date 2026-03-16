import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { issueAuthToken } from '@/lib/authTokens';
import { sendPasswordResetEmail } from '@/lib/mailer';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';

const schema = z
  .object({
    email: z.string().trim().email().max(200)
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
    keyPrefix: 'auth_reset_request',
    windowMs: 60_000,
    max: 8,
    id: getClientIp(req)
  });
  if (!allowed) return;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request payload' });
  }

  await dbConnect();
  const email = parsed.data.email.toLowerCase();
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
  }

  const { plainToken, expiresAt } = await issueAuthToken({
    userId: user._id,
    type: 'password_reset',
    expiresInMinutes: 30
  });
  await sendPasswordResetEmail({ to: email, token: plainToken });

  await writeAuditLog(req, {
    actorUser: user._id,
    action: 'auth.password_reset_requested',
    targetType: 'User',
    targetId: user._id
  });

  return res.status(200).json({
    ok: true,
    message: 'If that email exists, a reset link has been sent.',
    expiresAt,
    ...(process.env.NODE_ENV !== 'production' ? { devResetToken: plainToken } : {})
  });
}

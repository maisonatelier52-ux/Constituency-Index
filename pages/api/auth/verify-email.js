import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { consumeAuthToken } from '@/lib/authTokens';
import { writeAuditLog } from '@/lib/audit';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';

const verifySchema = z
  .object({
    token: z.string().trim().min(10).max(512)
  })
  .strict();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const bodyAllowed = enforceMaxBodySize(req, res, 16 * 1024);
  if (!bodyAllowed) return;
  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'auth_verify_email',
    windowMs: 60_000,
    max: 20,
    id: getClientIp(req)
  });
  if (!allowed) return;

  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid verification payload' });
  }

  await dbConnect();
  const tokenDoc = await consumeAuthToken({
    token: parsed.data.token,
    type: 'email_verification'
  });

  if (!tokenDoc) {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }

  await User.findByIdAndUpdate(tokenDoc.user, {
    $set: { emailVerifiedAt: new Date() }
  });

  await writeAuditLog(req, {
    actorUser: tokenDoc.user,
    action: 'auth.verify_email',
    targetType: 'User',
    targetId: tokenDoc.user
  });

  return res.status(200).json({ ok: true, message: 'Email verified successfully' });
}

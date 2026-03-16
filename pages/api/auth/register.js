import bcrypt from 'bcryptjs';
import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { issueAuthToken } from '@/lib/authTokens';
import { sendVerificationEmail } from '@/lib/mailer';
import { writeAuditLog } from '@/lib/audit';

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(128)
  })
  .strict();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const bodyAllowed = enforceMaxBodySize(req, res, 64 * 1024);
  if (!bodyAllowed) return;

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'auth_register',
    windowMs: 60_000,
    max: 8,
    id: getClientIp(req)
  });
  if (!allowed) return;

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration payload' });
  }

  const payload = parsed.data;
  await dbConnect();

  const email = payload.email.toLowerCase();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const password = await bcrypt.hash(payload.password, 12);
  const user = await User.create({
    name: payload.name,
    email,
    password,
    role: 'citizen',
    emailVerifiedAt: null,
    isActive: true
  });

  const { plainToken, expiresAt } = await issueAuthToken({
    userId: user._id,
    type: 'email_verification',
    expiresInMinutes: 24 * 60
  });

  await sendVerificationEmail({ to: email, token: plainToken });
  await writeAuditLog(req, {
    actorUser: user._id,
    action: 'auth.register',
    targetType: 'User',
    targetId: user._id,
    metadata: { email }
  });

  return res.status(201).json({
    ok: true,
    message: 'Registration successful. Verify your email before signing in.',
    expiresAt,
    ...(process.env.NODE_ENV !== 'production' ? { devVerificationToken: plainToken } : {})
  });
}

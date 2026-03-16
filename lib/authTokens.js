import crypto from 'crypto';
import AuthToken from '@/models/AuthToken';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function issueAuthToken({ userId, type, expiresInMinutes = 60, meta = {} }) {
  await AuthToken.deleteMany({ user: userId, type, consumedAt: null });

  const plainToken = randomToken();
  const tokenHash = sha256(plainToken);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await AuthToken.create({
    user: userId,
    type,
    tokenHash,
    expiresAt,
    meta
  });

  return { plainToken, expiresAt };
}

export async function consumeAuthToken({ token, type }) {
  const tokenHash = sha256(String(token || ''));
  const now = new Date();

  const doc = await AuthToken.findOne({
    tokenHash,
    type,
    consumedAt: null,
    expiresAt: { $gt: now }
  });

  if (!doc) {
    return null;
  }

  doc.consumedAt = now;
  await doc.save();
  return doc;
}

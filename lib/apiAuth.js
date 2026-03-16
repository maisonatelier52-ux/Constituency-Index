import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

export async function getApiSession(req, res) {
  return getServerSession(req, res, authOptions);
}

export async function requireAuth(req, res, roles = []) {
  const session = await getApiSession(req, res);

  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (roles.length > 0 && !roles.includes(session.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return session;
}

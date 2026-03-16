import dbConnect from '@/lib/dbConnect';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const response = {
    status: 'ok',
    ts: new Date().toISOString(),
    checks: {
      api: 'ok',
      db: 'unknown'
    }
  };

  try {
    await dbConnect();
    response.checks.db = 'ok';
  } catch (_) {
    response.status = 'degraded';
    response.checks.db = 'error';
  }

  return res.status(response.status === 'ok' ? 200 : 503).json(response);
}

import { processAvailableJobs } from '@/lib/jobs/queue';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const summary = await processAvailableJobs({
    limit: 10,
    workerId: 'worker:cron'
  });

  return res.status(200).json({ ok: true, summary });
}
import { z } from 'zod';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { enqueueJobs } from '@/lib/jobs/queue';

const bodySchema = z
  .object({
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  })
  .strict();

function hasWorkerSecret(req) {
  const secret = process.env.JOB_WORKER_SECRET;
  if (!secret) return false;
  return req.headers['x-worker-secret'] === secret;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!hasWorkerSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'jobs_schedule',
    windowMs: 60_000,
    max: 20,
    id: getClientIp(req)
  });
  if (!allowed) return;

  const parsed = bodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' });
  }

  const dateKey = parsed.data.dateKey || new Date().toISOString().slice(0, 10);
  const jobs = await enqueueJobs([
    {
      type: 'import.official_constituencies',
      payload: {
        inputPath: 'data/constituencies/official_constituencies.csv'
      }
    },
    {
      type: 'import.boundaries',
      payload: {
        inputPath: 'data/constituencies/boundaries.geojson'
      }
    },
    {
      type: 'import.representatives',
      payload: {
        inputPath: 'data/representatives/official_representatives.csv',
        sourceName: 'official',
        dateKey
      }
    },
    {
      type: 'report.generate',
      payload: {
        scope: 'nightly-import'
      }
    }
  ]);

  return res.status(201).json({
    ok: true,
    scheduled: jobs.length,
    jobIds: jobs.map((j) => String(j._id))
  });
}

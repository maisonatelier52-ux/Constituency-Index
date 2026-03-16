// import { z } from 'zod';
// import { requireAuth } from '@/lib/apiAuth';
// import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
// import { processAvailableJobs } from '@/lib/jobs/queue';

// const bodySchema = z
//   .object({
//     limit: z.number().int().min(1).max(100).optional(),
//     workerId: z.string().trim().max(80).optional()
//   })
//   .strict();

// function hasWorkerSecret(req) {
//   const secret = process.env.JOB_WORKER_SECRET;
//   if (!secret) return false;
//   return req.headers['x-worker-secret'] === secret;
// }

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     res.setHeader('Allow', ['POST']);
//     return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
//   }

//   const allowed = await enforceRateLimit(req, res, {
//     keyPrefix: 'jobs_worker',
//     windowMs: 60_000,
//     max: 30,
//     id: getClientIp(req)
//   });
//   if (!allowed) return;

//   let actor = null;
//   if (!hasWorkerSecret(req)) {
//     const session = await requireAuth(req, res, ['admin']);
//     if (!session) return;
//     actor = session.user.id;
//   }

//   const parsed = bodySchema.safeParse(req.body || {});
//   if (!parsed.success) {
//     return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' });
//   }

//   const payload = parsed.data;
//   const summary = await processAvailableJobs({
//     limit: payload.limit || 10,
//     workerId: payload.workerId || (actor ? `admin:${actor}` : 'worker:secret')
//   });

//   return res.status(200).json({ ok: true, summary });
// }


import { z } from 'zod';
import { requireAuth } from '@/lib/apiAuth';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { processAvailableJobs } from '@/lib/jobs/queue';

const bodySchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    workerId: z.string().trim().max(80).optional()
  })
  .strict();

function hasWorkerSecret(req) {
  const secret = process.env.JOB_WORKER_SECRET;
  if (!secret) return false;
  return req.headers['x-worker-secret'] === secret;
}

function isVercelCron(req) {
  return req.headers['x-vercel-cron'] === '1';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'jobs_worker',
    windowMs: 60_000,
    max: 30,
    id: getClientIp(req)
  });
  if (!allowed) return;

  let actor = null;
  if (!hasWorkerSecret(req) && !isVercelCron(req)) {
    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;
    actor = session.user.id;
  }

  const parsed = bodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' });
  }

  const payload = parsed.data;
  const summary = await processAvailableJobs({
    limit: payload.limit || 10,
    workerId: payload.workerId || (actor ? `admin:${actor}` : 'worker:cron')
  });

  return res.status(200).json({ ok: true, summary });
}
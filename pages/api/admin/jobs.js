import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Job from '@/models/Job';
import { requireAuth } from '@/lib/apiAuth';
import { enqueueJob } from '@/lib/jobs/queue';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';

const querySchema = z
  .object({
    status: z.enum(['pending', 'running', 'failed', 'succeeded', 'dead_letter']).optional(),
    type: z.string().trim().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional()
  })
  .strict();

const createSchema = z
  .object({
    type: z.enum([
      'notification.send',
      'email.send',
      'geocode.lookup',
      'import.official_constituencies',
      'import.boundaries',
      'import.representatives',
      'report.generate'
    ]),
    payload: z.record(z.string(), z.any()).optional(),
    runAt: z.string().datetime().optional(),
    maxAttempts: z.number().int().min(1).max(20).optional()
  })
  .strict();

const patchSchema = z
  .object({
    jobId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid job id'),
    action: z.enum(['retry'])
  })
  .strict();

export default async function handler(req, res) {
  const session = await requireAuth(req, res, ['admin']);
  if (!session) return;
  await dbConnect();

  if (req.method === 'GET') {
    const parsedQuery = querySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query' });
    }

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_jobs_get',
      windowMs: 60_000,
      max: 120,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const q = {};
    if (parsedQuery.data.status) q.status = parsedQuery.data.status;
    if (parsedQuery.data.type) q.type = parsedQuery.data.type;

    const jobs = await Job.find(q).sort({ createdAt: -1 }).limit(parsedQuery.data.limit || 100).lean();
    return res.status(200).json({ jobs });
  }

  if (req.method === 'POST') {
    const bodyAllowed = enforceMaxBodySize(req, res, 128 * 1024);
    if (!bodyAllowed) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_jobs_create',
      windowMs: 60_000,
      max: 30,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = createSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    const data = parsedBody.data;
    const job = await enqueueJob({
      type: data.type,
      payload: data.payload || {},
      runAt: data.runAt,
      maxAttempts: data.maxAttempts || 3
    });

    await writeAuditLog(req, {
      actorUser: session.user.id,
      action: 'job.enqueued',
      targetType: 'Job',
      targetId: job._id,
      metadata: { type: data.type }
    });

    return res.status(201).json({ job });
  }

  if (req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 64 * 1024);
    if (!bodyAllowed) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_jobs_patch',
      windowMs: 60_000,
      max: 30,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = patchSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    const { jobId } = parsedBody.data;
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!['failed', 'dead_letter'].includes(job.status)) {
      return res.status(400).json({ error: 'Only failed or dead-letter jobs can be retried' });
    }

    const previousStatus = job.status;
    job.status = 'pending';
    job.nextRunAt = new Date();
    job.lockedAt = null;
    job.lockedBy = null;
    job.completedAt = null;
    job.startedAt = null;
    job.lastError = null;
    await job.save();

    await writeAuditLog(req, {
      actorUser: session.user.id,
      action: 'job.retried',
      targetType: 'Job',
      targetId: job._id,
      metadata: { type: job.type, previousStatus }
    });

    return res.status(200).json({ job });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

import dbConnect from '@/lib/dbConnect';
import Job from '@/models/Job';
import { JOB_HANDLERS } from '@/lib/jobs/handlers';
import { logger } from '@/lib/logger';

function toDateOrNow(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function enqueueJob({ type, payload = {}, runAt, maxAttempts = 3 }) {
  await dbConnect();
  const job = await Job.create({
    type,
    payload,
    nextRunAt: toDateOrNow(runAt),
    maxAttempts
  });
  return job;
}

export async function enqueueJobs(rows) {
  await dbConnect();
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return Job.insertMany(
    rows.map((row) => ({
      type: row.type,
      payload: row.payload || {},
      nextRunAt: toDateOrNow(row.runAt),
      maxAttempts: row.maxAttempts || 3
    }))
  );
}

async function claimNextJob(workerId) {
  await dbConnect();
  const now = new Date();
  const staleLockCutoff = new Date(now.getTime() - 5 * 60 * 1000);

  return Job.findOneAndUpdate(
    {
      status: { $in: ['pending', 'failed'] },
      nextRunAt: { $lte: now },
      $or: [{ lockedAt: null }, { lockedAt: { $lt: staleLockCutoff } }]
    },
    {
      $set: {
        status: 'running',
        lockedAt: now,
        lockedBy: workerId,
        startedAt: now
      },
      $inc: { attempts: 1 }
    },
    { sort: { nextRunAt: 1, createdAt: 1 }, new: true }
  );
}

async function markSucceeded(jobId, result) {
  await Job.findByIdAndUpdate(jobId, {
    $set: {
      status: 'succeeded',
      completedAt: new Date(),
      result: result || null,
      lastError: null,
      lockedAt: null,
      lockedBy: null
    }
  });
}

async function markFailed(job, error) {
  const nextDelayMs = Math.min(60 * 60 * 1000, Math.pow(2, Math.max(0, job.attempts - 1)) * 15 * 1000);
  const terminal = job.attempts >= job.maxAttempts;
  const message = String(error?.message || error || 'Unknown job error');
  await Job.findByIdAndUpdate(job._id, {
    $set: {
      status: terminal ? 'dead_letter' : 'failed',
      nextRunAt: terminal ? job.nextRunAt : new Date(Date.now() + nextDelayMs),
      lastError: message,
      lockedAt: null,
      lockedBy: null,
      completedAt: terminal ? new Date() : null
    }
  });

  if (terminal) {
    await enqueueJob({
      type: 'job.alert',
      payload: {
        reason: 'dead_letter',
        failedJobId: String(job._id),
        failedJobType: job.type,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error: message
      },
      maxAttempts: 1
    });
  }
}

export async function processJob(job) {
  const handler = JOB_HANDLERS[job.type];
  if (!handler) {
    throw new Error(`No handler registered for job type "${job.type}"`);
  }

  return handler(job.payload || {});
}

export async function processAvailableJobs({ workerId = 'api-worker', limit = 10 } = {}) {
  const summary = {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    deadLettered: 0,
    jobs: []
  };

  for (let i = 0; i < limit; i += 1) {
    const job = await claimNextJob(workerId);
    if (!job) break;

    summary.claimed += 1;
    try {
      const result = await processJob(job);
      await markSucceeded(job._id, result);
      summary.succeeded += 1;
      summary.jobs.push({ id: String(job._id), type: job.type, status: 'succeeded' });
    } catch (error) {
      await markFailed(job, error);
      if (job.attempts >= job.maxAttempts) summary.deadLettered += 1;
      else summary.failed += 1;
      summary.jobs.push({
        id: String(job._id),
        type: job.type,
        status: job.attempts >= job.maxAttempts ? 'dead_letter' : 'failed',
        error: String(error?.message || error)
      });
      logger.error('job_processing_failed', {
        jobId: String(job._id),
        type: job.type,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error: String(error?.message || error)
      });
    }
  }

  return summary;
}

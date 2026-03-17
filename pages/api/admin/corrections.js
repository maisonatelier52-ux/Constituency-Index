import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/dbConnect';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import Job from '@/models/Job';

const correctionsPath = path.join(process.cwd(), 'data', 'kerala', 'gazettes', 'manual_corrections.json');

const correctionValueSchema = z
  .object({
    normalized_name: z.string().trim().max(240).optional(),
    transliterated_name: z.string().trim().max(240).optional(),
    local_body_name: z.string().trim().max(240).optional()
  })
  .strict();

const correctionsSchema = z
  .object({
    by_jurisdiction_code: z.record(z.string().trim().min(1), correctionValueSchema),
    by_local_body_name: z.record(
      z.string().trim().min(1),
      z
        .object({
          local_body_name: z.string().trim().min(1).max(240)
        })
        .strict()
    )
  })
  .strict();

function readCorrections() {
  return JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));
}

function compareObjects(previous = {}, next = {}) {
  const prevKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  const allKeys = Array.from(new Set([...prevKeys, ...nextKeys])).sort();
  const changes = [];

  for (const key of allKeys) {
    const beforeValue = previous[key];
    const afterValue = next[key];
    if (JSON.stringify(beforeValue || null) === JSON.stringify(afterValue || null)) {
      continue;
    }

    let changeType = 'updated';
    if (!(key in previous)) changeType = 'added';
    if (!(key in next)) changeType = 'removed';

    changes.push({
      key,
      changeType,
      before: beforeValue || null,
      after: afterValue || null
    });
  }

  return changes;
}

function summarizeDiff(previous, next) {
  const jurisdictionChanges = compareObjects(previous.by_jurisdiction_code || {}, next.by_jurisdiction_code || {});
  const localBodyChanges = compareObjects(previous.by_local_body_name || {}, next.by_local_body_name || {});

  return {
    jurisdiction: {
      total: jurisdictionChanges.length,
      items: jurisdictionChanges.slice(0, 12)
    },
    localBody: {
      total: localBodyChanges.length,
      items: localBodyChanges.slice(0, 12)
    }
  };
}

async function loadKeralaImportJobs() {
  await dbConnect();
  const jobs = await Job.find({
    type: 'import.representatives',
    'payload.sourceName': 'kerala_local_bodies'
  })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  return jobs.map((job) => ({
    id: String(job._id),
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt || null,
    lastError: job.lastError || null,
    result: job.result || null
  }));
}

export default async function handler(req, res) {
  const session = await requireAuth(req, res, ['admin']);
  if (!session) return;

  if (req.method === 'GET') {
    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_corrections_get',
      windowMs: 60_000,
      max: 60,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const [corrections, jobs] = await Promise.all([Promise.resolve(readCorrections()), loadKeralaImportJobs()]);
    return res.status(200).json({
      corrections,
      jobs
    });
  }

  if (req.method === 'PUT') {
    const bodyAllowed = enforceMaxBodySize(req, res, 256 * 1024);
    if (!bodyAllowed) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_corrections_put',
      windowMs: 60_000,
      max: 20,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsed = correctionsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid corrections payload' });
    }

    const previous = readCorrections();
    const diff = summarizeDiff(previous, parsed.data);
    fs.writeFileSync(correctionsPath, `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf8');
    await writeAuditLog(req, {
      actorUser: session.user.id,
      action: 'corrections.updated',
      targetType: 'ManualCorrections',
      metadata: {
        jurisdictionCorrectionCount: Object.keys(parsed.data.by_jurisdiction_code || {}).length,
        localBodyCorrectionCount: Object.keys(parsed.data.by_local_body_name || {}).length,
        diff
      }
    });
    const jobs = await loadKeralaImportJobs();
    return res.status(200).json({
      ok: true,
      corrections: parsed.data,
      jobs
    });
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

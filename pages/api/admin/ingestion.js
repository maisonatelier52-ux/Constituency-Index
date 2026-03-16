import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/dbConnect';
import Job from '@/models/Job';
import { requireAuth } from '@/lib/apiAuth';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { getImportApprovals } from '@/lib/importApproval';

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function walkFiles(dirPath, matcher, acc = []) {
  if (!fs.existsSync(dirPath)) return acc;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const next = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(next, matcher, acc);
    } else if (matcher(next)) {
      acc.push(next);
    }
  }
  return acc;
}

function inferDatasetFromName(filePath, payload) {
  if (payload?.dataset) return payload.dataset;
  const base = path.basename(filePath).toLowerCase();
  if (base.includes('representatives')) return 'representatives';
  if (base.includes('boundaries')) return 'boundaries';
  if (base.includes('constituencies')) return 'official_constituencies';
  return 'unknown';
}

function datasetLabel(dataset) {
  if (dataset === 'official_constituencies') return 'Official Constituencies';
  if (dataset === 'boundaries') return 'Boundaries';
  if (dataset === 'representatives') return 'Representatives';
  return dataset;
}

export default async function handler(req, res) {
  const session = await requireAuth(req, res, ['admin']);
  if (!session) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'admin_ingestion_get',
    windowMs: 60_000,
    max: 60,
    id: `${session.user.id}:${getClientIp(req)}`
  });
  if (!allowed) return;

  await dbConnect();

  const publishedDir = path.join(process.cwd(), 'data', 'published', 'current');
  const rawDir = path.join(process.cwd(), 'data', 'raw');

  const publishedQaFiles = walkFiles(publishedDir, (filePath) => filePath.endsWith('.qa.json'));
  const publishedManifestFiles = walkFiles(publishedDir, (filePath) => filePath.endsWith('.manifest.json'));
  const rawManifestFiles = walkFiles(rawDir, (filePath) => filePath.endsWith('manifest.json'));

  const latestQaByDataset = {};
  for (const filePath of publishedQaFiles) {
    const payload = safeReadJson(filePath);
    if (!payload) continue;
    const dataset = inferDatasetFromName(filePath, payload);
    latestQaByDataset[dataset] = {
      dataset,
      label: datasetLabel(dataset),
      filePath,
      qa: payload
    };
  }

  const latestManifestByDataset = {};
  for (const filePath of publishedManifestFiles) {
    const payload = safeReadJson(filePath);
    if (!payload) continue;
    const dataset = inferDatasetFromName(filePath, payload);
    latestManifestByDataset[dataset] = {
      dataset,
      label: datasetLabel(dataset),
      filePath,
      manifest: payload
    };
  }

  const checksumHistoryMap = {};
  for (const filePath of rawManifestFiles) {
    const payload = safeReadJson(filePath);
    if (!payload) continue;
    const dataset = inferDatasetFromName(filePath, payload);
    if (!checksumHistoryMap[dataset]) checksumHistoryMap[dataset] = [];
    checksumHistoryMap[dataset].push({
      generatedAt: payload.generatedAt || null,
      checksum: payload.checksum || null,
      sourceName: payload.sourceName || dataset,
      filePath
    });
  }

  for (const key of Object.keys(checksumHistoryMap)) {
    checksumHistoryMap[key].sort((a, b) => new Date(b.generatedAt || 0) - new Date(a.generatedAt || 0));
    checksumHistoryMap[key] = checksumHistoryMap[key].slice(0, 12);
  }

  const datasets = Array.from(
    new Set([...Object.keys(latestQaByDataset), ...Object.keys(latestManifestByDataset), ...Object.keys(checksumHistoryMap)])
  ).map((dataset) => ({
    dataset,
    label: datasetLabel(dataset),
    qa: latestQaByDataset[dataset]?.qa || null,
    manifest: latestManifestByDataset[dataset]?.manifest || null,
    checksumHistory: checksumHistoryMap[dataset] || []
  }));

  const [deadLetterCount, recentDeadLetters, failedCount] = await Promise.all([
    Job.countDocuments({ status: 'dead_letter' }),
    Job.find({ status: 'dead_letter' }).sort({ updatedAt: -1 }).limit(10).lean(),
    Job.countDocuments({ status: 'failed' })
  ]);

  const alerts = [];
  if (deadLetterCount > 0) {
    alerts.push({
      level: 'critical',
      message: `${deadLetterCount} dead-letter job(s) need attention`
    });
  }
  if (failedCount > 0) {
    alerts.push({
      level: 'warning',
      message: `${failedCount} retryable failed job(s) are pending`
    });
  }
  for (const dataset of datasets) {
    if (dataset.qa && dataset.qa.pass === false) {
      alerts.push({
        level: 'critical',
        message: `${dataset.label} QA is failing`
      });
    }
    if (!dataset.manifest) {
      alerts.push({
        level: 'warning',
        message: `${dataset.label} has no published manifest`
      });
    }
  }

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    alerts,
    datasets,
    approvals: getImportApprovals(),
    jobs: {
      deadLetterCount,
      failedCount,
      recentDeadLetters
    }
  });
}

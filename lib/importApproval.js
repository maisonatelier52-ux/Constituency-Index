import fs from 'fs';
import path from 'path';

const APPROVALS_FILE = path.join(process.cwd(), 'data', 'published', 'approvals.json');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readApprovals() {
  try {
    return JSON.parse(fs.readFileSync(APPROVALS_FILE, 'utf8'));
  } catch (_) {
    return {
      updatedAt: null,
      datasets: {}
    };
  }
}

function writeApprovals(payload) {
  ensureDir(APPROVALS_FILE);
  fs.writeFileSync(APPROVALS_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

export function getImportApprovals() {
  return readApprovals();
}

export function setImportApproval(dataset, approval) {
  const current = readApprovals();
  current.updatedAt = new Date().toISOString();
  current.datasets[dataset] = {
    ...(current.datasets[dataset] || {}),
    ...approval
  };
  writeApprovals(current);
  return current.datasets[dataset];
}

export function canPublishDataset(dataset, qa = null) {
  if (qa?.pass === false) {
    return {
      allowed: false,
      reason: 'qa_failed'
    };
  }

  if (process.env.REQUIRE_IMPORT_APPROVAL !== 'true') {
    return {
      allowed: true,
      reason: 'approval_not_required'
    };
  }

  const approvals = readApprovals();
  const entry = approvals.datasets?.[dataset];
  if (!entry?.approvedAt) {
    return {
      allowed: false,
      reason: 'manual_approval_required'
    };
  }

  return {
    allowed: true,
    reason: 'approved',
    approval: entry
  };
}

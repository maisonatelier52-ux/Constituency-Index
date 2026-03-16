import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-import-approval-'));
process.chdir(tempRoot);

const { canPublishDataset, setImportApproval, getImportApprovals } = await import('../lib/importApproval.js');

test('publish gate allows passing QA when approval not required', () => {
  process.env.REQUIRE_IMPORT_APPROVAL = 'false';
  const result = canPublishDataset('representatives', { pass: true });
  assert.equal(result.allowed, true);
});

test('publish gate blocks without manual approval when required', () => {
  process.env.REQUIRE_IMPORT_APPROVAL = 'true';
  const result = canPublishDataset('representatives', { pass: true });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'manual_approval_required');
});

test('publish gate allows approved dataset', () => {
  process.env.REQUIRE_IMPORT_APPROVAL = 'true';
  setImportApproval('representatives', {
    approved: true,
    approvedAt: new Date().toISOString(),
    approvedBy: 'admin-user'
  });
  const approvals = getImportApprovals();
  assert.equal(approvals.datasets.representatives.approved, true);

  const result = canPublishDataset('representatives', { pass: true });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, 'approved');
});

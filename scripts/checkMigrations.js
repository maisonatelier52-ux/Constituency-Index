/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function assertExists(relPath, kind = 'file') {
  const absPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Missing ${kind}: ${relPath}`);
  }
}

function run() {
  assertExists('scripts/importOfficialConstituencies.js');
  assertExists('scripts/importConstituencyBoundaries.js');
  assertExists('scripts/importRepresentatives.js');
  assertExists('data/constituencies/official_constituencies.template.csv');
  assertExists('data/constituencies/boundaries.template.geojson');
  assertExists('data/representatives/official_representatives.template.csv');
  assertExists('data/source_registry.json');
  assertExists('data/README.md');
  assertExists('docs/runbooks/migrations.md');
  assertExists('docs/runbooks/deployment.md');
  assertExists('docs/runbooks/rollback.md');
  assertExists('docs/runbooks/real-data-onboarding.md');

  console.log('[check:migrations] PASS');
}

try {
  run();
} catch (error) {
  console.error(`[check:migrations] FAIL: ${error.message}`);
  process.exit(1);
}

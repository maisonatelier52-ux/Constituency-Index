const { spawnSync } = require('child_process');

const requiredEnv = ['SMOKE_BASE_URL', 'HEALTHCHECK_URL', 'METRICS_URL'];

function ensureEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv }
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }
}

async function check(url, name) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${name} check failed with status ${response.status}`);
  }
}

async function main() {
  ensureEnv();
  await check(process.env.HEALTHCHECK_URL, 'health');
  await check(process.env.METRICS_URL, 'metrics');

  run('npm', ['run', 'smoke:staging']);

  if (process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_ADMIN_EMAIL) {
    run('npx', ['playwright', 'test'], {
      PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || process.env.SMOKE_BASE_URL
    });
  }

  console.log(JSON.stringify({ ok: true, stage: 'staging_drill_complete' }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
});

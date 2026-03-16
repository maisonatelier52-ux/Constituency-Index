/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`[ci-smoke] FAIL: ${message}`);
  process.exitCode = 1;
}

function ensureFile(relPath) {
  const absPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) {
    fail(`Missing required file: ${relPath}`);
  }
}

function ensureEnvVarInExample(name) {
  const envPath = path.join(process.cwd(), '.env.example');
  if (!fs.existsSync(envPath)) {
    fail('Missing .env.example');
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const exists = raw.split(/\r?\n/).some((line) => line.startsWith(`${name}=`));
  if (!exists) {
    fail(`Missing env key in .env.example: ${name}`);
  }
}

function run() {
  const requiredFiles = [
    'pages/api/health.js',
    'pages/api/jobs/worker.js',
    'pages/api/jobs/schedule.js',
    'pages/api/admin/jobs.js',
    'pages/api/geocode/lookup.js',
    'pages/api/issues/index.js',
    'pages/api/issues/[id].js'
  ];

  const requiredEnvVars = [
    'MONGODB_URI',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'ALLOWED_ORIGINS',
    'JOB_WORKER_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  requiredFiles.forEach(ensureFile);
  requiredEnvVars.forEach(ensureEnvVarInExample);

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log('[ci-smoke] PASS');
}

run();

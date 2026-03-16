import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateEnv } = require('../lib/env-config.cjs');

function withEnv(overrides, fn) {
  const previous = { ...process.env };
  process.env = { ...previous, ...overrides };
  try {
    fn();
  } finally {
    process.env = previous;
  }
}

test('validateEnv allows minimal non-production config', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      NEXTAUTH_SECRET: 'secret',
      NEXTAUTH_URL: 'http://localhost:3000',
      ALLOWED_ORIGINS: 'http://localhost:3000'
    },
    () => {
      assert.doesNotThrow(() => validateEnv());
    }
  );
});

test('validateEnv rejects insecure production config', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      NEXTAUTH_SECRET: 'secret',
      NEXTAUTH_URL: 'http://example.com',
      MONGODB_URI: 'mongodb://localhost:27017/test',
      JOB_WORKER_SECRET: 'worker',
      QA_SIGNING_SECRET: 'qa',
      REQUIRE_EMAIL_VERIFICATION: 'false'
    },
    () => {
      assert.throws(() => validateEnv({ lifecycle: 'start' }), /REQUIRE_EMAIL_VERIFICATION|https/);
    }
  );
});

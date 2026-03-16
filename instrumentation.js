const { validateEnv } = require('./lib/env-config.cjs');

export async function register() {
  validateEnv({ lifecycle: 'start' });
}

function asBool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(`[env] ${message}`);
  }
}

function validateEnv(options = {}) {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const lifecycle = options.lifecycle || process.env.npm_lifecycle_event || '';
  const isProd = nodeEnv === 'production';
  const enforceStrictProd = isProd && !['build', 'lint', 'test:ci', 'test:unit'].includes(lifecycle);

  ensure(process.env.NEXTAUTH_SECRET, 'NEXTAUTH_SECRET is required.');
  ensure(process.env.NEXTAUTH_URL, 'NEXTAUTH_URL is required.');

  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
    ensure(origins.length > 0, 'ALLOWED_ORIGINS must contain at least one origin when set.');
  }

  if (enforceStrictProd) {
    ensure(process.env.MONGODB_URI, 'MONGODB_URI is required in production.');
    ensure(process.env.JOB_WORKER_SECRET, 'JOB_WORKER_SECRET is required in production.');
    ensure(process.env.QA_SIGNING_SECRET, 'QA_SIGNING_SECRET is required in production.');
    ensure(asBool(process.env.REQUIRE_EMAIL_VERIFICATION, true), 'REQUIRE_EMAIL_VERIFICATION must be true in production.');
    ensure(process.env.NEXTAUTH_URL.startsWith('https://'), 'NEXTAUTH_URL must use https in production.');

    const malwareProvider = String(process.env.MALWARE_SCAN_PROVIDER || 'noop').toLowerCase();
    if (malwareProvider === 'clamav') {
      ensure(process.env.CLAMAV_HOST, 'CLAMAV_HOST is required when MALWARE_SCAN_PROVIDER=clamav.');
    }

    const moderationProvider = String(process.env.MODERATION_PROVIDER || 'noop').toLowerCase();
    if (moderationProvider === 'sightengine') {
      ensure(process.env.SIGHTENGINE_API_USER, 'SIGHTENGINE_API_USER is required when MODERATION_PROVIDER=sightengine.');
      ensure(process.env.SIGHTENGINE_API_SECRET, 'SIGHTENGINE_API_SECRET is required when MODERATION_PROVIDER=sightengine.');
    }

    if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
      ensure(
        Number.isFinite(Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1')),
        'SENTRY_TRACES_SAMPLE_RATE must be numeric.'
      );
    }
  }
}

module.exports = {
  validateEnv
};

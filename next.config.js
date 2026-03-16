const { withSentryConfig } = require('@sentry/nextjs');
const { validateEnv } = require('./lib/env-config.cjs');

validateEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'hi', 'ml'],
    defaultLocale: 'en'
  },
  experimental: {
    esmExternals: 'loose',
    serverComponentsExternalPackages: ['mongoose']
  },
  webpack: (config) => {
    config.experiments = {
      ...(config.experiments || {}),
      topLevelAwait: true
    };

    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' }
        ]
      }
    ];
  }
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || undefined,
  project: process.env.SENTRY_PROJECT || undefined,
  silent: true,
  hideSourceMaps: true,
  widenClientFileUpload: false,
  tunnelRoute: '/monitoring'
});

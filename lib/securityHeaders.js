// export function buildCsp(nonce) {
//   const sentryConnect = ['https://*.ingest.sentry.io', 'https://o*.ingest.sentry.io'];
//   const cloudinary = ['https://res.cloudinary.com', 'https://api.cloudinary.com'];
//   const maps = ['https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'];

//   const directives = {
//     'default-src': ["'self'"],
//     'base-uri': ["'self'"],
//     'frame-ancestors': ["'none'"],
//     'object-src': ["'none'"],
//     'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
//     'style-src': ["'self'", "'unsafe-inline'"],
//     'img-src': ["'self'", 'data:', 'blob:', ...cloudinary, ...maps],
//     'media-src': ["'self'", 'blob:', ...cloudinary],
//     'font-src': ["'self'", 'data:'],
//     'connect-src': ["'self'", ...sentryConnect, ...cloudinary],
//     'frame-src': ["'none'"],
//     'form-action': ["'self'"],
//     'worker-src': ["'self'", 'blob:'],
//     'manifest-src': ["'self'"]
//   };

//   return Object.entries(directives)
//     .map(([key, values]) => `${key} ${values.join(' ')}`)
//     .join('; ');
// }

export function buildCsp(nonce) {
  const sentryConnect = [
    'https://*.ingest.sentry.io',
    'https://o*.ingest.sentry.io',
    'https://sentry.io'
  ];
  const cloudinary = ['https://res.cloudinary.com', 'https://api.cloudinary.com'];
  const maps = ['https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'];

  const directives = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'unsafe-eval'",
      'https:'
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...cloudinary, ...maps],
    'media-src': ["'self'", 'blob:', ...cloudinary],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      'https://*.ingest.sentry.io',
      'https://sentry.io',
      ...cloudinary
    ],
    'frame-src': ["'none'"],
    'form-action': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"]
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}
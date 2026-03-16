import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { buildCsp } from '@/lib/securityHeaders';

function allowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || process.env.NEXTAUTH_URL || '';
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function applySecurityHeaders(res) {
  const nonce = res.headers.get('x-csp-nonce') || crypto.randomUUID().replace(/-/g, '');
  res.headers.set('x-csp-nonce', nonce);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('Content-Security-Policy', buildCsp(nonce));
  return res;
}

function applyCors(req, res) {
  const origin = req.headers.get('origin');
  if (!origin) return { ok: true, res };

  const allowlist = allowedOrigins();
  if (!allowlist.includes(origin)) {
    return { ok: false, res: NextResponse.json({ error: 'Origin not allowed' }, { status: 403 }) };
  }

  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  return { ok: true, res };
}

const protectedRoutes = [
  '/constituencies',
  '/issues/new',
  '/issues',
  '/mps',
  '/promises',
  '/feedback',
  '/activities',
  '/notifications',
  '/education',
  '/us',
  '/admin'
];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const nonce = crypto.randomUUID().replace(/-/g, '');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-csp-nonce', nonce);

  if (pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      let optionsRes = new NextResponse(null, { status: 204, request: { headers: requestHeaders } });
      optionsRes.headers.set('x-csp-nonce', nonce);
      optionsRes = applySecurityHeaders(optionsRes);
      const cors = applyCors(req, optionsRes);
      return cors.res;
    }

    let apiRes = NextResponse.next({ request: { headers: requestHeaders } });
    apiRes.headers.set('x-csp-nonce', nonce);
    apiRes = applySecurityHeaders(apiRes);
    const cors = applyCors(req, apiRes);
    if (!cors.ok) {
      return applySecurityHeaders(cors.res);
    }
    return cors.res;
  }

  const needsAuth = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!needsAuth) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-csp-nonce', nonce);
    return applySecurityHeaders(response);
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return applySecurityHeaders(NextResponse.redirect(signInUrl));
  }

  if (pathname.startsWith('/admin') && token.role !== 'admin') {
    const homeUrl = new URL('/constituencies', req.url);
    return applySecurityHeaders(NextResponse.redirect(homeUrl));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-csp-nonce', nonce);
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    '/api/:path*',
    '/constituencies/:path*',
    '/issues/:path*',
    '/mps/:path*',
    '/promises/:path*',
    '/feedback/:path*',
    '/activities/:path*',
    '/notifications/:path*',
    '/education/:path*',
    '/us/:path*',
    '/admin/:path*'
  ]
};

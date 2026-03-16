import { checkRateLimit } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}

export async function enforceRateLimit(req, res, options) {
  const {
    keyPrefix,
    windowMs = 60_000,
    max = 60,
    id = getClientIp(req)
  } = options;

  const key = `${keyPrefix}:${id}`;
  const result = await checkRateLimit(key, { windowMs, max });

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));

  if (!result.allowed) {
    const retrySeconds = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader('Retry-After', String(retrySeconds));
    logger.warn('rate_limit_exceeded', {
      keyPrefix,
      id,
      retrySeconds,
      path: req.url,
      method: req.method
    });
    res.status(429).json({ error: 'Too many requests. Please retry later.' });
    return false;
  }

  return true;
}

export function enforceMaxBodySize(req, res, maxBytes = 256 * 1024) {
  const raw = req.headers['content-length'];
  const contentLength = raw ? Number(raw) : 0;
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    res.status(413).json({ error: 'Payload too large' });
    return false;
  }
  return true;
}

import { z } from 'zod';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { logger } from '@/lib/logger';
import { geocodeByPostalCode, reverseGeocode } from '@/lib/geocoding';

const querySchema = z
  .object({
    mode: z.enum(['postal', 'reverse']),
    country: z.enum(['IN', 'US']).optional(),
    postalCode: z.string().trim().min(3).max(20).optional(),
    lat: z.string().optional(),
    lng: z.string().optional()
  })
  .strict();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'geocode_lookup',
    windowMs: 60_000,
    max: 30,
    id: getClientIp(req)
  });
  if (!allowed) return;

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid lookup query' });
  }

  const query = parsed.data;

  try {
    if (query.mode === 'postal') {
      if (!query.postalCode) {
        return res.status(400).json({ error: 'postalCode is required for postal mode' });
      }
      const result = await geocodeByPostalCode({
        country: query.country || 'IN',
        postalCode: query.postalCode
      });
      return res.status(200).json(result);
    }

    const lat = Number(query.lat);
    const lng = Number(query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required for reverse mode' });
    }

    const result = await reverseGeocode({ lat, lng });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('geocode_lookup_failed', { error: error.message, mode: query.mode, path: req.url });
    return res.status(502).json({ error: 'Location provider unavailable. Try again.' });
  }
}

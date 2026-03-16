import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Constituency from '@/models/Constituency';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { logger } from '@/lib/logger';

const querySchema = z.object({
  country: z.enum(['IN', 'US']).optional(),
  state: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  town: z.string().max(120).optional(),
  suburb: z.string().max(120).optional(),
  village: z.string().max(120).optional(),
  lat: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  lng: z.string().regex(/^-?\d+(\.\d+)?$/).optional()
}).strict();

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function includesText(text, needle) {
  if (!needle) return false;
  return normalize(text).includes(normalize(needle));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function scoreConstituency(c, ctx) {
  let score = 0;

  if (ctx.state && normalize(c.state) === normalize(ctx.state)) score += 5;
  if (ctx.district && includesText(c.name, ctx.district)) score += 3;
  if (ctx.town && includesText(c.name, ctx.town)) score += 3;
  if (ctx.suburb && includesText(c.name, ctx.suburb)) score += 2;
  if (ctx.village && includesText(c.name, ctx.village)) score += 2;

  let distanceKm = null;
  if (ctx.lat != null && ctx.lng != null && c.centroid?.lat != null && c.centroid?.lng != null) {
    distanceKm = haversineKm(ctx.lat, ctx.lng, Number(c.centroid.lat), Number(c.centroid.lng));
    const distanceBoost = Math.max(0, 20 - Math.min(20, distanceKm)) / 4;
    score += distanceBoost;
  }

  return { score, distanceKm };
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'constituency_resolve',
    windowMs: 60_000,
    max: 90,
    id: getClientIp(req)
  });
  if (!allowed) return;

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid resolve query' });
  }

  try {
    const q = parsed.data;
    const country = q.country || 'IN';
    const state = q.state || '';
    const district = q.district || '';
    const town = q.town || '';
    const suburb = q.suburb || '';
    const village = q.village || '';

    const lat = q.lat != null ? Number(q.lat) : null;
    const lng = q.lng != null ? Number(q.lng) : null;

    const query = { country };
    if (state) {
      query.state = new RegExp(`^${String(state).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i');
    }

    const rows = await Constituency.find(query)
      .select('name code state country constituencyType centroid profileType')
      .lean()
      .limit(3000);

    const withScores = rows
      .map((c) => {
        const { score, distanceKm } = scoreConstituency(c, { state, district, town, suburb, village, lat, lng });
        return {
          ...c,
          score: Number(score.toFixed(3)),
          distanceKm: distanceKm == null ? null : Number(distanceKm.toFixed(2))
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ad = a.distanceKm == null ? Number.POSITIVE_INFINITY : a.distanceKm;
        const bd = b.distanceKm == null ? Number.POSITIVE_INFINITY : b.distanceKm;
        return ad - bd;
      });

    const candidates = withScores.slice(0, 15);

    return res.status(200).json({
      country,
      candidates,
      bestMatch: candidates[0] || null
    });
  } catch (error) {
    logger.error('constituency_resolve_failed', { error: error.message, path: req.url });
    return res.status(500).json({ error: 'Failed to resolve constituencies by location' });
  }
}

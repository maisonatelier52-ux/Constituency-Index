import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { logger } from '@/lib/logger';

const querySchema = z
  .object({
    constituency: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid constituency id').optional(),
    category: z.string().trim().max(120).optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'issues_heatmap',
    windowMs: 60_000,
    max: 120,
    id: getClientIp(req)
  });
  if (!allowed) return;

  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query' });
  }

  try {
    const query = {};
    if (parsedQuery.data.constituency) {
      query.constituency = parsedQuery.data.constituency;
    }
    if (parsedQuery.data.category) {
      query.category = parsedQuery.data.category;
    }

    const issues = await Issue.find(query).select('category constituency geo status').lean();
    const filtered = issues.filter((item) => item?.geo?.lat != null && item?.geo?.lng != null);

    const buckets = new Map();
    for (const issue of filtered) {
      const lat = Number(issue.geo.lat);
      const lng = Number(issue.geo.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

      const bucketLat = lat.toFixed(3);
      const bucketLng = lng.toFixed(3);
      const key = `${bucketLat}|${bucketLng}|${issue.category || 'Other'}`;

      const prev = buckets.get(key) || {
        lat: Number(bucketLat),
        lng: Number(bucketLng),
        category: issue.category || 'Other',
        count: 0,
        resolved: 0,
        pending: 0
      };

      prev.count += 1;
      if (issue.status === 'resolved') prev.resolved += 1;
      else prev.pending += 1;

      buckets.set(key, prev);
    }

    return res.status(200).json({
      points: Array.from(buckets.values()),
      totalIssues: filtered.length
    });
  } catch (error) {
    logger.error('issues_heatmap_failed', { error: error.message, path: req.url });
    return res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
}

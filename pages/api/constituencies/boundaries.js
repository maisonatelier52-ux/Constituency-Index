import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Constituency from '@/models/Constituency';
import Issue from '@/models/Issue';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { logger } from '@/lib/logger';

const querySchema = z
  .object({
    country: z.enum(['IN', 'US']).optional(),
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
    keyPrefix: 'constituencies_boundaries',
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
    const country = parsedQuery.data.country || null;

    const constituencyFilter = {
      geoBoundary: { $exists: true, $ne: null }
    };

    if (country) {
      constituencyFilter.country = country;
    }

    if (parsedQuery.data.constituency) {
      constituencyFilter._id = parsedQuery.data.constituency;
    }

    const constituencies = await Constituency.find(constituencyFilter)
      .select('name code state country constituencyType geoBoundary centroid')
      .lean();

    const constituencyIds = constituencies.map((c) => c._id);

    const issueMatch = { constituency: { $in: constituencyIds } };
    if (parsedQuery.data.category) {
      issueMatch.category = parsedQuery.data.category;
    }

    const issueStats = await Issue.aggregate([
      { $match: issueMatch },
      {
        $group: {
          _id: '$constituency',
          total: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const statsMap = issueStats.reduce((acc, item) => {
      const id = String(item._id);
      const pending = Math.max(0, item.total - item.resolved);
      acc[id] = {
        total: item.total,
        resolved: item.resolved,
        pending,
        resolutionRate: item.total > 0 ? Number(((item.resolved / item.total) * 100).toFixed(2)) : 0
      };
      return acc;
    }, {});

    const maxTotal = Math.max(
      1,
      ...constituencies.map((c) => statsMap[String(c._id)]?.total || 0)
    );

    const features = constituencies.map((c) => {
      const stats = statsMap[String(c._id)] || {
        total: 0,
        resolved: 0,
        pending: 0,
        resolutionRate: 0
      };

      const intensity = Number((stats.total / maxTotal).toFixed(4));

      return {
        type: 'Feature',
        geometry: c.geoBoundary,
        properties: {
          id: String(c._id),
          name: c.name,
          code: c.code,
          state: c.state,
          country: c.country,
          constituencyType: c.constituencyType,
          centroid: c.centroid || null,
          ...stats,
          intensity
        }
      };
    });

    return res.status(200).json({
      type: 'FeatureCollection',
      features,
      maxTotal
    });
  } catch (error) {
    logger.error('constituency_boundaries_failed', { error: error.message, path: req.url });
    return res.status(500).json({ error: 'Failed to fetch constituency boundaries' });
  }
}

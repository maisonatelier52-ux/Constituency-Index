// import { z } from 'zod';
// import dbConnect from '@/lib/dbConnect';
// import Issue from '@/models/Issue';
// import PromiseModel from '@/models/Promise';
// import Constituency from '@/models/Constituency';
// import Representative from '@/models/Representative';
// import { computeConstituencyIndex, resolveWeights } from '@/lib/constituencyIndex';
// import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
// import { logger } from '@/lib/logger';

// const querySchema = z
//   .object({
//     country: z.enum(['IN', 'US']).optional()
//   })
//   .strict();

// export default async function handler(req, res) {
//   await dbConnect();

//   if (req.method !== 'GET') {
//     res.setHeader('Allow', ['GET']);
//     return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
//   }

//   const allowed = await enforceRateLimit(req, res, {
//     keyPrefix: 'dashboard_overview',
//     windowMs: 60_000,
//     max: 120,
//     id: getClientIp(req)
//   });
//   if (!allowed) return;

//   const parsedQuery = querySchema.safeParse(req.query);
//   if (!parsedQuery.success) {
//     return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query' });
//   }

//   try {
//     const country = parsedQuery.data.country || null;

//     const constituencyQuery = {};
//     if (country) {
//       constituencyQuery.country = country;
//     }

//     const constituencies = await Constituency.find(constituencyQuery).populate('representative').lean();
//     const constituencyIds = constituencies.map((c) => c._id);

//     const issueQuery = country ? { constituency: { $in: constituencyIds } } : {};
//     const promiseQuery = country ? { constituency: { $in: constituencyIds } } : {};
//     const representativeQuery = country ? { constituency: { $in: constituencyIds } } : {};

//     const [issues, promisesTracked, representatives] = await Promise.all([
//       Issue.find(issueQuery).lean(),
//       PromiseModel.countDocuments(promiseQuery),
//       Representative.find(representativeQuery).lean()
//     ]);

//     const now = new Date();
//     const solvedIssues = issues.filter((item) => item.status === 'resolved').length;
//     const pendingIssues = issues.filter((item) => item.status !== 'resolved').length;
//     const overdueIssues = issues.filter(
//       (item) => item.status !== 'resolved' && item.deadline && new Date(item.deadline) < now
//     ).length;

//     const resolvedIssues = issues.filter((item) => item.status === 'resolved' && item.resolvedAt);
//     const avgResponseDays =
//       resolvedIssues.length === 0
//         ? 0
//         : resolvedIssues.reduce((sum, issue) => {
//             const created = new Date(issue.createdAt).getTime();
//             const resolved = new Date(issue.resolvedAt).getTime();
//             return sum + Math.max(0, resolved - created) / (1000 * 60 * 60 * 24);
//           }, 0) / resolvedIssues.length;

//     const engagementLevel =
//       representatives.length === 0
//         ? 'N/A'
//         : representatives.reduce((acc, rep) => {
//             const map = { low: 1, moderate: 2, high: 3 };
//             return acc + (map[rep.engagementLevel] || 2);
//           }, 0) /
//             representatives.length >=
//           2.4
//         ? 'High'
//         : 'Moderate';

//     const constituencyCards = constituencies.map((constituency) => {
//       const weights = resolveWeights(constituency.profileType, constituency.indexWeights);
//       const constituencyIndex = computeConstituencyIndex({
//         metrics: constituency.indexMetrics,
//         weights
//       });

//       return {
//         _id: constituency._id,
//         name: constituency.name,
//         code: constituency.code,
//         state: constituency.state,
//         country: constituency.country,
//         constituencyType: constituency.constituencyType,
//         representative: constituency.representative,
//         constituencyIndex,
//         profileType: constituency.profileType
//       };
//     });

//     return res.status(200).json({
//       metrics: {
//         constituencies: constituencies.length,
//         totalIssues: issues.length,
//         solvedIssues,
//         pendingIssues,
//         overdueIssues,
//         promisesTracked,
//         avgResponseDays: Number(avgResponseDays.toFixed(2)),
//         engagementLevel
//       },
//       constituencies: constituencyCards
//     });
//   } catch (error) {
//     logger.error('dashboard_overview_failed', { error: error.message, path: req.url });
//     return res.status(500).json({ error: 'Failed to fetch dashboard overview' });
//   }
// }


import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
import PromiseModel from '@/models/Promise';
import Constituency from '@/models/Constituency';
import Representative from '@/models/Representative';
import { computeConstituencyIndex, resolveWeights } from '@/lib/constituencyIndex';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { logger } from '@/lib/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

const querySchema = z
  .object({
    country: z.enum(['IN', 'US']).optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'dashboard_overview',
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

    const constituencyQuery = {};
    if (country) {
      constituencyQuery.country = country;
    }

    const constituencies = await Constituency.find(constituencyQuery)
      .populate('representative')
      .lean();

    const constituencyIds = constituencies.map((c) => c._id);

    const issueQuery = {
      reporter: userId,
      ...(country ? { constituency: { $in: constituencyIds } } : {})
    };

    const promiseQuery = country
      ? { constituency: { $in: constituencyIds } }
      : {};

    const representativeQuery = country
      ? { constituency: { $in: constituencyIds } }
      : {};

    const [issues, promisesTracked, representatives] = await Promise.all([
      Issue.find(issueQuery).lean(),
      PromiseModel.countDocuments(promiseQuery),
      Representative.find(representativeQuery).lean()
    ]);

    const now = new Date();

    const solvedIssues = issues.filter((i) => i.status === 'resolved').length;

    const pendingIssues = issues.filter((i) => i.status !== 'resolved').length;

    const overdueIssues = issues.filter(
      (i) =>
        i.status !== 'resolved' &&
        i.deadline &&
        new Date(i.deadline) < now
    ).length;

    const resolvedIssues = issues.filter(
      (i) => i.status === 'resolved' && i.resolvedAt
    );

    const avgResponseDays =
      resolvedIssues.length === 0
        ? 0
        : resolvedIssues.reduce((sum, issue) => {
            const created = new Date(issue.createdAt).getTime();
            const resolved = new Date(issue.resolvedAt).getTime();
            return sum + Math.max(0, resolved - created) / (1000 * 60 * 60 * 24);
          }, 0) / resolvedIssues.length;

    const engagementLevel =
      representatives.length === 0
        ? 'N/A'
        : representatives.reduce((acc, rep) => {
            const map = { low: 1, moderate: 2, high: 3 };
            return acc + (map[rep.engagementLevel] || 2);
          }, 0) /
            representatives.length >=
          2.4
        ? 'High'
        : 'Moderate';

    const constituencyCards = constituencies.map((c) => {
      const weights = resolveWeights(c.profileType, c.indexWeights);

      const constituencyIndex = computeConstituencyIndex({
        metrics: c.indexMetrics,
        weights
      });

      return {
        _id: c._id,
        name: c.name,
        code: c.code,
        state: c.state,
        country: c.country,
        constituencyType: c.constituencyType,
        representative: c.representative,
        constituencyIndex,
        profileType: c.profileType
      };
    });

    return res.status(200).json({
      metrics: {
        constituencies: constituencies.length,
        totalIssues: issues.length,
        solvedIssues,
        pendingIssues,
        overdueIssues,
        promisesTracked,
        avgResponseDays: Number(avgResponseDays.toFixed(2)),
        engagementLevel
      },
      constituencies: constituencyCards
    });
  } catch (error) {
    logger.error('dashboard_overview_failed', {
      error: error.message,
      path: req.url
    });

    return res.status(500).json({
      error: 'Failed to fetch dashboard overview'
    });
  }
}
import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
import IssueVote from '@/models/IssueVote';
import { getApiSession, requireAuth } from '@/lib/apiAuth';
import { sanitizeIssueCreatePayload } from '@/lib/issueValidation';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { logger } from '@/lib/logger';
import { writeAuditLog } from '@/lib/audit';
import { enqueueNotificationJob } from '@/lib/jobs/enqueue';
import { enqueueJob } from '@/lib/jobs/queue';

const createIssueSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().min(5).max(5000),
  location: z.string().trim().max(300).optional().or(z.literal('')),
  locationTags: z.union([z.string(), z.array(z.string())]).optional(),
  evidenceUrls: z.union([z.string(), z.array(z.string())]).optional(),
  constituency: z.string().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional()
});
const listQuerySchema = z
  .object({
    mine: z.enum(['0', '1']).optional(),
    category: z.string().trim().max(120).optional(),
    constituency: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid constituency id').optional()
  })
  .strict();

function withDerivedIssueFields(issue, voteCountMap = {}, userVotes = new Set()) {
  const isOverdue = issue.deadline ? new Date(issue.deadline) < new Date() && issue.status !== 'resolved' : false;

  return {
    ...issue,
    isOverdue,
    votesCount: voteCountMap[issue._id.toString()] || 0,
    hasVoted: userVotes.has(issue._id.toString())
  };
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const parsedQuery = listQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query' });
    }

    try {
      const query = {};
      const session = await getApiSession(req, res);

      if (parsedQuery.data.mine === '1') {
        if (!session) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        query.reporter = session.user.id;
      }

      if (parsedQuery.data.category) {
        query.category = parsedQuery.data.category;
      }

      if (parsedQuery.data.constituency) {
        query.constituency = parsedQuery.data.constituency;
      }

      const issues = await Issue.find(query)
        .populate('reporter')
        .populate('constituency')
        .sort({ createdAt: -1 })
        .lean();

      const issueIds = issues.map((issue) => issue._id);
      const voteAgg = await IssueVote.aggregate([
        { $match: { issue: { $in: issueIds } } },
        { $group: { _id: '$issue', total: { $sum: '$weight' } } }
      ]);

      const voteCountMap = voteAgg.reduce((acc, item) => {
        acc[item._id.toString()] = item.total;
        return acc;
      }, {});

      let userVotes = new Set();
      if (session) {
        const rows = await IssueVote.find({ issue: { $in: issueIds }, user: session.user.id }).select('issue').lean();
        userVotes = new Set(rows.map((row) => row.issue.toString()));
      }

      const enriched = issues.map((issue) => withDerivedIssueFields(issue, voteCountMap, userVotes));

      return res.status(200).json({ issues: enriched });
    } catch (error) {
      logger.error('issues_get_failed', { error: error.message, path: req.url });
      return res.status(500).json({ error: 'Failed to fetch issues' });
    }
  }

  if (req.method === 'POST') {
    const bodyAllowed = enforceMaxBodySize(req, res, 256 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['citizen', 'admin', 'agent']);
    if (!session) return;

    const ip = getClientIp(req);
    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'issues_create',
      windowMs: 60_000,
      max: 12,
      id: `${session.user.id}:${ip}`
    });
    if (!allowed) return;

    try {
      const parsed = createIssueSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid issue payload' });
      }

      const rawPayload = {
        ...parsed.data,
        reporter: session.user.id,
        statusHistory: [
          {
            status: 'open',
            note: 'Issue submitted by citizen',
            updatedBy: session.user.id,
            updatedAt: new Date()
          }
        ]
      };

      if (!rawPayload.title) {
        rawPayload.title = rawPayload.category;
      }

      const payload = sanitizeIssueCreatePayload(rawPayload);
      const issue = await Issue.create(payload);

      await enqueueNotificationJob({
        user: session.user.id,
        issue: issue._id,
        type: 'issue_created',
        message: `Your issue \"${issue.title}\" has been submitted successfully.`
      });
      if (Array.isArray(issue.evidenceUrls) && issue.evidenceUrls.length > 0) {
        await Promise.all(
          issue.evidenceUrls.map((assetUrl) =>
            enqueueJob({
              type: 'upload.scan',
              payload: {
                assetUrl,
                issueId: String(issue._id),
                userId: session.user.id
              },
              maxAttempts: 3
            })
          )
        );
        await Promise.all(
          issue.evidenceUrls.map((assetUrl) =>
            enqueueJob({
              type: 'upload.moderate',
              payload: {
                phase: 'issue_created',
                assetUrl,
                issueId: String(issue._id),
                userId: session.user.id
              },
              maxAttempts: 3
            })
          )
        );
      }

      logger.info('issue_created', { issueId: String(issue._id), userId: session.user.id });
      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'issue.created',
        targetType: 'Issue',
        targetId: issue._id,
        metadata: { category: issue.category, constituency: issue.constituency || null }
      });
      return res.status(201).json({ issue });
    } catch (error) {
      logger.error('issue_create_failed', {
        error: error.message,
        userId: session.user.id,
        path: req.url
      });
      return res.status(400).json({ error: error.message || 'Failed to create issue' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

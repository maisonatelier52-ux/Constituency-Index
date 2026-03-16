import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import IssueVote from '@/models/IssueVote';
import Issue from '@/models/Issue';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const bodySchema = z
  .object({
    issueId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid issueId'),
    weight: z.number().int().min(1).max(5).optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const bodyAllowed = enforceMaxBodySize(req, res, 64 * 1024);
  if (!bodyAllowed) return;

  const session = await requireAuth(req, res, ['citizen', 'admin', 'agent']);
  if (!session) return;

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'issue_vote',
    windowMs: 60_000,
    max: 40,
    id: `${session.user.id}:${getClientIp(req)}`
  });
  if (!allowed) return;

  const parsedBody = bodySchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
  }

  const { issueId, weight = 1 } = parsedBody.data;

  try {
    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const existing = await IssueVote.findOne({ issue: issueId, user: session.user.id });

    if (existing) {
      await IssueVote.deleteOne({ _id: existing._id });
      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'issue.vote_removed',
        targetType: 'Issue',
        targetId: issueId
      });
      return res.status(200).json({ voted: false });
    }

    await IssueVote.create({
      issue: issueId,
      user: session.user.id,
      weight: Math.max(1, Math.min(5, Number(weight) || 1))
    });

    await writeAuditLog(req, {
      actorUser: session.user.id,
      action: 'issue.voted',
      targetType: 'Issue',
      targetId: issueId,
      metadata: { weight: Math.max(1, Math.min(5, Number(weight) || 1)) }
    });
    return res.status(200).json({ voted: true });
  } catch (error) {
    logger.error('issue_vote_failed', { error: error.message, userId: session.user.id, issueId });
    return res.status(400).json({ error: 'Failed to update vote' });
  }
}

import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Issue from '@/models/Issue';
import { requireAuth } from '@/lib/apiAuth';
import { sanitizeIssueUpdatePayload } from '@/lib/issueValidation';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { enqueueNotificationJobs } from '@/lib/jobs/enqueue';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const idQuerySchema = z.object({ id: objectIdSchema }).strict();
const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(5).max(5000).optional(),
    location: z.string().trim().max(300).optional().or(z.literal('')),
    locationTags: z.union([z.string(), z.array(z.string())]).optional(),
    evidenceUrls: z.union([z.string(), z.array(z.string())]).optional(),
    constituency: objectIdSchema.optional().or(z.literal('')),
    deadline: z.string().optional().or(z.literal('')),
    status: z.enum(['open', 'in_progress', 'resolved']).optional(),
    statusNote: z.string().trim().max(500).optional(),
    latitude: z.union([z.string(), z.number()]).optional(),
    longitude: z.union([z.string(), z.number()]).optional(),
    geo: z
      .object({
        lat: z.union([z.string(), z.number()]).optional(),
        lng: z.union([z.string(), z.number()]).optional()
      })
      .optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();
  const parsedQuery = idQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid id' });
  }
  const { id } = parsedQuery.data;

  if (req.method === 'GET') {
    try {
      const issue = await Issue.findById(id).populate('reporter').populate('constituency');
      if (!issue) {
        return res.status(404).json({ error: 'Issue not found' });
      }

      return res.status(200).json({ issue });
    } catch (error) {
      logger.error('issue_get_failed', { error: error.message, id });
      return res.status(500).json({ error: 'Failed to fetch issue' });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const bodyAllowed = enforceMaxBodySize(req, res, 256 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin', 'agent']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'issue_update',
      windowMs: 60_000,
      max: 40,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = updateSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    try {
      const existing = await Issue.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Issue not found' });
      }

      const previousStatus = existing.status;
      const previousDeadline = existing.deadline ? new Date(existing.deadline).toISOString() : null;

      const updates = sanitizeIssueUpdatePayload({ ...parsedBody.data });
      if (updates.status && updates.status !== previousStatus) {
        existing.statusHistory.push({
          status: updates.status,
          note: updates.statusNote || `Status updated to ${updates.status}`,
          updatedBy: session.user.id,
          updatedAt: new Date()
        });

        if (updates.status === 'resolved') {
          updates.resolvedAt = new Date();
        }
      }

      Object.assign(existing, updates);
      const issue = await existing.save();

      const notifications = [];
      if (issue.reporter) {
        notifications.push({
          user: issue.reporter,
          issue: issue._id,
          type: 'issue_updated',
          message: `Issue \"${issue.title}\" has been updated.`
        });

        if (updates.status && updates.status !== previousStatus) {
          notifications.push({
            user: issue.reporter,
            issue: issue._id,
            type: 'status_updated',
            message: `Issue \"${issue.title}\" is now marked as ${updates.status.replace('_', ' ')}.`
          });
        }

        const newDeadline = issue.deadline ? new Date(issue.deadline).toISOString() : null;
        if (newDeadline !== previousDeadline) {
          notifications.push({
            user: issue.reporter,
            issue: issue._id,
            type: 'deadline_updated',
            message: `Deadline for issue \"${issue.title}\" is ${newDeadline ? new Date(newDeadline).toDateString() : 'removed'}.`
          });
        }
      }

      if (notifications.length > 0) {
        await enqueueNotificationJobs(notifications);
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'issue.updated',
        targetType: 'Issue',
        targetId: id,
        metadata: { previousStatus, nextStatus: issue.status }
      });
      return res.status(200).json({ issue });
    } catch (error) {
      logger.error('issue_update_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: error.message || 'Failed to update issue' });
    }
  }

  if (req.method === 'DELETE') {
    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    try {
      const issue = await Issue.findByIdAndDelete(id);
      if (!issue) {
        return res.status(404).json({ error: 'Issue not found' });
      }

      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'issue.deleted',
        targetType: 'Issue',
        targetId: id
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('issue_delete_failed', { error: error.message, id, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to delete issue' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

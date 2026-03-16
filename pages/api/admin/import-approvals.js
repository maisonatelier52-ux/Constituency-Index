import { z } from 'zod';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { getImportApprovals, setImportApproval } from '@/lib/importApproval';
import { writeAuditLog } from '@/lib/audit';

const bodySchema = z
  .object({
    dataset: z.enum(['official_constituencies', 'boundaries', 'representatives']),
    approved: z.boolean(),
    note: z.string().trim().max(500).optional()
  })
  .strict();

export default async function handler(req, res) {
  const session = await requireAuth(req, res, ['admin']);
  if (!session) return;

  if (req.method === 'GET') {
    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_import_approvals_get',
      windowMs: 60_000,
      max: 60,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    return res.status(200).json({ approvals: getImportApprovals() });
  }

  if (req.method === 'POST') {
    const bodyAllowed = enforceMaxBodySize(req, res, 32 * 1024);
    if (!bodyAllowed) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'admin_import_approvals_post',
      windowMs: 60_000,
      max: 30,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsed = bodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' });
    }

    const data = parsed.data;
    const approval = setImportApproval(data.dataset, {
      approved: data.approved,
      approvedAt: data.approved ? new Date().toISOString() : null,
      approvedBy: data.approved ? session.user.id : null,
      note: data.note || ''
    });

    await writeAuditLog(req, {
      actorUser: session.user.id,
      action: data.approved ? 'import.approved' : 'import.unapproved',
      targetType: 'Dataset',
      targetId: data.dataset,
      metadata: { note: data.note || '' }
    });

    return res.status(200).json({ approval });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

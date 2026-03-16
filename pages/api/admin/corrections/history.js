import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import { requireAuth } from '@/lib/apiAuth';
import { enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import AuditLog from '@/models/AuditLog';

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional()
  })
  .strict();

async function loadRecentChanges({ page = 1, pageSize = 8 } = {}) {
  await dbConnect();
  const filter = { action: 'corrections.updated', targetType: 'ManualCorrections' };
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).populate('actorUser', 'name email').lean(),
    AuditLog.countDocuments(filter)
  ]);

  return {
    rows: rows.map((row) => ({
      id: String(row._id),
      createdAt: row.createdAt,
      actor: row.actorUser
        ? {
            name: row.actorUser.name || null,
            email: row.actorUser.email || null
          }
        : null,
      metadata: row.metadata || {}
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

export default async function handler(req, res) {
  const session = await requireAuth(req, res, ['admin']);
  if (!session) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query' });
  }

  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'admin_corrections_history_get',
    windowMs: 60_000,
    max: 60,
    id: `${session.user.id}:${getClientIp(req)}`
  });
  if (!allowed) return;

  const result = await loadRecentChanges({
    page: parsedQuery.data.page || 1,
    pageSize: parsedQuery.data.pageSize || 8
  });

  return res.status(200).json({
    recentChanges: result.rows,
    recentChangesPagination: result.pagination
  });
}

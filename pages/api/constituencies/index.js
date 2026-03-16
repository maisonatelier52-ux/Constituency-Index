import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Constituency from '@/models/Constituency';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const querySchema = z
  .object({
    country: z.enum(['IN', 'US']).optional(),
    constituencyType: z.enum(['parliamentary', 'assembly', 'congressional_district', 'senate_statewide']).optional()
  })
  .strict();
const createSchema = z
  .object({
    country: z.enum(['IN', 'US']).optional(),
    name: z.string().trim().min(2).max(200),
    code: z.string().trim().max(100).optional(),
    state: z.string().trim().max(120).optional(),
    constituencyType: z.enum(['parliamentary', 'assembly', 'congressional_district', 'senate_statewide']).optional(),
    profileType: z.enum(['urban', 'rural', 'universal']).optional(),
    representative: objectIdSchema.optional()
  })
  .strict();

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const parsedQuery = querySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query' });
    }

    try {
      const query = {};

      if (parsedQuery.data.country) {
        query.country = parsedQuery.data.country;
      }

      if (parsedQuery.data.constituencyType) {
        query.constituencyType = parsedQuery.data.constituencyType;
      }

      const constituencies = await Constituency.find(query).populate('representative').sort({ createdAt: -1 });
      return res.status(200).json({ constituencies });
    } catch (error) {
      logger.error('constituencies_get_failed', { error: error.message, path: req.url });
      return res.status(500).json({ error: 'Failed to fetch constituencies' });
    }
  }

  if (req.method === 'POST') {
    const bodyAllowed = enforceMaxBodySize(req, res, 256 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'constituencies_create',
      windowMs: 60_000,
      max: 10,
      id: `${session.user.id}:${getClientIp(req)}`
    });
    if (!allowed) return;

    const parsedBody = createSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid payload' });
    }

    try {
      const constituency = await Constituency.create(parsedBody.data);
      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'constituency.created',
        targetType: 'Constituency',
        targetId: constituency._id
      });
      return res.status(201).json({ constituency });
    } catch (error) {
      logger.error('constituency_create_failed', { error: error.message, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to create constituency' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Representative from '@/models/Representative';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { LOCAL_BODY_TYPES, OFFICE_LEVELS, STATUS_TYPES } from '@/lib/politicsScope';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid object id');
const querySchema = z
  .object({
    type: z.enum(['MP', 'MLA']).optional(),
    constituency: objectIdSchema.optional(),
    officeLevel: z.enum(OFFICE_LEVELS).optional(),
    q: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().max(120).optional(),
    district: z.string().trim().max(120).optional(),
    localBodyType: z.enum(LOCAL_BODY_TYPES).optional(),
    localBodyName: z.string().trim().max(160).optional(),
    status: z.enum(STATUS_TYPES).optional()
  })
  .strict();
const createSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    type: z.enum(['MP', 'MLA']),
    officeLevel: z.enum(OFFICE_LEVELS).optional(),
    officeTitle: z.string().trim().max(200).optional(),
    jurisdictionType: z.string().trim().max(80).optional(),
    jurisdictionCode: z.string().trim().max(120).optional(),
    country: z.enum(['IN', 'US']).optional(),
    state: z.string().trim().max(120).optional(),
    district: z.string().trim().max(120).optional(),
    block: z.string().trim().max(120).optional(),
    ward: z.string().trim().max(120).optional(),
    localBodyType: z.enum(LOCAL_BODY_TYPES).optional(),
    localBodyName: z.string().trim().max(160).optional(),
    normalizedName: z.string().trim().max(240).optional(),
    transliteratedName: z.string().trim().max(240).optional(),
    party: z.string().trim().max(120).optional(),
    termStart: z.coerce.date().optional(),
    termEnd: z.coerce.date().optional(),
    sourceUrl: z.string().url().max(500).optional(),
    sourceLastUpdated: z.coerce.date().optional(),
    status: z.enum(STATUS_TYPES).optional(),
    constituency: objectIdSchema.optional(),
    attendanceRate: z.number().min(0).max(100).optional(),
    engagementLevel: z.enum(['low', 'moderate', 'high']).optional(),
    manifesto: z.array(z.string().trim().max(500)).optional(),
    achievements: z.array(z.string().trim().max(500)).optional(),
    ongoingProjects: z.array(z.string().trim().max(500)).optional()
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
      const search = parsedQuery.data.q;

      if (parsedQuery.data.type) {
        query.type = parsedQuery.data.type;
      }

      if (parsedQuery.data.constituency) {
        query.constituency = parsedQuery.data.constituency;
      }
      if (parsedQuery.data.officeLevel) {
        query.officeLevel = parsedQuery.data.officeLevel;
      }
      if (parsedQuery.data.state) {
        query.state = parsedQuery.data.state;
      }
      if (parsedQuery.data.district) {
        query.district = parsedQuery.data.district;
      }
      if (parsedQuery.data.localBodyType) {
        query.localBodyType = parsedQuery.data.localBodyType;
      }
      if (parsedQuery.data.localBodyName) {
        query.localBodyName = parsedQuery.data.localBodyName;
      }
      if (parsedQuery.data.status) {
        query.status = parsedQuery.data.status;
      }
      if (search) {
        const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { name: { $regex: safe, $options: 'i' } },
          { normalizedName: { $regex: safe, $options: 'i' } },
          { transliteratedName: { $regex: safe, $options: 'i' } }
        ];
      }

      const representatives = await Representative.find(query).populate('constituency').sort({ createdAt: -1 });
      return res.status(200).json({ representatives });
    } catch (error) {
      logger.error('representatives_get_failed', { error: error.message, path: req.url });
      return res.status(500).json({ error: 'Failed to fetch representatives' });
    }
  }

  if (req.method === 'POST') {
    const bodyAllowed = enforceMaxBodySize(req, res, 256 * 1024);
    if (!bodyAllowed) return;

    const session = await requireAuth(req, res, ['admin']);
    if (!session) return;

    const allowed = await enforceRateLimit(req, res, {
      keyPrefix: 'representatives_create',
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
      const representative = await Representative.create(parsedBody.data);
      await writeAuditLog(req, {
        actorUser: session.user.id,
        action: 'representative.created',
        targetType: 'Representative',
        targetId: representative._id
      });
      return res.status(201).json({ representative });
    } catch (error) {
      logger.error('representative_create_failed', { error: error.message, userId: session.user.id });
      return res.status(400).json({ error: 'Failed to create representative' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

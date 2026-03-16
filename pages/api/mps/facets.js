import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Representative from '@/models/Representative';
import { logger } from '@/lib/logger';
import { LOCAL_BODY_TYPES, OFFICE_LEVELS, STATUS_TYPES } from '@/lib/politicsScope';

const querySchema = z
  .object({
    officeLevel: z.enum(OFFICE_LEVELS).optional(),
    state: z.string().trim().max(120).optional(),
    district: z.string().trim().max(120).optional(),
    localBodyType: z.enum(LOCAL_BODY_TYPES).optional(),
    status: z.enum(STATUS_TYPES).optional()
  })
  .strict();

function sortStrings(values) {
  return values.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function localBodyFilter(value) {
  if (value) return value;
  return { $exists: true, $ne: 'other' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query' });
  }

  await dbConnect();

  try {
    const { officeLevel, state, district, localBodyType, status } = parsedQuery.data;

    const baseQuery = {};
    if (officeLevel) baseQuery.officeLevel = officeLevel;
    if (state) baseQuery.state = state;
    if (status) baseQuery.status = status;

    const districtQuery = {
      ...baseQuery,
      localBodyType: localBodyFilter(localBodyType)
    };

    const bodyTypeQuery = { ...baseQuery };
    if (district) bodyTypeQuery.district = district;
    bodyTypeQuery.localBodyType = localBodyFilter();

    const bodyNameQuery = { ...baseQuery };
    if (district) bodyNameQuery.district = district;
    bodyNameQuery.localBodyType = localBodyFilter(localBodyType);

    const [districts, localBodyTypes, localBodyNames] = await Promise.all([
      Representative.distinct('district', districtQuery),
      Representative.distinct('localBodyType', bodyTypeQuery),
      Representative.distinct('localBodyName', bodyNameQuery)
    ]);

    return res.status(200).json({
      districts: sortStrings(districts),
      localBodyTypes: sortStrings(localBodyTypes),
      localBodyNames: sortStrings(localBodyNames)
    });
  } catch (error) {
    logger.error('representative_facets_failed', { error: error.message, path: req.url });
    return res.status(500).json({ error: 'Failed to fetch representative facets' });
  }
}

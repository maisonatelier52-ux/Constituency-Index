/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const defaultInput = path.join(process.cwd(), 'data', 'representatives', 'official_representatives.csv');
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
const sourceName = process.env.REP_SOURCE_NAME || 'official';
const skipSourceValidation = String(process.env.SKIP_SOURCE_URL_VALIDATION || 'false') === 'true';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mp-accountability-tracker';

const officeLevels = [
  'union_minister',
  'mp_lok_sabha',
  'mp_rajya_sabha',
  'mla',
  'panchayat_member',
  'municipal_councillor',
  'other_local_representative'
];
const localBodyTypes = ['district_panchayat', 'block_panchayat', 'grama_panchayat', 'municipality', 'corporation', 'other'];
const jurisdictionTypes = ['country', 'state', 'district', 'block', 'panchayat', 'ward', 'constituency', 'municipality', 'other'];
const statusTypes = ['active', 'inactive', 'vacant', 'unknown'];

const RepresentativeSchema = new mongoose.Schema(
  {
    canonicalId: { type: String, trim: true },
    fullName: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['MP', 'MLA'], required: true },
    officeLevel: { type: String, enum: officeLevels, default: 'other_local_representative' },
    officeTitle: { type: String, trim: true },
    jurisdictionType: { type: String, enum: jurisdictionTypes, default: 'constituency' },
    jurisdictionCode: { type: String, trim: true },
    country: { type: String, enum: ['IN', 'US'], default: 'IN' },
    state: { type: String, trim: true },
    district: { type: String, trim: true },
    block: { type: String, trim: true },
    ward: { type: String, trim: true },
    localBodyType: { type: String, enum: localBodyTypes, default: 'other' },
    localBodyName: { type: String, trim: true },
    normalizedName: { type: String, trim: true },
    transliteratedName: { type: String, trim: true },
    party: { type: String, trim: true },
    termStart: { type: Date },
    termEnd: { type: Date },
    sourceUrl: { type: String, trim: true },
    sourceLastUpdated: { type: Date },
    status: { type: String, enum: statusTypes, default: 'active' }
  },
  { timestamps: true }
);

const Representative = mongoose.models.Representative || mongoose.model('Representative', RepresentativeSchema);

const requiredFields = [
  'full_name',
  'office_level',
  'office_title',
  'jurisdiction_type',
  'jurisdiction_code',
  'state',
  'party',
  'term_start',
  'term_end',
  'source_url',
  'source_last_updated',
  'status'
];

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

function loadRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf8');
  if (ext === '.json') {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('JSON representative input must be an array');
    return { rows: data, raw };
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must include header and at least one data row.');
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return headers.reduce((acc, h, idx) => {
      acc[h] = cols[idx] ?? '';
      return acc;
    }, {});
  });
  return { rows, raw };
}

function slugify(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

function canonicalId({ country, officeLevel, jurisdictionCode, fullName }) {
  return `${String(country).toUpperCase()}:${officeLevel}:${String(jurisdictionCode).trim()}:${slugify(fullName) || 'unknown'}`;
}

function toDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeEnum(v, allowed, fallback) {
  const x = String(v || '').trim().toLowerCase();
  return allowed.includes(x) ? x : fallback;
}

function mapType(officeLevel) {
  if (officeLevel.startsWith('mp_')) return 'MP';
  if (officeLevel === 'mla') return 'MLA';
  return 'MLA';
}

function normalize(row) {
  const country = String(row.country || 'IN').trim().toUpperCase() === 'US' ? 'US' : 'IN';
  const fullName = String(row.full_name || row.fullName || row.name || '').trim();
  const officeLevel = normalizeEnum(row.office_level, officeLevels, 'other_local_representative');
  const jurisdictionCode = String(row.jurisdiction_code || '').trim();
  const localBodyType = normalizeEnum(row.local_body_type, localBodyTypes, 'other');
  const localBodyName = String(row.local_body_name || '').trim();
  const normalizedName = String(row.normalized_name || fullName).trim();
  const transliteratedName = String(row.transliterated_name || '').trim();

  return {
    canonicalId: canonicalId({ country, officeLevel, jurisdictionCode, fullName }),
    fullName,
    name: fullName,
    type: mapType(officeLevel),
    officeLevel,
    officeTitle: String(row.office_title || '').trim(),
    jurisdictionType: normalizeEnum(row.jurisdiction_type, jurisdictionTypes, 'other'),
    jurisdictionCode,
    country,
    state: String(row.state || '').trim(),
    district: String(row.district || '').trim(),
    block: String(row.block || '').trim(),
    ward: String(row.ward || '').trim(),
    localBodyType,
    localBodyName,
    normalizedName,
    transliteratedName,
    party: String(row.party || '').trim(),
    termStart: toDate(row.term_start),
    termEnd: toDate(row.term_end),
    sourceUrl: String(row.source_url || '').trim(),
    sourceLastUpdated: toDate(row.source_last_updated),
    status: normalizeEnum(row.status, statusTypes, 'unknown')
  };
}

async function validateSourceUrls(records) {
  const unique = Array.from(new Set(records.map((r) => r.sourceUrl).filter(Boolean)));
  const failures = [];
  for (const url of unique) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) failures.push({ url, status: res.status });
    } catch (_) {
      failures.push({ url, status: 'unreachable' });
    }
  }
  return failures;
}

function missingRequired(record) {
  const map = {
    full_name: record.fullName,
    office_level: record.officeLevel,
    office_title: record.officeTitle,
    jurisdiction_type: record.jurisdictionType,
    jurisdiction_code: record.jurisdictionCode,
    state: record.state,
    party: record.party,
    term_start: record.termStart,
    term_end: record.termEnd,
    source_url: record.sourceUrl,
    source_last_updated: record.sourceLastUpdated,
    status: record.status
  };
  return requiredFields.reduce((acc, key) => {
    const v = map[key];
    const miss = v == null || (typeof v === 'string' && v.trim() === '');
    return acc + (miss ? 1 : 0);
  }, 0);
}

function buildQa(records, sourceFailures) {
  const total = records.length;
  const duplicates = total - new Set(records.map((r) => r.canonicalId)).size;
  const missing = records.reduce((acc, r) => acc + missingRequired(r), 0);
  const nullRate = total > 0 ? (missing / (total * requiredFields.length)) * 100 : 0;
  const invalidDates = records.filter((r) => r.termStart && r.termEnd && r.termStart > r.termEnd).length;
  const badJurisdiction = records.filter((r) => !r.state || !r.jurisdictionType || !r.jurisdictionCode).length;
  const rejectReasons = [];
  if (nullRate > 1) rejectReasons.push(`required-field-null-rate ${nullRate.toFixed(3)}% > 1%`);
  if (duplicates > 0) rejectReasons.push(`duplicate canonical IDs found: ${duplicates}`);
  if (invalidDates > 0) rejectReasons.push(`invalid date ranges: ${invalidDates}`);
  if (badJurisdiction > 0) rejectReasons.push(`missing jurisdiction mapping: ${badJurisdiction}`);
  if (sourceFailures.length > 0) rejectReasons.push(`unreachable source URLs: ${sourceFailures.length}`);
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      records: total,
      duplicateCanonicalIds: duplicates,
      invalidDateRanges: invalidDates,
      badJurisdictionMappings: badJurisdiction
    },
    requiredFieldNullRatePercent: Number(nullRate.toFixed(4)),
    sourceUrlFailures: sourceFailures,
    pass: rejectReasons.length === 0,
    rejectReasons
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function run() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Representative input file not found: ${inputPath}`);
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const { rows, raw } = loadRows(inputPath);
  const normalized = rows.map(normalize);

  const rawDir = path.join(process.cwd(), 'data', 'raw', dateKey, sourceName);
  const normalizedDir = path.join(process.cwd(), 'data', 'normalized', dateKey);
  const publishedDir = path.join(process.cwd(), 'data', 'published', 'current');
  ensureDir(rawDir);
  ensureDir(normalizedDir);
  ensureDir(publishedDir);

  const rawCopyPath = path.join(rawDir, path.basename(inputPath));
  fs.writeFileSync(rawCopyPath, raw, 'utf8');
  const checksum = sha256(raw);
  const normalizedPath = path.join(normalizedDir, `representatives.${sourceName}.normalized.json`);
  fs.writeFileSync(normalizedPath, JSON.stringify(normalized, null, 2), 'utf8');

  const sourceFailures = skipSourceValidation ? [] : await validateSourceUrls(normalized);
  const qa = buildQa(normalized, sourceFailures);
  const qaPath = path.join(normalizedDir, `representatives.${sourceName}.qa.json`);
  fs.writeFileSync(qaPath, JSON.stringify(qa, null, 2), 'utf8');

  const manifest = {
    generatedAt: new Date().toISOString(),
    inputPath,
    rawCopyPath,
    sourceName,
    checksum,
    normalizedPath,
    qaPath
  };
  const manifestPath = path.join(rawDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  if (!qa.pass) {
    console.error('Representative import rejected by QA gate.');
    console.error(JSON.stringify(qa, null, 2));
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const ops = normalized.map((doc) => ({
    updateOne: {
      filter: { canonicalId: doc.canonicalId },
      update: { $set: doc },
      upsert: true
    }
  }));
  const result = await Representative.bulkWrite(ops, { ordered: false });
  await mongoose.disconnect();

  const publishedQaPath = path.join(publishedDir, 'representatives.qa.json');
  fs.writeFileSync(publishedQaPath, JSON.stringify(qa, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(publishedDir, 'representatives.manifest.json'),
    JSON.stringify(
      {
        ...manifest,
        upserted: result.upsertedCount || 0,
        modified: result.modifiedCount || 0,
        matched: result.matchedCount || 0
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('Representative import completed');
  console.log(
    JSON.stringify(
      {
        qaPass: qa.pass,
        requiredFieldNullRatePercent: qa.requiredFieldNullRatePercent,
        duplicates: qa.totals.duplicateCanonicalIds,
        upserted: result.upsertedCount || 0,
        modified: result.modifiedCount || 0,
        matched: result.matchedCount || 0
      },
      null,
      2
    )
  );
}

run().catch(async (error) => {
  console.error(error?.message || error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

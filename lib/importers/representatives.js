import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dbConnect from '@/lib/dbConnect';
import Representative from '@/models/Representative';
import { canPublishDataset } from '@/lib/importApproval';
import {
  OFFICE_LEVELS,
  JURISDICTION_TYPES,
  LOCAL_BODY_TYPES,
  STATUS_TYPES,
  REQUIRED_REPRESENTATIVE_FIELDS,
  buildRepresentativeCanonicalId
} from '@/lib/politicsScope';

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
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
    if (!Array.isArray(data)) throw new Error('JSON representative input must be an array.');
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
    return headers.reduce((acc, header, idx) => {
      acc[header] = cols[idx] ?? '';
      return acc;
    }, {});
  });

  return { rows, raw };
}

function asDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asIsoNow() {
  return new Date().toISOString();
}

function normalizeEnum(value, allowed, fallback) {
  const v = String(value || '').trim().toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function mapLegacyType(officeLevel) {
  if (officeLevel.startsWith('mp_')) return 'MP';
  if (officeLevel === 'mla') return 'MLA';
  return 'MLA';
}

function normalizeRecord(row) {
  const country = String(row.country || 'IN').trim().toUpperCase() === 'US' ? 'US' : 'IN';
  const fullName = String(row.full_name || row.fullName || row.name || '').trim();
  const officeLevel = normalizeEnum(row.office_level, OFFICE_LEVELS, 'other_local_representative');
  const officeTitle = String(row.office_title || '').trim();
  const jurisdictionType = normalizeEnum(row.jurisdiction_type, JURISDICTION_TYPES, 'other');
  const jurisdictionCode = String(row.jurisdiction_code || '').trim();
  const status = normalizeEnum(row.status, STATUS_TYPES, 'unknown');
  const state = String(row.state || '').trim();
  const localBodyType = normalizeEnum(row.local_body_type, LOCAL_BODY_TYPES, 'other');
  const localBodyName = String(row.local_body_name || '').trim();
  const termStart = asDate(row.term_start);
  const termEnd = asDate(row.term_end);
  const sourceUrl = String(row.source_url || '').trim();
  const sourceLastUpdated = asDate(row.source_last_updated);
  const normalizedName = String(row.normalized_name || fullName).trim();
  const transliteratedName = String(row.transliterated_name || '').trim();

  const canonicalId = buildRepresentativeCanonicalId({
    country,
    officeLevel,
    jurisdictionCode,
    fullName
  });

  return {
    canonicalId,
    fullName,
    name: fullName,
    type: mapLegacyType(officeLevel),
    officeLevel,
    officeTitle,
    jurisdictionType,
    jurisdictionCode,
    country,
    state,
    district: String(row.district || '').trim(),
    block: String(row.block || '').trim(),
    ward: String(row.ward || '').trim(),
    localBodyType,
    localBodyName,
    normalizedName,
    transliteratedName,
    party: String(row.party || '').trim(),
    termStart,
    termEnd,
    sourceUrl,
    sourceLastUpdated,
    status
  };
}

async function checkSourceUrls(records) {
  const uniqueUrls = Array.from(new Set(records.map((r) => r.sourceUrl).filter(Boolean)));
  const failures = [];
  for (const url of uniqueUrls) {
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

function requiredFieldMissCount(record) {
  return REQUIRED_REPRESENTATIVE_FIELDS.reduce((acc, key) => {
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
    const v = map[key];
    const missing = v == null || (typeof v === 'string' && v.trim() === '');
    return acc + (missing ? 1 : 0);
  }, 0);
}

function buildQa(records, sourceUrlFailures) {
  const total = records.length;
  const duplicateCount = total - new Set(records.map((r) => r.canonicalId)).size;
  const nullMissing = records.reduce((acc, r) => acc + requiredFieldMissCount(r), 0);
  const requiredTotalCells = total * REQUIRED_REPRESENTATIVE_FIELDS.length;
  const nullRate = requiredTotalCells > 0 ? (nullMissing / requiredTotalCells) * 100 : 0;
  const invalidDateRanges = records.filter((r) => r.termStart && r.termEnd && r.termStart > r.termEnd).length;
  const badJurisdiction = records.filter((r) => !r.state || !r.jurisdictionCode || !r.jurisdictionType).length;

  const rejectReasons = [];
  if (nullRate > 1) rejectReasons.push(`required-field-null-rate ${nullRate.toFixed(3)}% > 1%`);
  if (duplicateCount > 0) rejectReasons.push(`duplicate canonical IDs found: ${duplicateCount}`);
  if (invalidDateRanges > 0) rejectReasons.push(`invalid date ranges: ${invalidDateRanges}`);
  if (badJurisdiction > 0) rejectReasons.push(`missing jurisdiction mapping: ${badJurisdiction}`);
  if (sourceUrlFailures.length > 0) rejectReasons.push(`unreachable source URLs: ${sourceUrlFailures.length}`);

  return {
    generatedAt: asIsoNow(),
    totals: {
      records: total,
      duplicateCanonicalIds: duplicateCount,
      invalidDateRanges,
      badJurisdictionMappings: badJurisdiction
    },
    requiredFieldNullRatePercent: Number(nullRate.toFixed(4)),
    sourceUrlFailures,
    pass: rejectReasons.length === 0,
    rejectReasons
  };
}

function signQa(qa) {
  const secret = process.env.QA_SIGNING_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(JSON.stringify(qa)).digest('hex');
}

export async function importRepresentativesPipeline(inputPath, opts = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Representative input file not found: ${inputPath}`);
  }

  const dateKey = opts.dateKey || new Date().toISOString().slice(0, 10);
  const sourceName = opts.sourceName || 'official';
  const { rows, raw } = loadRows(inputPath);

  const rawDir = path.join(process.cwd(), 'data', 'raw', dateKey, sourceName);
  const normalizedDir = path.join(process.cwd(), 'data', 'normalized', dateKey);
  const publishedDir = path.join(process.cwd(), 'data', 'published', 'current');
  ensureDir(rawDir);
  ensureDir(normalizedDir);
  ensureDir(publishedDir);

  const rawCopyPath = path.join(rawDir, path.basename(inputPath));
  fs.writeFileSync(rawCopyPath, raw, 'utf8');
  const checksum = sha256(raw);

  const normalized = rows.map(normalizeRecord);
  const normalizedPath = path.join(normalizedDir, `representatives.${sourceName}.normalized.json`);
  fs.writeFileSync(normalizedPath, JSON.stringify(normalized, null, 2), 'utf8');

  const sourceUrlFailures = opts.skipSourceValidation ? [] : await checkSourceUrls(normalized);
  const qa = buildQa(normalized, sourceUrlFailures);
  const qaSignature = signQa(qa);
  const qaOut = { ...qa, signature: qaSignature };

  const qaPath = path.join(normalizedDir, `representatives.${sourceName}.qa.json`);
  fs.writeFileSync(qaPath, JSON.stringify(qaOut, null, 2), 'utf8');

  const manifest = {
    generatedAt: asIsoNow(),
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
    return {
      ok: false,
      stage: 'validate',
      qa: qaOut,
      manifestPath
    };
  }

  await dbConnect();
  const ops = normalized.map((doc) => ({
    updateOne: {
      filter: { canonicalId: doc.canonicalId },
      update: { $set: doc },
      upsert: true
    }
  }));
  const result = await Representative.bulkWrite(ops, { ordered: false });

  const publishDecision = canPublishDataset('representatives', qaOut);
  if (publishDecision.allowed) {
    const publishedQaPath = path.join(publishedDir, 'representatives.qa.json');
    fs.writeFileSync(publishedQaPath, JSON.stringify(qaOut, null, 2), 'utf8');
    const publishedManifestPath = path.join(publishedDir, 'representatives.manifest.json');
    fs.writeFileSync(
      publishedManifestPath,
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
  }

  return {
    ok: true,
    qa: qaOut,
    manifestPath,
    publish: publishDecision,
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
    matched: result.matchedCount || 0
  };
}

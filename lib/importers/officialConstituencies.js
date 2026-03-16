import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dbConnect from '@/lib/dbConnect';
import Constituency from '@/models/Constituency';
import { canPublishDataset } from '@/lib/importApproval';

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
    if (!Array.isArray(data)) throw new Error('JSON input must be an array of constituency records.');
    return { rows: data, raw };
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV must include header and at least one data row.');
  }

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

function normalizeType(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['parliamentary', 'pc', 'lok_sabha', 'lok sabha'].includes(v)) return 'parliamentary';
  if (['assembly', 'ac', 'vidhan_sabha', 'vidhan sabha'].includes(v)) return 'assembly';
  if (['congressional_district', 'house_district', 'us_house'].includes(v)) return 'congressional_district';
  if (['senate_statewide', 'us_senate'].includes(v)) return 'senate_statewide';
  return null;
}

function normalizeProfileType(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'urban' || v === 'rural' || v === 'universal') return v;
  return 'universal';
}

function normalizeCountry(value) {
  const v = String(value || 'IN').trim().toUpperCase();
  return v === 'US' ? 'US' : 'IN';
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function validateAndNormalize(row, index) {
  const name = String(row.name || '').trim();
  const code = String(row.code || '').trim();
  const state = String(row.state || '').trim();
  const constituencyType = normalizeType(row.constituencyType);

  if (!name || !code || !state || !constituencyType) {
    throw new Error(
      `Invalid row ${index + 2}: required fields are name, code, state, constituencyType(parliamentary|assembly|congressional_district|senate_statewide).`
    );
  }

  return {
    country: normalizeCountry(row.country),
    name,
    code,
    state,
    constituencyType,
    profileType: normalizeProfileType(row.profileType),
    indexMetrics: {
      promises: toNum(row.promises),
      infrastructure: toNum(row.infrastructure),
      welfare: toNum(row.welfare),
      employment: toNum(row.employment),
      education: toNum(row.education),
      healthcare: toNum(row.healthcare),
      environment: toNum(row.environment)
    }
  };
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildQa(docs) {
  const duplicates = docs.length - new Set(docs.map((doc) => doc.code)).size;
  const missing = docs.reduce((acc, doc) => {
    return acc + (!doc.name ? 1 : 0) + (!doc.code ? 1 : 0) + (!doc.state ? 1 : 0) + (!doc.constituencyType ? 1 : 0);
  }, 0);
  const totalRequired = docs.length * 4;
  const nullRate = totalRequired > 0 ? (missing / totalRequired) * 100 : 0;
  const rejectReasons = [];
  if (duplicates > 0) rejectReasons.push(`duplicate codes found: ${duplicates}`);
  if (nullRate > 1) rejectReasons.push(`required-field-null-rate ${nullRate.toFixed(3)}% > 1%`);

  return {
    generatedAt: new Date().toISOString(),
    dataset: 'official_constituencies',
    totals: {
      records: docs.length,
      duplicateCodes: duplicates
    },
    requiredFieldNullRatePercent: Number(nullRate.toFixed(4)),
    pass: rejectReasons.length === 0,
    rejectReasons
  };
}

export async function importOfficialConstituencies(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const { rows, raw } = loadRows(inputPath);
  const docs = rows.map(validateAndNormalize);
  const rawDir = path.join(process.cwd(), 'data', 'raw', dateKey, 'official_constituencies');
  const normalizedDir = path.join(process.cwd(), 'data', 'normalized', dateKey);
  const publishedDir = path.join(process.cwd(), 'data', 'published', 'current');
  ensureDir(rawDir);
  ensureDir(normalizedDir);
  ensureDir(publishedDir);

  const rawCopyPath = path.join(rawDir, path.basename(inputPath));
  fs.writeFileSync(rawCopyPath, raw, 'utf8');
  const checksum = sha256(raw);
  const normalizedPath = path.join(normalizedDir, 'official_constituencies.normalized.json');
  fs.writeFileSync(normalizedPath, JSON.stringify(docs, null, 2), 'utf8');

  const qa = buildQa(docs);
  const qaPath = path.join(normalizedDir, 'official_constituencies.qa.json');
  fs.writeFileSync(qaPath, JSON.stringify(qa, null, 2), 'utf8');

  const manifest = {
    generatedAt: new Date().toISOString(),
    dataset: 'official_constituencies',
    sourceName: 'official_constituencies',
    inputPath,
    rawCopyPath,
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
      qa,
      manifestPath
    };
  }

  await dbConnect();

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { code: doc.code },
      update: { $set: doc },
      upsert: true
    }
  }));

  const result = await Constituency.bulkWrite(ops, { ordered: false });
  const publishDecision = canPublishDataset('official_constituencies', qa);
  if (publishDecision.allowed) {
    fs.writeFileSync(path.join(publishedDir, 'official_constituencies.qa.json'), JSON.stringify(qa, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(publishedDir, 'official_constituencies.manifest.json'),
      JSON.stringify(
        {
          ...manifest,
          upserted: result.upsertedCount || 0,
          modified: result.modifiedCount || 0
        },
        null,
        2
      ),
      'utf8'
    );
  }

  return {
    ok: true,
    inputPath,
    manifestPath,
    qa,
    publish: publishDecision,
    processed: docs.length,
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0
  };
}

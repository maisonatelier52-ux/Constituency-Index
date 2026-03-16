/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const defaultInput = path.join(process.cwd(), 'data', 'constituencies', 'official_constituencies.csv');
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mp-accountability-tracker';

const ConstituencySchema = new mongoose.Schema(
  {
    country: { type: String, enum: ['IN', 'US'], default: 'IN' },
    name: { type: String, required: true },
    code: { type: String, required: true },
    state: { type: String, required: true },
    constituencyType: {
      type: String,
      enum: ['parliamentary', 'assembly', 'congressional_district', 'senate_statewide'],
      required: true
    },
    profileType: { type: String, enum: ['urban', 'rural', 'universal'], default: 'universal' },
    indexMetrics: {
      promises: { type: Number, default: 0 },
      infrastructure: { type: Number, default: 0 },
      welfare: { type: Number, default: 0 },
      employment: { type: Number, default: 0 },
      education: { type: Number, default: 0 },
      healthcare: { type: Number, default: 0 },
      environment: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

const Constituency = mongoose.models.Constituency || mongoose.model('Constituency', ConstituencySchema);

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
    return data;
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV must include header and at least one data row.');
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return headers.reduce((acc, header, idx) => {
      acc[header] = cols[idx] ?? '';
      return acc;
    }, {});
  });
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

async function run() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const rows = loadRows(inputPath);
  const docs = rows.map(validateAndNormalize);

  await mongoose.connect(MONGODB_URI);

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { code: doc.code },
      update: { $set: doc },
      upsert: true
    }
  }));

  const result = await Constituency.bulkWrite(ops, { ordered: false });

  console.log('Official constituency import completed');
  console.log(`Input file: ${inputPath}`);
  console.log(`Rows processed: ${docs.length}`);
  console.log(`Upserted: ${result.upsertedCount || 0}`);
  console.log(`Modified: ${result.modifiedCount || 0}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

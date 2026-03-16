/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const defaultInput = path.join(process.cwd(), 'data', 'constituencies', 'boundaries.geojson');
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mp-accountability-tracker';
const codeField = process.env.BOUNDARY_CODE_FIELD || 'code';
const nameField = process.env.BOUNDARY_NAME_FIELD || 'name';

const ConstituencySchema = new mongoose.Schema(
  {
    name: String,
    code: String,
    geoBoundary: {
      type: {
        type: String,
        enum: ['Polygon', 'MultiPolygon']
      },
      coordinates: Array
    },
    centroid: {
      lat: Number,
      lng: Number
    }
  },
  { timestamps: true }
);

const Constituency = mongoose.models.Constituency || mongoose.model('Constituency', ConstituencySchema);

function flattenCoordinates(coords, acc = []) {
  if (!Array.isArray(coords)) return acc;
  if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    acc.push(coords);
    return acc;
  }

  for (const entry of coords) {
    flattenCoordinates(entry, acc);
  }

  return acc;
}

function computeCentroid(geometry) {
  const points = flattenCoordinates(geometry?.coordinates || []);
  if (points.length === 0) return null;

  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of points) {
    sumLng += Number(lng);
    sumLat += Number(lat);
  }

  return {
    lat: Number((sumLat / points.length).toFixed(6)),
    lng: Number((sumLng / points.length).toFixed(6))
  };
}

async function run() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`GeoJSON file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const geojson = JSON.parse(raw);

  if (geojson?.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Input must be a GeoJSON FeatureCollection');
  }

  await mongoose.connect(MONGODB_URI);

  let updated = 0;
  let skipped = 0;

  for (const feature of geojson.features) {
    const geometry = feature?.geometry;
    const props = feature?.properties || {};

    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
      skipped += 1;
      continue;
    }

    const code = String(props[codeField] || '').trim();
    const name = String(props[nameField] || '').trim();

    if (!code && !name) {
      skipped += 1;
      continue;
    }

    const centroid = computeCentroid(geometry);

    const filter = code ? { code } : { name };
    const result = await Constituency.updateOne(
      filter,
      {
        $set: {
          geoBoundary: geometry,
          centroid
        }
      }
    );

    if (result.modifiedCount > 0 || result.matchedCount > 0) {
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log('Boundary import completed');
  console.log(`Input: ${inputPath}`);
  console.log(`Updated/matched: ${updated}`);
  console.log(`Skipped: ${skipped}`);

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

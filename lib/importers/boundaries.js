import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dbConnect from '@/lib/dbConnect';
import Constituency from '@/models/Constituency';
import { canPublishDataset } from '@/lib/importApproval';

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

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export async function importConstituencyBoundaries(inputPath, options = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`GeoJSON file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const geojson = JSON.parse(raw);
  const codeField = options.codeField || process.env.BOUNDARY_CODE_FIELD || 'code';
  const nameField = options.nameField || process.env.BOUNDARY_NAME_FIELD || 'name';

  if (geojson?.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Input must be a GeoJSON FeatureCollection');
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const rawDir = path.join(process.cwd(), 'data', 'raw', dateKey, 'boundaries');
  const normalizedDir = path.join(process.cwd(), 'data', 'normalized', dateKey);
  const publishedDir = path.join(process.cwd(), 'data', 'published', 'current');
  ensureDir(rawDir);
  ensureDir(normalizedDir);
  ensureDir(publishedDir);

  const rawCopyPath = path.join(rawDir, path.basename(inputPath));
  fs.writeFileSync(rawCopyPath, raw, 'utf8');
  const checksum = sha256(raw);

  await dbConnect();

  let updated = 0;
  let skipped = 0;
  let invalidGeometry = 0;
  let missingIdentifier = 0;

  for (const feature of geojson.features) {
    const geometry = feature?.geometry;
    const props = feature?.properties || {};

    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
      skipped += 1;
      invalidGeometry += 1;
      continue;
    }

    const code = String(props[codeField] || '').trim();
    const name = String(props[nameField] || '').trim();

    if (!code && !name) {
      skipped += 1;
      missingIdentifier += 1;
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

    if (result.modifiedCount > 0 || result.matchedCount > 0) updated += 1;
    else skipped += 1;
  }

  const qa = {
    generatedAt: new Date().toISOString(),
    dataset: 'boundaries',
    totals: {
      features: geojson.features.length,
      updated,
      skipped,
      invalidGeometry,
      missingIdentifier
    },
    pass: invalidGeometry === 0 && missingIdentifier === 0,
    rejectReasons: [
      ...(invalidGeometry > 0 ? [`invalid geometries: ${invalidGeometry}`] : []),
      ...(missingIdentifier > 0 ? [`features missing code/name: ${missingIdentifier}`] : [])
    ]
  };
  const qaPath = path.join(normalizedDir, 'boundaries.qa.json');
  fs.writeFileSync(qaPath, JSON.stringify(qa, null, 2), 'utf8');
  const manifest = {
    generatedAt: new Date().toISOString(),
    dataset: 'boundaries',
    sourceName: 'boundaries',
    inputPath,
    rawCopyPath,
    checksum,
    qaPath
  };
  const manifestPath = path.join(rawDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  const publishDecision = canPublishDataset('boundaries', qa);
  if (publishDecision.allowed) {
    fs.writeFileSync(path.join(publishedDir, 'boundaries.qa.json'), JSON.stringify(qa, null, 2), 'utf8');
    fs.writeFileSync(path.join(publishedDir, 'boundaries.manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  }

  return {
    ok: qa.pass,
    inputPath,
    manifestPath,
    qa,
    publish: publishDecision,
    updated,
    skipped
  };
}

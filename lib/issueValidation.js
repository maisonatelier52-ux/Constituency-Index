function parseDelimitedInput(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value !== 'string') return [];

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function validateEvidenceUrls(urls) {
  const list = parseDelimitedInput(urls);
  const invalid = list.filter((url) => !isHttpUrl(url));
  if (invalid.length > 0) {
    throw new Error(`Invalid evidence URL(s): ${invalid.slice(0, 3).join(', ')}`);
  }

  return list;
}

function normalizeGeo({ latitude, longitude, geo } = {}) {
  let lat = latitude;
  let lng = longitude;

  if (geo && typeof geo === 'object') {
    lat = geo.lat;
    lng = geo.lng;
  }

  const latNum = lat === '' || lat == null ? null : Number(lat);
  const lngNum = lng === '' || lng == null ? null : Number(lng);

  if ((latNum == null && lngNum != null) || (latNum != null && lngNum == null)) {
    throw new Error('Both latitude and longitude are required when geo coordinates are provided.');
  }

  if (latNum == null && lngNum == null) {
    return null;
  }

  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    throw new Error('Latitude/longitude must be valid numbers.');
  }

  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    throw new Error('Latitude must be between -90 and 90, longitude between -180 and 180.');
  }

  return { lat: latNum, lng: lngNum };
}

export function sanitizeIssueCreatePayload(input) {
  const payload = { ...input };

  payload.locationTags = parseDelimitedInput(payload.locationTags);
  payload.evidenceUrls = validateEvidenceUrls(payload.evidenceUrls);

  const geo = normalizeGeo(payload);
  if (geo) payload.geo = geo;

  delete payload.latitude;
  delete payload.longitude;

  return payload;
}

export function sanitizeIssueUpdatePayload(input) {
  const updates = { ...input };

  if (Object.prototype.hasOwnProperty.call(updates, 'evidenceUrls')) {
    updates.evidenceUrls = validateEvidenceUrls(updates.evidenceUrls);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'locationTags')) {
    updates.locationTags = parseDelimitedInput(updates.locationTags);
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, 'latitude') ||
    Object.prototype.hasOwnProperty.call(updates, 'longitude') ||
    Object.prototype.hasOwnProperty.call(updates, 'geo')
  ) {
    const geo = normalizeGeo(updates);
    if (geo) updates.geo = geo;
    else if (Object.prototype.hasOwnProperty.call(updates, 'geo')) updates.geo = null;

    delete updates.latitude;
    delete updates.longitude;
  }

  return updates;
}

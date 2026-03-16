const geocodeCache = globalThis.__geocodeCache || new Map();
globalThis.__geocodeCache = geocodeCache;

const CACHE_TTL_MS = 1000 * 60 * 30;

function normalizeCountry(country) {
  return String(country || 'IN').toUpperCase() === 'US' ? 'US' : 'IN';
}

function cacheKey(parts) {
  return parts.map((p) => String(p || '').trim().toLowerCase()).join('::');
}

function getCached(key) {
  const item = geocodeCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    geocodeCache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value) {
  geocodeCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function toAddress(address = {}) {
  return {
    state: address.state || '',
    state_district: address.state_district || address.county || '',
    county: address.county || '',
    city: address.city || address.town || address.municipality || '',
    town: address.town || '',
    municipality: address.municipality || '',
    suburb: address.suburb || address.neighbourhood || '',
    neighbourhood: address.neighbourhood || '',
    village: address.village || address.hamlet || '',
    hamlet: address.hamlet || '',
    postcode: address.postcode || ''
  };
}

function countryCode(country) {
  return normalizeCountry(country) === 'US' ? 'us' : 'in';
}

async function safeJsonFetch(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'mp-accountability-tracker/1.0'
    }
  });

  if (!res.ok) {
    throw new Error(`Geocode provider failed: ${res.status}`);
  }

  return res.json();
}

async function postalByNominatim({ country, postalCode }) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=${countryCode(
    country
  )}&postalcode=${encodeURIComponent(postalCode)}`;

  const rows = await safeJsonFetch(url);
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    provider: 'nominatim',
    address: toAddress(row.address || {}),
    coords: { lat: Number(row.lat), lng: Number(row.lon) }
  };
}

async function postalByPhoton({ country, postalCode }) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(`${postalCode} ${normalizeCountry(country)}`)}&limit=1`;
  const payload = await safeJsonFetch(url);
  const feature = payload?.features?.[0];
  if (!feature?.geometry?.coordinates) {
    return null;
  }

  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties || {};

  return {
    provider: 'photon',
    address: toAddress({
      state: props.state,
      county: props.county,
      city: props.city || props.town,
      town: props.town,
      suburb: props.suburb,
      village: props.village,
      postcode: props.postcode
    }),
    coords: { lat: Number(lat), lng: Number(lng) }
  };
}

async function reverseByNominatim({ lat, lng }) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const payload = await safeJsonFetch(url);
  return {
    provider: 'nominatim',
    address: toAddress(payload?.address || {}),
    coords: { lat: Number(lat), lng: Number(lng) }
  };
}

async function reverseByPhoton({ lat, lng }) {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`;
  const payload = await safeJsonFetch(url);
  const feature = payload?.features?.[0];
  const props = feature?.properties || {};
  return {
    provider: 'photon',
    address: toAddress({
      state: props.state,
      county: props.county,
      city: props.city || props.town,
      town: props.town,
      suburb: props.suburb,
      village: props.village,
      postcode: props.postcode
    }),
    coords: { lat: Number(lat), lng: Number(lng) }
  };
}

async function tryProviders(handlers) {
  for (const handler of handlers) {
    try {
      const result = await handler();
      if (result) return result;
    } catch (_) {
      // try next provider
    }
  }
  return null;
}

export async function geocodeByPostalCode({ country, postalCode }) {
  const normalizedCountry = normalizeCountry(country);
  const normalizedPostalCode = String(postalCode || '').trim();
  const key = cacheKey(['postal', normalizedCountry, normalizedPostalCode]);
  const cached = getCached(key);
  if (cached) return cached;

  const result = await tryProviders([
    () => postalByNominatim({ country: normalizedCountry, postalCode: normalizedPostalCode }),
    () => postalByPhoton({ country: normalizedCountry, postalCode: normalizedPostalCode })
  ]);

  if (!result) {
    throw new Error('Geocode lookup failed');
  }

  setCached(key, result);
  return result;
}

export async function reverseGeocode({ lat, lng }) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const key = cacheKey(['reverse', latNum.toFixed(5), lngNum.toFixed(5)]);
  const cached = getCached(key);
  if (cached) return cached;

  const result = await tryProviders([
    () => reverseByNominatim({ lat: latNum, lng: lngNum }),
    () => reverseByPhoton({ lat: latNum, lng: lngNum })
  ]);

  if (!result) {
    throw new Error('Reverse geocode failed');
  }

  setCached(key, result);
  return result;
}

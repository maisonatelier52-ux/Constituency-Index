import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

const STORAGE_KEY = 'location_onboarding_v1';

function buildHierarchy(address) {
  if (!address) return [];

  const state = address.state || '';
  const district = address.state_district || address.county || '';
  const town = address.city || address.town || address.municipality || '';
  const suburb = address.suburb || address.neighbourhood || '';
  const village = address.village || address.hamlet || '';

  return [
    { key: 'state', label: state },
    { key: 'district', label: district },
    { key: 'town', label: town },
    { key: 'suburb', label: suburb },
    { key: 'village', label: village }
  ].filter((item) => item.label);
}

export default function LocationOnboardingModal() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const [country, setCountry] = useState('US');
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState(null);
  const [coords, setCoords] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [intent, setIntent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const closeAndSave = useCallback(() => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      country,
      postalCode,
      intent,
      filters: activeFilters,
      bestCandidateId: candidates[0]?._id || null,
      updatedAt: new Date().toISOString()
    })
  );
  setVisible(false);
}, [activeFilters, candidates, country, intent, postalCode]);

useEffect(() => {
  if (!visible) return undefined;

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      closeAndSave();
    }
  }

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [visible, closeAndSave]);

  useEffect(() => {
    if (router.pathname === '/auth/signin') return;
    const done = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : '1';
    if (!done) {
      setVisible(true);
    }
  }, [router.pathname]);

  useEffect(() => {
    if (!visible) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        closeAndSave();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, closeAndSave]);

  const hierarchy = useMemo(() => buildHierarchy(address), [address]);

  async function resolveConstituency({ locAddress, locCoords, filters }) {
    const params = new URLSearchParams();
    params.set('country', country);

    const source = filters || {};
    if (source.state) params.set('state', source.state);
    if (source.district) params.set('district', source.district);
    if (source.town) params.set('town', source.town);
    if (source.suburb) params.set('suburb', source.suburb);
    if (source.village) params.set('village', source.village);

    if (locCoords?.lat != null && locCoords?.lng != null) {
      params.set('lat', String(locCoords.lat));
      params.set('lng', String(locCoords.lng));
    }

    const res = await fetch(`/api/constituencies/resolve?${params.toString()}`);
    if (!res.ok) {
      throw new Error('Could not resolve constituency candidates');
    }

    const payload = await res.json();
    setCandidates(payload.candidates || []);

    if (locAddress) {
      setAddress(locAddress);
    }
  }

  async function searchByPostalCode() {
    if (!postalCode.trim()) {
      setError('Enter ZIP/PIN code first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('mode', 'postal');
      params.set('country', country);
      params.set('postalCode', postalCode.trim());

      const res = await fetch(`/api/geocode/lookup?${params.toString()}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Location not found for this ZIP/PIN.');
      }

      const payload = await res.json();
      const locAddress = payload.address || {};
      const locCoords = payload.coords || null;
      if (!locCoords || !Number.isFinite(locCoords.lat) || !Number.isFinite(locCoords.lng)) {
        throw new Error('Location not found for this ZIP/PIN.');
      }

      setAddress(locAddress);
      setCoords(locCoords);
      const filters = {
        state: locAddress.state || '',
        district: locAddress.state_district || locAddress.county || '',
        town: locAddress.city || locAddress.town || locAddress.municipality || '',
        suburb: locAddress.suburb || locAddress.neighbourhood || '',
        village: locAddress.village || locAddress.hamlet || ''
      };
      setActiveFilters(filters);

      await resolveConstituency({ locAddress, locCoords, filters });
    } catch (e) {
      setError(e.message || 'Could not fetch location by ZIP/PIN.');
    } finally {
      setLoading(false);
    }
  }

  async function detectMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const locCoords = { lat, lng };
          setCoords(locCoords);

          const params = new URLSearchParams();
          params.set('mode', 'reverse');
          params.set('lat', String(lat));
          params.set('lng', String(lng));
          const res = await fetch(`/api/geocode/lookup?${params.toString()}`);
          if (!res.ok) {
            throw new Error('Could not reverse geocode your location.');
          }
          const payload = await res.json();
          const locAddress = payload.address || {};

          setAddress(locAddress);

          const filters = {
            state: locAddress.state || '',
            district: locAddress.state_district || locAddress.county || '',
            town: locAddress.city || locAddress.town || locAddress.municipality || '',
            suburb: locAddress.suburb || locAddress.neighbourhood || '',
            village: locAddress.village || locAddress.hamlet || ''
          };
          setActiveFilters(filters);

          await resolveConstituency({ locAddress, locCoords, filters });
        } catch (e) {
          setError('Could not reverse geocode your location.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError('Location permission denied or unavailable.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function narrowWith(item) {
    const next = { ...activeFilters, [item.key]: item.label };
    setActiveFilters(next);

    try {
      setLoading(true);
      setError('');
      await resolveConstituency({ locAddress: address, locCoords: coords, filters: next });
    } catch (e) {
      setError(e.message || 'Could not narrow constituency list.');
    } finally {
      setLoading(false);
    }
  }


  function openConstituency(candidate) {
    closeAndSave();

    if (country === 'US') {
      router.push(`/us/constituencies/${candidate._id}`);
    } else {
      router.push(`/constituencies/${candidate._id}`);
    }
  }

  if (!visible) return null;

  const residentLabel = activeFilters.state ? `I'm a resident of ${activeFilters.state}` : "I'm a resident of _________";

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeAndSave();
        }
      }}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-onboarding-title"
      >
        <h2 id="location-onboarding-title" className="text-2xl font-bold mb-4">
          Find Your Constituency
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="location-country">
              Country
            </label>
            <select
              id="location-country"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setAddress(null);
                setCandidates([]);
                setActiveFilters({});
              }}
            >
              <option value="US">United States</option>
              <option value="IN">India</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="location-postal-code">
              Enter ZIP/PIN Code
            </label>
            <div className="flex gap-2">
              <input
                id="location-postal-code"
                aria-label={country === 'US' ? 'ZIP code' : 'PIN code'}
                className="flex-1 border border-gray-300 rounded px-3 py-2"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder={country === 'US' ? 'e.g., 10001' : 'e.g., 682001'}
              />
              <button
                type="button"
                className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={searchByPostalCode}
                disabled={loading}
              >
                Search
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <button
            type="button"
            className="text-sm text-blue-700 hover:text-blue-800 underline"
            onClick={detectMyLocation}
            disabled={loading}
          >
            Find location data automatically
          </button>
        </div>

        {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}

        {address ? (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-sm font-medium mb-2">Detected location hierarchy (click to narrow):</p>
            <div className="flex flex-wrap gap-2">
              {hierarchy.map((item) => (
                <button
                  key={`${item.key}-${item.label}`}
                  type="button"
                  className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-sm"
                  onClick={() => narrowWith(item)}
                >
                  {item.key}: {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <p className="text-sm font-medium mb-2">(Check one only)</p>
          <div className="space-y-2">
            {["I'm a citizen who has a valid voting ID?", residentLabel, 'Help me vote in the next election'].map(
              (label) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={intent === label}
                    onChange={() => setIntent((prev) => (prev === label ? '' : label))}
                    aria-label={label}
                  />
                  <span>{label}</span>
                </label>
              )
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Closest constituency suggestions:</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {candidates.map((c) => (
              <button
                key={c._id}
                type="button"
                className="w-full text-left px-3 py-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                onClick={() => openConstituency(c)}
              >
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-gray-600">
                  {c.code} | {c.state} | {c.constituencyType}
                  {c.distanceKm != null ? ` | ${c.distanceKm} km` : ''}
                </p>
              </button>
            ))}
            {candidates.length === 0 ? <p className="text-sm text-gray-500">No suggestions yet.</p> : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={closeAndSave} className="px-4 py-2 rounded border border-gray-300">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

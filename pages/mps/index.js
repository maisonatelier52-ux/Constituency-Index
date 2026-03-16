import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { t } from '@/lib/i18n';
import { OFFICE_LEVELS } from '@/lib/politicsScope';

const fetcher = (url) => fetch(url).then((res) => res.json());

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text, query, className = 'bg-amber-100 text-amber-950 rounded px-0.5') {
  if (!text) return null;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return text;

  const regex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'ig');
  const parts = text.split(regex);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`} className={className}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export default function RepresentativesPage() {
  const router = useRouter();
  const officeLevel = typeof router.query.officeLevel === 'string' ? router.query.officeLevel : '';
  const searchQuery = typeof router.query.q === 'string' ? router.query.q : '';
  const district = typeof router.query.district === 'string' ? router.query.district : '';
  const localBodyType = typeof router.query.localBodyType === 'string' ? router.query.localBodyType : '';
  const qs = new URLSearchParams();
  if (officeLevel) qs.set('officeLevel', officeLevel);
  if (searchQuery) qs.set('q', searchQuery);
  if (district) qs.set('district', district);
  if (localBodyType) qs.set('localBodyType', localBodyType);
  const apiUrl = `/api/mps${qs.toString() ? `?${qs.toString()}` : ''}`;
  const facetQs = new URLSearchParams();
  facetQs.set('state', 'Kerala');
  if (officeLevel) facetQs.set('officeLevel', officeLevel);
  if (district) facetQs.set('district', district);
  if (localBodyType) facetQs.set('localBodyType', localBodyType);
  const facetsUrl = `/api/mps/facets?${facetQs.toString()}`;
  const { data, isLoading, error } = useSWR(apiUrl, fetcher);
  const { data: facetsData } = useSWR(facetsUrl, fetcher);
  const representatives = data?.representatives || [];
  const districtOptions = Array.from(new Set([...(facetsData?.districts || []), district].filter(Boolean)));
  const localBodyTypeOptions = Array.from(
    new Set([...(facetsData?.localBodyTypes || []), localBodyType].filter(Boolean))
  );

  function pushFilters(next = {}) {
    const query = {};
    const officeLevelValue = next.officeLevel ?? officeLevel;
    const searchValue = next.q ?? searchQuery;
    const districtValue = next.district ?? district;
    const localBodyTypeValue = next.localBodyType ?? localBodyType;

    if (officeLevelValue) query.officeLevel = officeLevelValue;
    if (searchValue) query.q = searchValue;
    if (districtValue) query.district = districtValue;
    if (localBodyTypeValue) query.localBodyType = localBodyTypeValue;

    router.push({ pathname: '/mps', query }, undefined, { shallow: true });
  }

  return (
    <>
      <Head>
        <title>{t(router.locale, 'mpsTitle')} | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t(router.locale, 'mpsTitle')}</h2>
        <div className="bg-white rounded shadow p-3 grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              type="search"
              placeholder="Name, normalized, or transliterated"
              defaultValue={searchQuery}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  pushFilters({ q: e.currentTarget.value.trim() });
                }
              }}
              onBlur={(e) => {
                if (e.currentTarget.value.trim() !== searchQuery) {
                  pushFilters({ q: e.currentTarget.value.trim() });
                }
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Office Level</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={officeLevel}
              onChange={(e) => pushFilters({ officeLevel: e.target.value })}
            >
              <option value="">All office levels</option>
              {OFFICE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Filter by District</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={district}
              onChange={(e) => pushFilters({ district: e.target.value })}
            >
              <option value="">All districts</option>
              {districtOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Body Type</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={localBodyType}
              onChange={(e) => pushFilters({ localBodyType: e.target.value })}
            >
              <option value="">All body types</option>
              {localBodyTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? <p className="text-red-600">{t(router.locale, 'failedRepresentatives')}</p> : null}
        <div className="bg-white rounded shadow divide-y">
          {isLoading ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'loading')}</p>
          ) : representatives.length === 0 ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'noRepresentatives')}</p>
          ) : (
            representatives.map((rep) => (
              <div key={rep._id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{renderHighlightedText(rep.name, searchQuery)}</p>
                  <p className="text-sm text-gray-600">
                    {rep.officeLevel || rep.type} {rep.constituency?.name ? `- ${rep.constituency.name}` : ''}
                  </p>
                  {rep.district || rep.localBodyType || rep.localBodyName ? (
                    <p className="text-xs text-gray-500">
                      {[
                        rep.district,
                        rep.localBodyType,
                        typeof rep.localBodyName === 'string'
                          ? renderHighlightedText(rep.localBodyName, searchQuery)
                          : rep.localBodyName
                      ]
                        .filter(Boolean)
                        .map((item, index) => (
                          <span key={`meta-${rep._id}-${index}`}>
                            {index > 0 ? ' | ' : ''}
                            {item}
                          </span>
                        ))}
                    </p>
                  ) : null}
                  {rep.normalizedName ? (
                    <p className="text-xs text-gray-500">
                      {renderHighlightedText(rep.normalizedName, searchQuery)}
                    </p>
                  ) : null}
                  {rep.transliteratedName ? (
                    <p className="text-xs text-gray-500">
                      {renderHighlightedText(rep.transliteratedName, searchQuery)}
                    </p>
                  ) : null}
                </div>
                <Link href={`/mps/${rep._id}`} className="text-blue-600 hover:text-blue-700">
                  {t(router.locale, 'viewProfile')}
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

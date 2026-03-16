import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { t } from '@/lib/i18n';
import { useRouter } from 'next/router';

const Heatmap = dynamic(() => import('@/components/IssuesHeatmap'), { ssr: false });
const fetcher = (url) => fetch(url).then((res) => res.json());

export default function IssueMapPage() {
  const router = useRouter();
  const [category, setCategory] = useState('');
  const [constituency, setConstituency] = useState('');

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (category) search.set('category', category);
    if (constituency) search.set('constituency', constituency);
    return search.toString();
  }, [category, constituency]);

  const { data, error, isLoading } = useSWR(`/api/issues/heatmap${params ? `?${params}` : ''}`, fetcher);
  const { data: boundariesData } = useSWR(`/api/constituencies/boundaries${params ? `?${params}` : ''}`, fetcher);
  const { data: constituenciesData } = useSWR('/api/constituencies', fetcher);

  const points = data?.points || [];
  const boundaries = boundariesData?.features?.length ? boundariesData : null;
  const boundaryCount = boundariesData?.features?.length || 0;
  const constituencies = constituenciesData?.constituencies || [];

  return (
    <>
      <Head>
        <title>{t(router.locale, 'issueHeatmap')} | MP Accountability Tracker</title>
      </Head>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t(router.locale, 'issueHeatmap')}</h2>
        <p className="text-sm text-gray-600">{t(router.locale, 'mapSubtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded shadow">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="category-filter">
              {t(router.locale, 'category')}
            </label>
            <input
              id="category-filter"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g., Roads"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="constituency-filter">
              {t(router.locale, 'constituencies')}
            </label>
            <select
              id="constituency-filter"
              value={constituency}
              onChange={(e) => setConstituency(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">{t(router.locale, 'allConstituencies')}</option>
              {constituencies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p className="text-red-600">{t(router.locale, 'failedMapData')}</p> : null}

        <div className="bg-white p-4 rounded shadow space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>
              {isLoading ? t(router.locale, 'loadingMapPoints') : `${t(router.locale, 'geoTaggedIssues')}: ${data?.totalIssues || 0}`}
            </p>
            <p>{t(router.locale, 'boundaryCoverage')}: {boundaryCount}</p>
          </div>
          <p className="text-xs text-gray-500">Map markers and filters are keyboard accessible; press Tab to move through controls and Escape to dismiss any open dialog.</p>
          <Heatmap points={points} boundaries={boundaries} />
        </div>
      </div>
    </>
  );
}

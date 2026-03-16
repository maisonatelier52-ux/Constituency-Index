import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function ConstituenciesDashboard() {
  const router = useRouter();
  const { data, error, isLoading } = useSWR('/api/dashboard/overview', fetcher);
  const metrics = data?.metrics;
  const constituencies = data?.constituencies || [];

  return (
    <>
      <Head>
        <title>{t(router.locale, 'dashboard')} | MP Accountability Tracker</title>
        <meta
          name="description"
          content="Real-time tracker for solved, pending, and overdue issues with constituency index insights."
        />
      </Head>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold">{t(router.locale, 'constituencyDashboard')}</h2>

        {error ? <p className="text-red-600">{t(router.locale, 'failedDashboard')}</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard label={t(router.locale, 'constituencies')} value={isLoading ? '...' : metrics?.constituencies || 0} />
          <MetricCard label={t(router.locale, 'totalIssues')} value={isLoading ? '...' : metrics?.totalIssues || 0} />
          <MetricCard label={t(router.locale, 'solvedIssues')} value={isLoading ? '...' : metrics?.solvedIssues || 0} />
          <MetricCard label={t(router.locale, 'pendingIssues')} value={isLoading ? '...' : metrics?.pendingIssues || 0} />
          <MetricCard label={t(router.locale, 'overdueIssues')} value={isLoading ? '...' : metrics?.overdueIssues || 0} />
          <MetricCard
            label={t(router.locale, 'avgResponseDays')}
            value={isLoading ? '...' : metrics?.avgResponseDays?.toString() || '0'}
          />
          <MetricCard label={t(router.locale, 'engagementLevel')} value={isLoading ? '...' : metrics?.engagementLevel || t(router.locale, 'na')} />
          <MetricCard label={t(router.locale, 'promisesTracked')} value={isLoading ? '...' : metrics?.promisesTracked || 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-semibold mb-2">{t(router.locale, 'pendingVsOverdue')}</h3>
            <p className="text-sm text-gray-600 mb-4">{t(router.locale, 'overdueHelp')}</p>
            <div className="space-y-2">
              <ProgressRow
                label={t(router.locale, 'pending')}
                current={metrics?.pendingIssues || 0}
                total={(metrics?.pendingIssues || 0) + (metrics?.solvedIssues || 0)}
                barClass="bg-amber-500"
              />
              <ProgressRow
                label={t(router.locale, 'overdue')}
                current={metrics?.overdueIssues || 0}
                total={Math.max(metrics?.pendingIssues || 1, 1)}
                barClass="bg-red-500"
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-semibold mb-2">{t(router.locale, 'transparencySnapshot')}</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>Track MLA/MP response speed and issue closure progress.</li>
              <li>Weighted constituency index reflects local priorities (urban/rural/universal).</li>
              <li>Supports evidence-based issue reports with deadlines and votes.</li>
            </ul>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-3">{t(router.locale, 'constituencyIndex')}</h3>
          <ul>
            {constituencies.map((c) => (
              <li key={c._id} className="py-2 border-b last:border-0 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-gray-600">
                    {t(router.locale, 'representative')}: {c.representative?.name || t(router.locale, 'na')} | {t(router.locale, 'profile')}: {c.profileType}
                  </p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                  CI {c.constituencyIndex}
                </span>
              </li>
            ))}
            {constituencies.length === 0 && !isLoading ? (
              <li className="text-gray-500">{t(router.locale, 'noConstituencies')}</li>
            ) : null}
          </ul>
        </div>
      </div>
    </>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-gray-600 text-sm">{label}</h3>
      <p className="text-3xl font-semibold">{value}</p>
    </div>
  );
}

function ProgressRow({ label, current, total, barClass }) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span>{label}</span>
        <span>
          {current}/{total}
        </span>
      </div>
      <div className="h-3 rounded bg-gray-200 overflow-hidden">
        <div className={`h-3 ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

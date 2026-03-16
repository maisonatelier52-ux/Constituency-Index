import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function USConstituenciesPage() {
  const { data, error, isLoading } = useSWR('/api/dashboard/overview?country=US', fetcher);
  const metrics = data?.metrics;
  const constituencies = data?.constituencies || [];

  const houseCount = constituencies.filter((c) => c.constituencyType === 'congressional_district').length;
  const senateCount = constituencies.filter((c) => c.constituencyType === 'senate_statewide').length;

  return (
    <>
      <Head>
        <title>US Constituencies | MP Accountability Tracker</title>
      </Head>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold">United States Constituency Dashboard</h2>

        {error ? <p className="text-red-600">Failed to load US constituency data.</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard label="Total US Constituencies" value={isLoading ? '...' : metrics?.constituencies || 0} />
          <MetricCard label="US House Districts" value={isLoading ? '...' : houseCount} />
          <MetricCard label="US Senate Constituencies" value={isLoading ? '...' : senateCount} />
          <MetricCard label="Tracked Issues" value={isLoading ? '...' : metrics?.totalIssues || 0} />
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-3">US Constituency Index</h3>
          <ul>
            {constituencies.map((c) => (
              <li key={c._id} className="py-2 border-b last:border-0 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-gray-600">
                    {c.code} | {c.state} | {c.constituencyType}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                    CI {c.constituencyIndex}
                  </span>
                  <Link href={`/us/constituencies/${c._id}`} className="text-blue-700 text-sm hover:text-blue-800">
                    View
                  </Link>
                </div>
              </li>
            ))}
            {constituencies.length === 0 && !isLoading ? (
              <li className="text-gray-500">No US constituencies found. Run `npm run seed:us`.</li>
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

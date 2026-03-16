import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

function AlertPill({ level, children }) {
  const classes =
    level === 'critical'
      ? 'bg-red-100 text-red-800 border-red-200'
      : level === 'warning'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>{children}</span>;
}

export default function AdminIngestionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadDashboard() {
    setLoading(true);
    const res = await fetch('/api/admin/ingestion');
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Failed to load ingestion dashboard');
      setLoading(false);
      return;
    }
    setData(payload);
    setLoading(false);
  }

  async function updateApproval(dataset, approved) {
    setNotice('');
    setError('');
    const res = await fetch('/api/admin/import-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset, approved })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Failed to update approval');
      return;
    }
    setNotice(`${approved ? 'Approved' : 'Revoked'} publish for ${dataset}.`);
    await loadDashboard();
  }

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'admin') {
      router.replace('/constituencies');
      return;
    }
    loadDashboard();
  }, [status, session, router]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading' || loading) {
    return <p className="text-sm text-gray-600">Loading ingestion diagnostics...</p>;
  }

  return (
    <>
      <Head>
        <title>Admin Ingestion | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ingestion Dashboard</h1>
            <p className="text-sm text-gray-600">QA pass/fail, checksum history, and dead-letter alerts in one place.</p>
          </div>
          {data?.generatedAt ? <p className="text-xs text-gray-500">Updated {new Date(data.generatedAt).toLocaleString()}</p> : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm text-blue-700">{notice}</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-100 rounded shadow p-4">
            <p className="text-sm text-gray-500">Dead-letter jobs</p>
            <p className="text-3xl font-bold text-red-700">{data?.jobs?.deadLetterCount || 0}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded shadow p-4">
            <p className="text-sm text-gray-500">Retryable failures</p>
            <p className="text-3xl font-bold text-amber-700">{data?.jobs?.failedCount || 0}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded shadow p-4">
            <p className="text-sm text-gray-500">Datasets tracked</p>
            <p className="text-3xl font-bold text-blue-700">{data?.datasets?.length || 0}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded shadow p-4 space-y-3">
          <h2 className="font-semibold">Publish Approvals</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Dataset</th>
                  <th className="text-left p-2">Approved</th>
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">Note</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data?.approvals?.datasets || {}).length ? (
                  Object.entries(data.approvals.datasets).map(([dataset, approval]) => (
                    <tr key={dataset} className="border-t border-gray-100">
                      <td className="p-2">{dataset}</td>
                      <td className="p-2">{approval?.approved ? 'yes' : 'no'}</td>
                      <td className="p-2">{approval?.approvedAt ? new Date(approval.approvedAt).toLocaleString() : 'N/A'}</td>
                      <td className="p-2">{approval?.note || '-'}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                            onClick={() => updateApproval(dataset, true)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                            onClick={() => updateApproval(dataset, false)}
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={5}>
                      No explicit approvals recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded shadow p-4 space-y-3">
          <h2 className="font-semibold">Alerts</h2>
          {data?.alerts?.length ? (
            data.alerts.map((alert, index) => (
              <div key={`${alert.message}-${index}`} className="flex items-center gap-2">
                <AlertPill level={alert.level}>{alert.level}</AlertPill>
                <p className="text-sm text-gray-700">{alert.message}</p>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2">
              <AlertPill level="ok">ok</AlertPill>
              <p className="text-sm text-gray-700">No ingestion alerts right now.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {data?.datasets?.map((dataset) => {
            const qaPass = dataset.qa?.pass;
            return (
              <section key={dataset.dataset} className="bg-white border border-gray-100 rounded shadow p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{dataset.label}</h2>
                  <AlertPill level={qaPass === false ? 'critical' : qaPass === true ? 'ok' : 'warning'}>
                    {qaPass === false ? 'QA failing' : qaPass === true ? 'QA passing' : 'No QA'}
                  </AlertPill>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Latest checksum</p>
                    <p className="font-mono break-all text-xs">{dataset.manifest?.checksum || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Latest published</p>
                    <p>{dataset.manifest?.generatedAt ? new Date(dataset.manifest.generatedAt).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>

                <div className="text-sm">
                  <p className="text-gray-500 mb-1">QA details</p>
                  {dataset.qa ? (
                    <div className="space-y-1">
                      <p>Required-field null rate: {dataset.qa.requiredFieldNullRatePercent ?? 'N/A'}%</p>
                      <p>Reject reasons: {dataset.qa.rejectReasons?.length ? dataset.qa.rejectReasons.join('; ') : 'none'}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500">No QA report found.</p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-2">Checksum history</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">Generated</th>
                          <th className="text-left p-2">Source</th>
                          <th className="text-left p-2">Checksum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.checksumHistory?.length ? (
                          dataset.checksumHistory.map((item) => (
                            <tr key={`${item.generatedAt}-${item.checksum}`} className="border-t border-gray-100">
                              <td className="p-2">{item.generatedAt ? new Date(item.generatedAt).toLocaleString() : 'N/A'}</td>
                              <td className="p-2">{item.sourceName || 'N/A'}</td>
                              <td className="p-2 font-mono break-all">{item.checksum || 'N/A'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="p-2 text-gray-500" colSpan={3}>
                              No checksum history yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="bg-white border border-gray-100 rounded shadow p-4">
          <h2 className="font-semibold mb-3">Recent Dead-letter Jobs</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Updated</th>
                  <th className="text-left p-2">Attempts</th>
                  <th className="text-left p-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {data?.jobs?.recentDeadLetters?.length ? (
                  data.jobs.recentDeadLetters.map((job) => (
                    <tr key={job._id} className="border-t border-gray-100">
                      <td className="p-2">{job.type}</td>
                      <td className="p-2">{job.updatedAt ? new Date(job.updatedAt).toLocaleString() : 'N/A'}</td>
                      <td className="p-2">
                        {job.attempts}/{job.maxAttempts}
                      </td>
                      <td className="p-2 text-red-700">{job.lastError || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={4}>
                      No dead-letter jobs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

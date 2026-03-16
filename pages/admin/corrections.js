import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

let nextRowId = 1;

function makeClientRow(values) {
  return {
    ...values,
    _clientId: `row-${nextRowId++}`,
    _touchedAt: values?._touchedAt || 0
  };
}

function blankJurisdictionEntry() {
  return makeClientRow({ key: '', normalized_name: '', transliterated_name: '', local_body_name: '', _touchedAt: Date.now() });
}

function blankLocalBodyEntry() {
  return makeClientRow({ key: '', local_body_name: '', _touchedAt: Date.now() });
}

const PAGE_SIZE = 25;

function promoteUpdatedRow(rows, clientId, updater) {
  const now = Date.now();
  const nextRows = [];
  let updatedRow = null;

  for (const row of rows) {
    if (row._clientId === clientId) {
      updatedRow = { ...updater(row), _clientId: row._clientId, _touchedAt: now };
    } else {
      nextRows.push(row);
    }
  }

  return updatedRow ? [updatedRow, ...nextRows] : rows;
}

function removeRow(rows, clientId) {
  return rows.filter((row) => row._clientId !== clientId);
}

function formatDiffValue(value) {
  if (value == null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

async function copyJson(value, onSuccess, onError) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    onSuccess();
  } catch (_) {
    onError();
  }
}

function jobStatusBadgeClass(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'succeeded') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'running') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (value === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (value === 'failed') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (value === 'dead_letter') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

export default function AdminCorrectionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [jurisdictionRows, setJurisdictionRows] = useState([]);
  const [localBodyRows, setLocalBodyRows] = useState([]);
  const [recentChanges, setRecentChanges] = useState([]);
  const [recentChangesPagination, setRecentChangesPagination] = useState({ page: 1, pageSize: 8, total: 0, totalPages: 1 });
  const [jobStatusRows, setJobStatusRows] = useState([]);
  const [jurisdictionSearch, setJurisdictionSearch] = useState('');
  const [localBodySearch, setLocalBodySearch] = useState('');
  const [refreshingImport, setRefreshingImport] = useState(false);
  const [runningWorker, setRunningWorker] = useState(false);
  const [autoRefreshJobs, setAutoRefreshJobs] = useState(false);
  const [showFailedJobsOnly, setShowFailedJobsOnly] = useState(false);
  const [jurisdictionPage, setJurisdictionPage] = useState(1);
  const [localBodyPage, setLocalBodyPage] = useState(1);
  const [selectedChange, setSelectedChange] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  const loadCorrectionsPage = useCallback(async (page = 1) => {
    setLoading(true);
    const res = await fetch('/api/admin/corrections');
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Failed to load corrections');
      setLoading(false);
      return;
    }

    const byCode = Object.entries(payload.corrections.by_jurisdiction_code || {}).map(([key, value]) => ({
      ...makeClientRow({}),
      key,
      normalized_name: value.normalized_name || '',
      transliterated_name: value.transliterated_name || '',
      local_body_name: value.local_body_name || ''
    }));
    const byLocalBody = Object.entries(payload.corrections.by_local_body_name || {}).map(([key, value]) => ({
      ...makeClientRow({}),
      key,
      local_body_name: value.local_body_name || ''
    }));

    setJurisdictionRows(byCode);
    setLocalBodyRows(byLocalBody);
    setJobStatusRows(payload.jobs || []);
    setLoading(false);
  }, []);

  const loadHistoryPage = useCallback(async (page = 1) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(recentChangesPagination.pageSize || 8)
    });
    const res = await fetch(`/api/admin/corrections/history?${params.toString()}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Failed to load corrections history');
      return;
    }
    setRecentChanges(payload.recentChanges || []);
    setRecentChangesPagination(payload.recentChangesPagination || { page, pageSize: 8, total: 0, totalPages: 1 });
  }, [recentChangesPagination.pageSize]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/api/auth/signin?callbackUrl=/admin/corrections');
      setLoading(false);
      return;
    }
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'admin') {
      router.replace('/constituencies');
      setLoading(false);
      return;
    }
    loadCorrectionsPage(1);
    loadHistoryPage(1);
  }, [status, session, router, loadCorrectionsPage, loadHistoryPage]);

  useEffect(() => {
    if (!autoRefreshJobs) return undefined;
    const hasActiveJobs = jobStatusRows.some((job) => ['pending', 'running', 'failed'].includes(job.status));
    if (!hasActiveJobs) return undefined;

    const intervalId = setInterval(() => {
      loadCorrectionsPage(recentChangesPagination.page || 1);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [autoRefreshJobs, jobStatusRows, loadCorrectionsPage, recentChangesPagination.page]);

  useEffect(() => {
    if (!selectedChange) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setSelectedChange(null);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedChange]);

  useEffect(() => {
    if (!selectedJob) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setSelectedJob(null);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedJob]);

  useEffect(() => {
    setJurisdictionPage(1);
  }, [jurisdictionSearch]);

  useEffect(() => {
    setLocalBodyPage(1);
  }, [localBodySearch]);

  const canSave = useMemo(
    () =>
      jurisdictionRows.every((row) => !row.key || row.normalized_name || row.transliterated_name || row.local_body_name) &&
      localBodyRows.every((row) => !row.key || row.local_body_name),
    [jurisdictionRows, localBodyRows]
  );

  const filteredJurisdictionRows = useMemo(() => {
    const q = jurisdictionSearch.trim().toLowerCase();
    if (!q) return jurisdictionRows;
    return jurisdictionRows.filter((row) =>
      [row.key, row.normalized_name, row.transliterated_name, row.local_body_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    );
  }, [jurisdictionRows, jurisdictionSearch]);

  const filteredLocalBodyRows = useMemo(() => {
    const q = localBodySearch.trim().toLowerCase();
    if (!q) return localBodyRows;
    return localBodyRows.filter((row) =>
      [row.key, row.local_body_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    );
  }, [localBodyRows, localBodySearch]);

  const pagedJurisdictionRows = useMemo(() => {
    const start = (jurisdictionPage - 1) * PAGE_SIZE;
    return filteredJurisdictionRows.slice(start, start + PAGE_SIZE);
  }, [filteredJurisdictionRows, jurisdictionPage]);

  const pagedLocalBodyRows = useMemo(() => {
    const start = (localBodyPage - 1) * PAGE_SIZE;
    return filteredLocalBodyRows.slice(start, start + PAGE_SIZE);
  }, [filteredLocalBodyRows, localBodyPage]);

  const jurisdictionPageCount = Math.max(1, Math.ceil(filteredJurisdictionRows.length / PAGE_SIZE));
  const localBodyPageCount = Math.max(1, Math.ceil(filteredLocalBodyRows.length / PAGE_SIZE));
  const latestSuccessfulJob = useMemo(
    () => jobStatusRows.find((job) => job.status === 'succeeded' && job.result),
    [jobStatusRows]
  );
  const visibleJobStatusRows = useMemo(() => {
    if (!showFailedJobsOnly) return jobStatusRows;
    return jobStatusRows.filter((job) => ['failed', 'dead_letter'].includes(job.status));
  }, [jobStatusRows, showFailedJobsOnly]);

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      by_jurisdiction_code: jurisdictionRows.reduce((acc, row) => {
        if (!row.key.trim()) return acc;
        acc[row.key.trim()] = {};
        if (row.normalized_name.trim()) acc[row.key.trim()].normalized_name = row.normalized_name.trim();
        if (row.transliterated_name.trim()) acc[row.key.trim()].transliterated_name = row.transliterated_name.trim();
        if (row.local_body_name.trim()) acc[row.key.trim()].local_body_name = row.local_body_name.trim();
        return acc;
      }, {}),
      by_local_body_name: localBodyRows.reduce((acc, row) => {
        if (!row.key.trim() || !row.local_body_name.trim()) return acc;
        acc[row.key.trim()] = { local_body_name: row.local_body_name.trim() };
        return acc;
      }, {})
    };

    const res = await fetch('/api/admin/corrections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || 'Failed to save corrections');
      setSaving(false);
      return;
    }

    setNotice('Corrections saved.');
    setJobStatusRows(body.jobs || jobStatusRows);
    await loadHistoryPage(1);
    setSaving(false);
  }

  async function rerunKeralaImport() {
    setRefreshingImport(true);
    setError('');
    setNotice('');

    const res = await fetch('/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'import.representatives',
        payload: {
          inputPath: 'data/kerala/representatives/kerala_local_body_members.official.csv',
          sourceName: 'kerala_local_bodies',
          skipSourceValidation: true
        },
        maxAttempts: 3
      })
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || 'Failed to enqueue Kerala import');
      setRefreshingImport(false);
      return;
    }

    setNotice('Kerala local-body refresh job queued.');
    if (body.job) {
      setJobStatusRows((prev) => [body.job, ...prev].slice(0, 6));
    }
    await loadCorrectionsPage(1);
    setRefreshingImport(false);
  }

  async function runWorkerNow() {
    setRunningWorker(true);
    setError('');
    setNotice('');

    const res = await fetch('/api/jobs/worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 10,
        workerId: 'admin-corrections'
      })
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || 'Failed to run worker');
      setRunningWorker(false);
      return;
    }

    setNotice(
      `Worker processed ${body.summary?.claimed || 0} job(s): ${body.summary?.succeeded || 0} succeeded, ${body.summary?.failed || 0} failed, ${body.summary?.deadLettered || 0} dead-lettered.`
    );
    await loadCorrectionsPage(1);
    setRunningWorker(false);
  }

  async function copySelectedChangeJson() {
    if (!selectedChange) return;
    await copyJson(
      selectedChange.metadata?.diff || {},
      () => {
        setError('');
        setNotice('Copied correction diff JSON.');
      },
      () => {
        setError('Failed to copy correction diff JSON.');
      }
    );
  }

  async function copySelectedJobJson() {
    if (!selectedJob) return;
    await copyJson(
      selectedJob,
      () => {
        setError('');
        setNotice('Copied job JSON.');
      },
      () => {
        setError('Failed to copy job JSON.');
      }
    );
  }

  async function copySelectedJobResultOnly() {
    if (!selectedJob?.result) return;
    await copyJson(
      selectedJob.result,
      () => {
        setError('');
        setNotice('Copied job result JSON.');
      },
      () => {
        setError('Failed to copy job result JSON.');
      }
    );
  }

  async function copySelectedJobErrorText() {
    if (!selectedJob?.lastError) return;
    try {
      await navigator.clipboard.writeText(selectedJob.lastError);
      setError('');
      setNotice('Copied job error text.');
    } catch (_) {
      setError('Failed to copy job error text.');
    }
  }

  if (status === 'loading' || loading) {
    return <p className="text-sm text-gray-600">Loading corrections editor...</p>;
  }

  return (
    <>
      <Head>
        <title>Admin Corrections | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Corrections Editor</h1>
            <p className="text-sm text-gray-600">Maintain reviewed name and local-body overrides without editing JSON by hand.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={rerunKeralaImport}
              disabled={refreshingImport}
              className="rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50"
            >
              {refreshingImport ? 'Queueing...' : 'Re-run Kerala Import'}
            </button>
            <button
              type="button"
              onClick={runWorkerNow}
              disabled={runningWorker}
              className="rounded border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 disabled:opacity-50"
            >
              {runningWorker ? 'Running...' : 'Run Worker Now'}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !canSave}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Corrections'}
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        {!canSave ? <p className="text-sm text-amber-700">Each non-empty row needs at least one correction value.</p> : null}

        <section className="rounded border border-gray-100 bg-white p-4 shadow">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Kerala Import Status</h2>
              <p className="text-sm text-gray-600">Latest Kerala local-body refresh jobs and their outcomes.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showFailedJobsOnly}
                  onChange={(e) => setShowFailedJobsOnly(e.target.checked)}
                  className="h-4 w-4"
                />
                Failed only
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={autoRefreshJobs}
                  onChange={(e) => setAutoRefreshJobs(e.target.checked)}
                  className="h-4 w-4"
                />
                Auto-refresh
              </label>
            </div>
          </div>
          {latestSuccessfulJob ? (
            <div className="mb-3 rounded border border-emerald-100 bg-emerald-50 p-3 text-sm">
              <p className="font-medium text-emerald-800">Last successful import</p>
              <p className="mt-1 text-emerald-700">
                {latestSuccessfulJob.completedAt
                  ? `Completed ${new Date(latestSuccessfulJob.completedAt).toLocaleString()}`
                  : 'Completed recently'}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-emerald-800">
                {latestSuccessfulJob.result?.matched != null ? <span>Matched: {latestSuccessfulJob.result.matched}</span> : null}
                {latestSuccessfulJob.result?.modified != null ? <span>Modified: {latestSuccessfulJob.result.modified}</span> : null}
                {latestSuccessfulJob.result?.upserted != null ? <span>Upserted: {latestSuccessfulJob.result.upserted}</span> : null}
                {latestSuccessfulJob.result?.qaPass != null ? <span>QA: {latestSuccessfulJob.result.qaPass ? 'pass' : 'fail'}</span> : null}
              </div>
            </div>
          ) : null}
          {visibleJobStatusRows.length === 0 ? (
            <p className="text-sm text-gray-500">No Kerala import jobs recorded yet.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleJobStatusRows.map((job) => (
                <div key={job.id} className="rounded border border-gray-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${jobStatusBadgeClass(job.status)}`}>
                      {job.status}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(job.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Attempts {job.attempts || 0}/{job.maxAttempts || 0}
                  </p>
                  {job.completedAt ? (
                    <p className="mt-1 text-xs text-gray-500">Completed {new Date(job.completedAt).toLocaleString()}</p>
                  ) : null}
                  {job.lastError ? <p className="mt-1 text-xs text-red-600">{job.lastError}</p> : null}
                  {job.status === 'succeeded' && job.result ? (
                    <button
                      type="button"
                      onClick={() => setSelectedJob(job)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                    >
                      View job result
                    </button>
                  ) : null}
                  {['failed', 'dead_letter'].includes(job.status) ? (
                    <button
                      type="button"
                      onClick={() => setSelectedJob(job)}
                      className="mt-2 block text-xs text-blue-600 hover:text-blue-700"
                    >
                      View error
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-100 rounded shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Jurisdiction Corrections</h2>
              <p className="text-xs text-gray-500">
                {filteredJurisdictionRows.length} of {jurisdictionRows.length} rows shown
              </p>
            </div>
            <button
              type="button"
              onClick={() => setJurisdictionRows((prev) => [blankJurisdictionEntry(), ...prev])}
              className="rounded border border-gray-300 px-3 py-1 text-sm"
            >
              Add Row
            </button>
          </div>
          <input
            type="search"
            value={jurisdictionSearch}
            onChange={(e) => setJurisdictionSearch(e.target.value)}
            placeholder="Filter by code, normalized name, transliteration, or body name"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Jurisdiction Code</th>
                  <th className="text-left p-2">Normalized Name</th>
                  <th className="text-left p-2">Transliterated Name</th>
                  <th className="text-left p-2">Local Body Name</th>
                  <th className="text-left p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedJurisdictionRows.map((row) => {
                  return (
                  <tr key={`jurisdiction-${row._clientId}`} className="border-t border-gray-100">
                    <td className="p-2">
                      <input
                        placeholder="IN-KL-ERN-MUN-M07027-W021"
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        value={row.key}
                        onChange={(e) =>
                          setJurisdictionRows((prev) =>
                            promoteUpdatedRow(prev, row._clientId, (item) => ({ ...item, key: e.target.value }))
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        placeholder="ജോർജ് വർഗീസ്"
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        value={row.normalized_name}
                        onChange={(e) =>
                          setJurisdictionRows((prev) =>
                            promoteUpdatedRow(prev, row._clientId, (item) => ({
                              ...item,
                              normalized_name: e.target.value
                            }))
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        placeholder="George Varghese"
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        value={row.transliterated_name}
                        onChange={(e) =>
                          setJurisdictionRows((prev) =>
                            promoteUpdatedRow(prev, row._clientId, (item) => ({
                              ...item,
                              transliterated_name: e.target.value
                            }))
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        placeholder="നോർത്ത് പറവൂർ"
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        value={row.local_body_name}
                        onChange={(e) =>
                          setJurisdictionRows((prev) =>
                            promoteUpdatedRow(prev, row._clientId, (item) => ({
                              ...item,
                              local_body_name: e.target.value
                            }))
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => setJurisdictionRows((prev) => removeRow(prev, row._clientId))}
                        className="text-sm text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Page {jurisdictionPage} of {jurisdictionPageCount}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={jurisdictionPage <= 1}
                onClick={() => setJurisdictionPage((prev) => Math.max(1, prev - 1))}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={jurisdictionPage >= jurisdictionPageCount}
                onClick={() => setJurisdictionPage((prev) => Math.min(jurisdictionPageCount, prev + 1))}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Local Body Name Corrections</h2>
              <p className="text-xs text-gray-500">
                {filteredLocalBodyRows.length} of {localBodyRows.length} rows shown
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLocalBodyRows((prev) => [blankLocalBodyEntry(), ...prev])}
              className="rounded border border-gray-300 px-3 py-1 text-sm"
            >
              Add Row
            </button>
          </div>
          <input
            type="search"
            value={localBodySearch}
            onChange={(e) => setLocalBodySearch(e.target.value)}
            placeholder="Filter by raw or corrected local body name"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Raw Local Body Name</th>
                  <th className="text-left p-2">Corrected Local Body Name</th>
                  <th className="text-left p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedLocalBodyRows.map((row) => {
                  return (
                  <tr key={`local-body-${row._clientId}`} className="border-t border-gray-100">
                    <td className="p-2">
                      <input
                        placeholder="േനാർത്ത് പറവൂർ"
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        value={row.key}
                        onChange={(e) =>
                          setLocalBodyRows((prev) =>
                            promoteUpdatedRow(prev, row._clientId, (item) => ({ ...item, key: e.target.value }))
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        placeholder="നോർത്ത് പറവൂർ"
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        value={row.local_body_name}
                        onChange={(e) =>
                          setLocalBodyRows((prev) =>
                            promoteUpdatedRow(prev, row._clientId, (item) => ({
                              ...item,
                              local_body_name: e.target.value
                            }))
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => setLocalBodyRows((prev) => removeRow(prev, row._clientId))}
                        className="text-sm text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Page {localBodyPage} of {localBodyPageCount}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={localBodyPage <= 1}
                onClick={() => setLocalBodyPage((prev) => Math.max(1, prev - 1))}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={localBodyPage >= localBodyPageCount}
                onClick={() => setLocalBodyPage((prev) => Math.min(localBodyPageCount, prev + 1))}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded shadow p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Recent Corrections</h2>
            <p className="text-sm text-gray-600">Latest saved changes from the audit log.</p>
          </div>
          {recentChanges.length === 0 ? (
            <p className="text-sm text-gray-500">No correction saves recorded yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Saved At</th>
                      <th className="p-2 text-left">Actor</th>
                      <th className="p-2 text-left">Jurisdiction Rows</th>
                      <th className="p-2 text-left">Local Body Rows</th>
                      <th className="p-2 text-left">Recent Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentChanges.map((item) => (
                      <tr key={item.id} className="border-t border-gray-100">
                        <td className="p-2 text-gray-700">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="p-2 text-gray-700">
                          {item.actor?.name || 'Unknown'}
                          {item.actor?.email ? <span className="text-xs text-gray-500"> ({item.actor.email})</span> : null}
                        </td>
                        <td className="p-2 text-gray-700">{item.metadata?.jurisdictionCorrectionCount ?? 0}</td>
                        <td className="p-2 text-gray-700">{item.metadata?.localBodyCorrectionCount ?? 0}</td>
                        <td className="p-2 text-xs text-gray-600">
                          <div className="space-y-1">
                            {(item.metadata?.diff?.jurisdiction?.items || []).slice(0, 2).map((change) => (
                              <div key={`jur-${item.id}-${change.key}`}>
                                <span className="font-medium">{change.changeType}</span> jurisdiction <code>{change.key}</code>
                              </div>
                            ))}
                            {(item.metadata?.diff?.localBody?.items || []).slice(0, 2).map((change) => (
                              <div key={`lb-${item.id}-${change.key}`}>
                                <span className="font-medium">{change.changeType}</span> local body <code>{change.key}</code>
                              </div>
                            ))}
                            {((item.metadata?.diff?.jurisdiction?.total || 0) + (item.metadata?.diff?.localBody?.total || 0)) === 0 ? (
                              <span>No field-level changes recorded.</span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setSelectedChange(item)}
                              className="block text-blue-600 hover:text-blue-700"
                            >
                              View full diff
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Page {recentChangesPagination.page} of {recentChangesPagination.totalPages} ({recentChangesPagination.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={recentChangesPagination.page <= 1}
                    onClick={() => loadHistoryPage(recentChangesPagination.page - 1)}
                    className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={recentChangesPagination.page >= recentChangesPagination.totalPages}
                    onClick={() => loadHistoryPage(recentChangesPagination.page + 1)}
                    className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      {selectedChange ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setSelectedChange(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="correction-diff-title"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 id="correction-diff-title" className="text-lg font-semibold">Correction Diff Details</h2>
                <p className="text-sm text-gray-600">
                  {new Date(selectedChange.createdAt).toLocaleString()} by {selectedChange.actor?.name || 'Unknown'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copySelectedChangeJson}
                  className="rounded border border-gray-300 px-3 py-1 text-sm"
                >
                  Copy JSON
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChange(null)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="space-y-6 px-5 py-4">
              <section className="space-y-3">
                <div>
                  <h3 className="font-semibold">Jurisdiction Changes</h3>
                  <p className="text-sm text-gray-600">
                    {selectedChange.metadata?.diff?.jurisdiction?.total || 0} change(s)
                  </p>
                </div>
                {(selectedChange.metadata?.diff?.jurisdiction?.items || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No jurisdiction-level changes recorded.</p>
                ) : (
                  (selectedChange.metadata?.diff?.jurisdiction?.items || []).map((change) => (
                    <div key={`modal-jur-${change.key}`} className="rounded border border-gray-200 p-3">
                      <p className="text-sm font-medium">
                        {change.changeType} <code>{change.key}</code>
                      </p>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Before</p>
                          <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">{formatDiffValue(change.before)}</pre>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">After</p>
                          <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">{formatDiffValue(change.after)}</pre>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="font-semibold">Local Body Name Changes</h3>
                  <p className="text-sm text-gray-600">
                    {selectedChange.metadata?.diff?.localBody?.total || 0} change(s)
                  </p>
                </div>
                {(selectedChange.metadata?.diff?.localBody?.items || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No local-body-name changes recorded.</p>
                ) : (
                  (selectedChange.metadata?.diff?.localBody?.items || []).map((change) => (
                    <div key={`modal-lb-${change.key}`} className="rounded border border-gray-200 p-3">
                      <p className="text-sm font-medium">
                        {change.changeType} <code>{change.key}</code>
                      </p>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Before</p>
                          <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">{formatDiffValue(change.before)}</pre>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">After</p>
                          <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">{formatDiffValue(change.after)}</pre>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {selectedJob ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-inspector-title"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 id="job-inspector-title" className="text-lg font-semibold">
                  {selectedJob.status === 'succeeded' ? 'Job Result' : 'Job Error'}
                </h2>
                <p className="text-sm text-gray-600">
                  {selectedJob.status} • created {new Date(selectedJob.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedJob.result ? (
                  <button
                    type="button"
                    onClick={copySelectedJobResultOnly}
                    className="rounded border border-gray-300 px-3 py-1 text-sm"
                  >
                    Copy Result Only
                  </button>
                ) : null}
                {selectedJob.lastError ? (
                  <button
                    type="button"
                    onClick={copySelectedJobErrorText}
                    className="rounded border border-gray-300 px-3 py-1 text-sm"
                  >
                    Copy Error Text
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={copySelectedJobJson}
                  className="rounded border border-gray-300 px-3 py-1 text-sm"
                >
                  Copy JSON
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border border-gray-200 p-3 text-sm">
                  <p className="font-medium text-gray-900">Status</p>
                  <p className="mt-1 text-gray-700">{selectedJob.status}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 text-sm">
                  <p className="font-medium text-gray-900">Attempts</p>
                  <p className="mt-1 text-gray-700">
                    {selectedJob.attempts || 0}/{selectedJob.maxAttempts || 0}
                  </p>
                </div>
              </div>
              {selectedJob.status === 'succeeded' ? (
                <section className="space-y-2">
                  <h3 className="font-semibold">Result Payload</h3>
                  <pre className="overflow-x-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
                    {formatDiffValue(selectedJob.result)}
                  </pre>
                </section>
              ) : (
                <section className="space-y-2">
                  <h3 className="font-semibold">Error Details</h3>
                  <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs text-red-800">
                    {selectedJob.lastError || 'No error details recorded.'}
                  </pre>
                  {selectedJob.result ? (
                    <>
                      <h3 className="font-semibold">Partial Result</h3>
                      <pre className="overflow-x-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
                        {formatDiffValue(selectedJob.result)}
                      </pre>
                    </>
                  ) : null}
                </section>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

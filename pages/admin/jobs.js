import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

const jobTypes = [
  'report.generate',
  'geocode.lookup',
  'import.official_constituencies',
  'import.boundaries',
  'import.representatives',
  'email.send',
  'notification.send'
];

export default function AdminJobsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [jobType, setJobType] = useState('report.generate');
  const [payloadText, setPayloadText] = useState('{"scope":"system"}');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadJobs(nextStatus = statusFilter) {
    const qs = new URLSearchParams();
    if (nextStatus) qs.set('status', nextStatus);
    const res = await fetch(`/api/admin/jobs?${qs.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Failed to load jobs');
      return;
    }
    setJobs(data.jobs || []);
  }

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'admin') {
      router.replace('/constituencies');
      return;
    }
    loadJobs();
  }, [status, session, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enqueue() {
    setLoading(true);
    setMessage('');
    let payload = {};
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : {};
    } catch (_) {
      setMessage('Payload must be valid JSON');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: jobType, payload })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error || 'Failed to enqueue job');
      return;
    }

    setMessage(`Enqueued: ${data.job.type}`);
    loadJobs();
  }

  async function runWorker() {
    setLoading(true);
    setMessage('');
    const res = await fetch('/api/jobs/worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 20, workerId: 'admin-ui' })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error || 'Worker run failed');
      return;
    }

    setMessage(
      `Worker: claimed ${data.summary.claimed}, succeeded ${data.summary.succeeded}, failed ${data.summary.failed}, dead-lettered ${data.summary.deadLettered}`
    );
    loadJobs();
  }

  async function retryJob(jobId) {
    setLoading(true);
    setMessage('');
    const res = await fetch('/api/admin/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, action: 'retry' })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error || 'Retry failed');
      return;
    }

    setMessage(`Job retried: ${data.job.type}`);
    loadJobs();
  }

  if (status === 'loading') {
    return <p className="text-sm text-gray-600">Loading queue admin...</p>;
  }

  return (
    <>
      <Head>
        <title>Admin Jobs | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Queue Diagnostics</h1>
        {message ? <p className="text-sm text-blue-700">{message}</p> : null}

        <div className="bg-white border border-gray-100 rounded shadow p-4 space-y-3">
          <h2 className="font-semibold">Enqueue Job</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="border border-gray-300 rounded px-3 py-2"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            >
              {jobTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button
              className="bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700 disabled:opacity-60"
              onClick={enqueue}
              disabled={loading}
            >
              Enqueue
            </button>
            <button
              className="bg-gray-900 text-white rounded px-3 py-2 hover:bg-black disabled:opacity-60"
              onClick={runWorker}
              disabled={loading}
            >
              Run Worker (20 jobs)
            </button>
          </div>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 h-24 font-mono text-xs"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
          />
        </div>

        <div className="bg-white border border-gray-100 rounded shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <select
              className="border border-gray-300 rounded px-3 py-2"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                loadJobs(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="pending">pending</option>
              <option value="running">running</option>
              <option value="failed">failed</option>
              <option value="dead_letter">dead_letter</option>
              <option value="succeeded">succeeded</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Attempts</th>
                  <th className="text-left p-2">Next Run</th>
                  <th className="text-left p-2">Error</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job._id} className="border-t border-gray-100">
                    <td className="p-2">{job.type}</td>
                    <td className="p-2">{job.status}</td>
                    <td className="p-2">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="p-2">{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '-'}</td>
                    <td className="p-2 text-red-700">{job.lastError || '-'}</td>
                    <td className="p-2">
                      {['failed', 'dead_letter'].includes(job.status) ? (
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => retryJob(job._id)}
                          disabled={loading}
                        >
                          Retry
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 ? (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={6}>
                      No jobs found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

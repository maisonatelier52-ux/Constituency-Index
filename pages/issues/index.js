import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

function statusPill(status, isOverdue) {
  if (isOverdue) return 'bg-red-100 text-red-700';
  if (status === 'resolved') return 'bg-green-100 text-green-700';
  if (status === 'in_progress') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

export default function IssuesPage() {
  const router = useRouter();
  const [busyIssueId, setBusyIssueId] = useState(null);
  const { data, isLoading, error, mutate } = useSWR('/api/issues', fetcher);
  const issues = data?.issues || [];

  async function handleVote(issueId) {
    setBusyIssueId(issueId);

    try {
      const res = await fetch('/api/issues/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId })
      });

      if (!res.ok) {
        throw new Error('Vote failed');
      }

      await mutate();
    } catch (err) {
      // Keep UX simple in scaffold.
    } finally {
      setBusyIssueId(null);
    }
  }

  return (
    <>
      <Head>
        <title>{t(router.locale, 'issueTracker')} | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">{t(router.locale, 'issueTracker')}</h2>
          <Link href="/issues/map" className="text-blue-700 text-sm hover:text-blue-800">
            {t(router.locale, 'issuesMap')}
          </Link>
        </div>
        {error ? <p className="text-red-600">{t(router.locale, 'failedIssues')}</p> : null}
        <div className="bg-white rounded shadow divide-y">
          {isLoading ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'loading')}</p>
          ) : issues.length === 0 ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'noIssues')}</p>
          ) : (
            issues.map((issue) => (
              <div key={issue._id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{issue.title || issue.category}</p>
                    <p className="text-sm text-gray-700">{issue.description}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusPill(
                      issue.status,
                      issue.isOverdue
                    )}`}
                  >
                    {issue.isOverdue ? t(router.locale, 'overdue').toLowerCase() : issue.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-gray-600 flex flex-wrap gap-3">
                  <span>{t(router.locale, 'category')}: {issue.category}</span>
                  {issue.location ? <span>{t(router.locale, 'location')}: {issue.location}</span> : null}
                  {issue.deadline ? <span>{t(router.locale, 'resolutionDeadline')}: {new Date(issue.deadline).toLocaleDateString()}</span> : null}
                  <span>Votes: {issue.votesCount || 0}</span>
                </div>

                {Array.isArray(issue.evidenceUrls) && issue.evidenceUrls.length > 0 ? (
                  <div className="text-xs text-blue-700">
                    {t(router.locale, 'evidence')}:{' '}
                    {issue.evidenceUrls.map((url, idx) => (
                      <a key={`${url}-${idx}`} href={url} className="underline mr-3" target="_blank" rel="noreferrer">
                        Link {idx + 1}
                      </a>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleVote(issue._id)}
                  disabled={busyIssueId === issue._id}
                  className={`px-3 py-1 rounded text-sm ${
                    issue.hasVoted ? 'bg-gray-200 text-gray-800' : 'bg-blue-600 text-white'
                  }`}
                >
                  {busyIssueId === issue._id
                    ? t(router.locale, 'saving')
                    : issue.hasVoted
                    ? t(router.locale, 'removeVote')
                    : t(router.locale, 'voteUrgent')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

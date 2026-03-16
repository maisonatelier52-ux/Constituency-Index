import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function FeedbackPage() {
  const router = useRouter();
  const { data, error, isLoading } = useSWR('/api/feedback', fetcher);
  const feedback = data?.feedback || [];

  return (
    <>
      <Head>
        <title>{t(router.locale, 'feedbackTitle')} | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t(router.locale, 'feedbackTitle')}</h2>
        {error ? <p className="text-red-600">{t(router.locale, 'failedFeedback')}</p> : null}
        <div className="bg-white rounded shadow divide-y">
          {isLoading ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'loading')}</p>
          ) : feedback.length === 0 ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'noFeedback')}</p>
          ) : (
            feedback.map((item) => (
              <div key={item._id} className="p-4">
                <p className="font-semibold">{item.content}</p>
                <p className="text-xs text-gray-500 mt-1">{t(router.locale, 'rating')}: {item.rating || t(router.locale, 'na')}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

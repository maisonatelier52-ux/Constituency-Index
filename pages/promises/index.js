import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function PromisesPage() {
  const router = useRouter();
  const { data, error, isLoading } = useSWR('/api/promises', fetcher);
  const promises = data?.promises || [];

  return (
    <>
      <Head>
        <title>{t(router.locale, 'promisesTitle')} | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t(router.locale, 'promisesTitle')}</h2>
        {error ? <p className="text-red-600">{t(router.locale, 'failedPromises')}</p> : null}
        <div className="bg-white rounded shadow divide-y">
          {isLoading ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'loading')}</p>
          ) : promises.length === 0 ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'noPromises')}</p>
          ) : (
            promises.map((item) => (
              <div key={item._id} className="p-4">
                <p className="font-semibold">{item.description}</p>
                <p className="text-xs text-gray-500 mt-1">{t(router.locale, 'status')}: {item.status}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function NotificationsPage() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR('/api/notifications', fetcher);
  const notifications = data?.notifications || [];

  async function markAllRead() {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (res.ok) {
      await mutate();
    }
  }

  return (
    <>
      <Head>
        <title>{t(router.locale, 'notificationsTitle')} | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">{t(router.locale, 'notificationsTitle')}</h2>
          <button onClick={markAllRead} className="px-3 py-1 rounded bg-blue-600 text-white text-sm" type="button">
            {t(router.locale, 'markAllRead')}
          </button>
        </div>

        {error ? <p className="text-red-600">{t(router.locale, 'failedNotifications')}</p> : null}

        <div className="bg-white rounded shadow divide-y">
          {isLoading ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'loading')}</p>
          ) : notifications.length === 0 ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'noNotifications')}</p>
          ) : (
            notifications.map((item) => (
              <div key={item._id} className="p-4">
                <p className="text-sm font-medium">{item.message}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

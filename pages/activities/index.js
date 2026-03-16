import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function ActivitiesPage() {
  const router = useRouter();
  const { data, isLoading, error } = useSWR('/api/activities', fetcher);
  const activities = data?.activities || [];

  return (
    <>
      <Head>
        <title>{t(router.locale, 'dailyActivity')} | MP Accountability Tracker</title>
      </Head>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t(router.locale, 'activityLogTitle')}</h2>
        <p className="text-sm text-gray-600">{t(router.locale, 'activityLogSubtitle')}</p>
        {error ? <p className="text-red-600">{t(router.locale, 'failedActivities')}</p> : null}
        <div className="bg-white rounded shadow divide-y">
          {isLoading ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'loading')}</p>
          ) : activities.length === 0 ? (
            <p className="p-4 text-gray-500">{t(router.locale, 'noActivities')}</p>
          ) : (
            activities.map((activity) => (
              <div key={activity._id} className="p-4 space-y-1">
                <p className="font-semibold">{activity.title}</p>
                <p className="text-sm text-gray-700">{activity.description || t(router.locale, 'noDetails')}</p>
                <div className="text-xs text-gray-600 flex flex-wrap gap-3">
                  <span>{t(router.locale, 'representative')}: {activity.representative?.name || t(router.locale, 'na')}</span>
                  <span>{t(router.locale, 'type')}: {activity.activityType}</span>
                  <span>{t(router.locale, 'date')}: {new Date(activity.activityDate).toLocaleDateString()}</span>
                  {activity.location ? <span>{t(router.locale, 'location')}: {activity.location}</span> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

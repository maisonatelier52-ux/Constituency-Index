import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import dbConnect from '@/lib/dbConnect';
import Representative from '@/models/Representative';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

export async function getServerSideProps({ params }) {
  await dbConnect();

  try {
    const rep = await Representative.findById(params.id).populate('constituency').lean();

    if (!rep) {
      return { notFound: true };
    }

    return {
      props: {
        rep: JSON.parse(JSON.stringify(rep))
      }
    };
  } catch (error) {
    return { notFound: true };
  }
}

export default function RepresentativeProfile({ rep }) {
  const router = useRouter();
  const { data } = useSWR(rep?._id ? `/api/activities?representative=${rep._id}` : null, fetcher);
  const activities = data?.activities || [];

  return (
    <>
      <Head>
        <title>{rep.name} | MP Accountability Tracker</title>
        <meta
          name="description"
          content={`Profile and performance of ${rep.name}, ${rep.type}${
            rep.constituency?.name ? ` of ${rep.constituency.name}` : ''
          }.`}
        />
      </Head>

      <div className="space-y-6">
        <h2 className="text-3xl font-bold mb-2">{rep.name}</h2>
        <p className="text-gray-700">
          <strong>{t(router.locale, 'position')}:</strong> {rep.type}
          {rep.constituency?.name ? ` (${t(router.locale, 'constituencies')}: ${rep.constituency.name})` : ''}
        </p>
        {rep.officeLevel || rep.localBodyType || rep.localBodyName || rep.district ? (
          <div className="text-gray-700 space-y-1">
            {rep.officeLevel ? (
              <p>
                <strong>Office Level:</strong> {rep.officeLevel}
              </p>
            ) : null}
            {rep.localBodyType ? (
              <p>
                <strong>Body Type:</strong> {rep.localBodyType}
              </p>
            ) : null}
            {rep.localBodyName ? (
              <p>
                <strong>Local Body:</strong> {rep.localBodyName}
              </p>
            ) : null}
            {rep.district ? (
              <p>
                <strong>District:</strong> {rep.district}
              </p>
            ) : null}
            {rep.transliteratedName ? (
              <p>
                <strong>English Transliteration:</strong> {rep.transliteratedName}
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="text-gray-700">
          <strong>{t(router.locale, 'party')}:</strong> {rep.party || 'Independent'}
        </p>
        <p className="text-gray-700">
          <strong>{t(router.locale, 'attendance')}:</strong> {rep.attendanceRate || 0}%
        </p>
        <p className="text-gray-700">
          <strong>{t(router.locale, 'engagementLevel')}:</strong> {rep.engagementLevel || 'moderate'}
        </p>

        <div className="bg-gray-300 rounded-full w-full h-4">
          <div
            className="bg-green-500 h-4 rounded-full"
            style={{ width: `${rep.attendanceRate || 0}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <h4 className="font-semibold mb-2">{t(router.locale, 'manifestoCommitments')}</h4>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              {(rep.manifesto || []).length === 0 ? <li>{t(router.locale, 'na')}</li> : null}
              {(rep.manifesto || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h4 className="font-semibold mb-2">{t(router.locale, 'achievements')}</h4>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              {(rep.achievements || []).length === 0 ? <li>{t(router.locale, 'na')}</li> : null}
              {(rep.achievements || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h4 className="font-semibold mb-2">{t(router.locale, 'ongoingProjects')}</h4>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            {(rep.ongoingProjects || []).length === 0 ? <li>{t(router.locale, 'na')}</li> : null}
            {(rep.ongoingProjects || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h4 className="font-semibold mb-2">{t(router.locale, 'recentActivities')}</h4>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-600">{t(router.locale, 'noActivityYet')}</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {activities.slice(0, 5).map((activity) => (
                <li key={activity._id}>
                  <strong>{activity.title}</strong> - {new Date(activity.activityDate).toLocaleDateString()} ({' '}
                  {activity.activityType})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

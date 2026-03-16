import Head from 'next/head';
import dbConnect from '@/lib/dbConnect';
import Constituency from '@/models/Constituency';

export async function getServerSideProps({ params }) {
  await dbConnect();

  try {
    const constituency = await Constituency.findOne({ _id: params.id, country: 'US' }).populate('representative').lean();

    if (!constituency) {
      return { notFound: true };
    }

    return {
      props: {
        constituency: JSON.parse(JSON.stringify(constituency))
      }
    };
  } catch (error) {
    return { notFound: true };
  }
}

export default function USConstituencyDetail({ constituency }) {
  return (
    <>
      <Head>
        <title>{constituency.name} | US Constituency</title>
      </Head>

      <div className="space-y-4">
        <h2 className="text-3xl font-bold">{constituency.name}</h2>
        <div className="bg-white p-4 rounded shadow space-y-2">
          <p>
            <strong>Code:</strong> {constituency.code}
          </p>
          <p>
            <strong>State:</strong> {constituency.state}
          </p>
          <p>
            <strong>Type:</strong> {constituency.constituencyType}
          </p>
          <p>
            <strong>Profile:</strong> {constituency.profileType}
          </p>
          <p>
            <strong>Representative:</strong> {constituency.representative?.name || 'Not assigned'}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-2">Index Metrics</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            {Object.entries(constituency.indexMetrics || {}).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

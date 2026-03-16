import Head from 'next/head';
import dbConnect from '@/lib/dbConnect';
import Constituency from '@/models/Constituency';

export async function getServerSideProps({ params }) {
  await dbConnect();

  try {
    const constituency = await Constituency.findOne({ _id: params.id, country: 'IN' }).populate('representative').lean();

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

export default function IndiaConstituencyDetail({ constituency }) {
  return (
    <>
      <Head>
        <title>{constituency.name} | Constituency</title>
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
      </div>
    </>
  );
}

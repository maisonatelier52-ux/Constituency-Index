import Head from 'next/head';
import { useRouter } from 'next/router';
import { t } from '@/lib/i18n';

const responsibilities = [
  'Debate and enact laws in Parliament or Legislative Assembly.',
  'Represent constituency issues in debates, questions, and committees.',
  'Monitor budget allocations and public expenditure outcomes.',
  'Support development projects and social welfare implementation.',
  'Engage with citizens through regular consultations and grievance follow-up.'
];

const accountabilityTools = [
  'Attendance, debate participation, and voting records.',
  'Issue resolution rate and average response timeline.',
  'MPLADS / local development fund utilization and project completion.',
  'Public feedback, ratings, and urgency voting on unresolved issues.'
];

export default function EducationPage() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{t(router.locale, 'educationalSection')} | MP Accountability Tracker</title>
        <meta
          name="description"
          content="Understand MP/MLA constitutional duties, responsibilities, and how citizens can track accountability."
        />
      </Head>

      <div className="space-y-6">
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-2xl font-bold mb-2">{t(router.locale, 'educationTitle')}</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            {responsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded shadow p-6">
          <h3 className="text-xl font-semibold mb-2">{t(router.locale, 'governanceDuties')}</h3>
          <p className="text-gray-700">
            Elected representatives are expected to legislate, oversee executive actions, protect constituency
            interests, and ensure development resources are used transparently.
          </p>
        </div>

        <div className="bg-white rounded shadow p-6">
          <h3 className="text-xl font-semibold mb-2">{t(router.locale, 'accountabilityHow')}</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            {accountabilityTools.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

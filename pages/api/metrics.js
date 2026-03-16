import dbConnect from '@/lib/dbConnect';
import Job from '@/models/Job';
import Issue from '@/models/Issue';
import Representative from '@/models/Representative';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  await dbConnect();

  const [issuesOpen, issuesResolved, jobsFailed, jobsDeadLetter, representatives] = await Promise.all([
    Issue.countDocuments({ status: { $ne: 'resolved' } }),
    Issue.countDocuments({ status: 'resolved' }),
    Job.countDocuments({ status: 'failed' }),
    Job.countDocuments({ status: 'dead_letter' }),
    Representative.countDocuments({})
  ]);

  const body = [
    '# TYPE app_issues_open gauge',
    `app_issues_open ${issuesOpen}`,
    '# TYPE app_issues_resolved gauge',
    `app_issues_resolved ${issuesResolved}`,
    '# TYPE app_jobs_failed gauge',
    `app_jobs_failed ${jobsFailed}`,
    '# TYPE app_jobs_dead_letter gauge',
    `app_jobs_dead_letter ${jobsDeadLetter}`,
    '# TYPE app_representatives_total gauge',
    `app_representatives_total ${representatives}`
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return res.status(200).send(`${body}\n`);
}

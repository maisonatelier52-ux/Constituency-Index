import { enqueueJob, enqueueJobs } from '@/lib/jobs/queue';

export async function enqueueNotificationJob(payload) {
  return enqueueJob({
    type: 'notification.send',
    payload,
    maxAttempts: 5
  });
}

export async function enqueueNotificationJobs(rows) {
  return enqueueJobs(
    rows.map((payload) => ({
      type: 'notification.send',
      payload,
      maxAttempts: 5
    }))
  );
}

export async function enqueueEmailJob(payload) {
  return enqueueJob({
    type: 'email.send',
    payload,
    maxAttempts: 5
  });
}

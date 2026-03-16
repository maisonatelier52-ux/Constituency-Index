import { logger } from '@/lib/logger';
import { enqueueEmailJob } from '@/lib/jobs/enqueue';

function appBaseUrl() {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

export async function sendVerificationEmail({ to, token }) {
  const url = `${appBaseUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;
  await enqueueEmailJob({
    kind: 'verification',
    to,
    url
  });
  logger.info('queue_verification_email', { to, url });
  return { sent: true };
}

export async function sendPasswordResetEmail({ to, token }) {
  const url = `${appBaseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
  await enqueueEmailJob({
    kind: 'password_reset',
    to,
    url
  });
  logger.info('queue_password_reset_email', { to, url });
  return { sent: true };
}

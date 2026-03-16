import nodemailer from 'nodemailer';
import { logger } from '@/lib/logger';

let cachedTransporter = null;

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass }
  };
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const config = smtpConfig();
  if (!config) return null;

  cachedTransporter = nodemailer.createTransport(config);
  return cachedTransporter;
}

export async function sendEmail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!to || !subject || !text || !from) {
    throw new Error('Missing required email fields');
  }

  const transporter = getTransporter();
  if (!transporter) {
    logger.warn('email_smtp_not_configured', { to, subject });
    return { sent: false, skipped: true, reason: 'smtp_not_configured' };
  }

  const result = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });

  return {
    sent: true,
    messageId: result.messageId || null
  };
}

export function buildEmailContent({ kind, url }) {
  if (kind === 'verification') {
    return {
      subject: 'Verify your email',
      text: `Welcome! Verify your email by opening: ${url}`,
      html: `<p>Welcome!</p><p>Verify your email by clicking <a href="${url}">this link</a>.</p>`
    };
  }

  if (kind === 'password_reset') {
    return {
      subject: 'Reset your password',
      text: `Reset your password using this link: ${url}`,
      html: `<p>Reset your password by clicking <a href="${url}">this link</a>.</p>`
    };
  }

  return {
    subject: 'MP Accountability Tracker Notification',
    text: url ? `Open: ${url}` : 'You have a new notification.',
    html: url ? `<p>Open: <a href="${url}">${url}</a></p>` : '<p>You have a new notification.</p>'
  };
}

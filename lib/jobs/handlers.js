import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/Notification';
import Issue from '@/models/Issue';
import Constituency from '@/models/Constituency';
import Job from '@/models/Job';
import { logger } from '@/lib/logger';
import { geocodeByPostalCode, reverseGeocode } from '@/lib/geocoding';
import { importOfficialConstituencies } from '@/lib/importers/officialConstituencies';
import { importConstituencyBoundaries } from '@/lib/importers/boundaries';
import { importRepresentativesPipeline } from '@/lib/importers/representatives';
import { buildEmailContent, sendEmail } from '@/lib/emailProvider';
import { moderateUploadAsset, scanUploadAsset } from '@/lib/uploadReview';

async function handleNotification(payload) {
  await dbConnect();
  const notification = await Notification.create({
    user: payload.user,
    issue: payload.issue || undefined,
    type: payload.type,
    message: payload.message
  });
  return { notificationId: String(notification._id) };
}

async function handleEmail(payload) {
  const kind = payload.kind || 'generic';
  const to = payload.to || '';
  const url = payload.url || '';
  const content = buildEmailContent({ kind, url });
  const result = await sendEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html
  });
  logger.info('email_job_processed', { kind, to, url, sent: result.sent, skipped: result.skipped || false });
  return {
    ...result,
    provider: result.skipped ? 'none' : 'smtp'
  };
}

async function handleGeocode(payload) {
  if (payload.mode === 'postal') {
    const result = await geocodeByPostalCode({
      country: payload.country || 'IN',
      postalCode: payload.postalCode
    });
    return { provider: result.provider, mode: 'postal', hasAddress: Boolean(result.address) };
  }

  if (payload.mode === 'reverse') {
    const result = await reverseGeocode({
      lat: Number(payload.lat),
      lng: Number(payload.lng)
    });
    return { provider: result.provider, mode: 'reverse', hasAddress: Boolean(result.address) };
  }

  throw new Error('Unsupported geocode mode');
}

async function handleImportOfficial(payload) {
  const inputPath = path.resolve(payload.inputPath || path.join(process.cwd(), 'data/constituencies/official_constituencies.csv'));
  return importOfficialConstituencies(inputPath);
}

async function handleImportBoundaries(payload) {
  const inputPath = path.resolve(payload.inputPath || path.join(process.cwd(), 'data/constituencies/boundaries.geojson'));
  return importConstituencyBoundaries(inputPath, payload.options || {});
}

async function handleImportRepresentatives(payload) {
  const inputPath = path.resolve(
    payload.inputPath || path.join(process.cwd(), 'data', 'representatives', 'official_representatives.csv')
  );
  return importRepresentativesPipeline(inputPath, {
    sourceName: payload.sourceName || 'official',
    skipSourceValidation: Boolean(payload.skipSourceValidation),
    dateKey: payload.dateKey
  });
}

async function handleReportGeneration(payload) {
  await dbConnect();
  const [issues, constituencies, jobs] = await Promise.all([
    Issue.countDocuments({}),
    Constituency.countDocuments({}),
    Job.countDocuments({})
  ]);

  const data = {
    ts: new Date().toISOString(),
    issues,
    constituencies,
    jobs,
    scope: payload.scope || 'system'
  };

  const reportsDir = path.join(process.cwd(), 'data', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const outputPath = path.join(reportsDir, `report-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  return { outputPath, ...data };
}

async function handleUploadScan(payload) {
  const result = await scanUploadAsset(payload);
  logger.info('upload_scan_job_processed', result);
  return result;
}

async function handleUploadModeration(payload) {
  const result = await moderateUploadAsset(payload);
  logger.info('upload_moderation_job_processed', result);
  return {
    phase: payload.phase || 'unknown',
    ...result
  };
}

async function handleJobAlert(payload) {
  logger.warn('job_alert_triggered', payload);
  const alertTo = process.env.ALERT_EMAIL_TO;
  let delivery = { sent: false, skipped: true };
  if (alertTo) {
    const result = await sendEmail({
      to: alertTo,
      subject: `[MP Tracker] Job alert: ${payload.failedJobType || payload.reason || 'job issue'}`,
      text: JSON.stringify(payload, null, 2),
      html: `<pre>${JSON.stringify(payload, null, 2)}</pre>`
    });
    delivery = result;
  }
  return {
    alerted: true,
    reason: payload.reason || 'unspecified',
    delivery
  };
}

export const JOB_HANDLERS = {
  'notification.send': handleNotification,
  'email.send': handleEmail,
  'geocode.lookup': handleGeocode,
  'upload.scan': handleUploadScan,
  'upload.moderate': handleUploadModeration,
  'import.official_constituencies': handleImportOfficial,
  'import.boundaries': handleImportBoundaries,
  'import.representatives': handleImportRepresentatives,
  'report.generate': handleReportGeneration,
  'job.alert': handleJobAlert
};

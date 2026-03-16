// import crypto from 'crypto';
// import { z } from 'zod';
// import { requireAuth } from '@/lib/apiAuth';
// import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
// import { logger } from '@/lib/logger';
// import { writeAuditLog } from '@/lib/audit';
// import { enqueueJob } from '@/lib/jobs/queue';

// const DEFAULT_ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mkv'];
// const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
// const DEFAULT_MAX_FILES = 5;

// const bodySchema = z.object({
//   folder: z.string().trim().min(1).max(80).optional()
// });

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     res.setHeader('Allow', ['POST']);
//     return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
//   }
//   const bodyAllowed = enforceMaxBodySize(req, res, 64 * 1024);
//   if (!bodyAllowed) return;

//   const session = await requireAuth(req, res, ['citizen', 'admin', 'agent']);
//   if (!session) return;

//   const ip = getClientIp(req);
//   const allowed = await enforceRateLimit(req, res, {
//     keyPrefix: 'upload_signature',
//     windowMs: 60_000,
//     max: 30,
//     id: `${session.user.id}:${ip}`
//   });
//   if (!allowed) return;

//   const parsed = bodySchema.safeParse(req.body || {});
//   if (!parsed.success) {
//     return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid signature payload' });
//   }

//   const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
//   const apiKey = process.env.CLOUDINARY_API_KEY;
//   const apiSecret = process.env.CLOUDINARY_API_SECRET;

//   if (!cloudName || !apiKey || !apiSecret) {
//     logger.error('cloudinary_env_missing', { path: req.url });
//     return res.status(500).json({ error: 'Cloudinary environment variables are not configured' });
//   }

//   try {
//     const timestamp = Math.floor(Date.now() / 1000);
//     const folder = (parsed.data.folder || 'issues').replace(/[^a-zA-Z0-9/_-]/g, '');

//     const allowedFormats = (process.env.UPLOAD_ALLOWED_FORMATS || DEFAULT_ALLOWED_FORMATS.join(','))
//       .split(',')
//       .map((item) => item.trim().toLowerCase())
//       .filter(Boolean);

//     const maxFileSize = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES || DEFAULT_MAX_FILE_SIZE);
//     const maxFiles = Number(process.env.UPLOAD_MAX_FILES || DEFAULT_MAX_FILES);

//     const toSignParts = [
//       `allowed_formats=${allowedFormats.join(',')}`,
//       `folder=${folder}`,
//       `max_file_size=${maxFileSize}`,
//       `timestamp=${timestamp}`
//     ];

//     const signature = crypto
//       .createHash('sha1')
//       .update(`${toSignParts.join('&')}${apiSecret}`)
//       .digest('hex');

//     return res.status(200).json({
//       cloudName,
//       apiKey,
//       timestamp,
//       folder,
//       signature,
//       allowedFormats,
//       maxFileSize,
//       maxFiles,
//       uploadContext: {
//         requestedBy: session.user.id,
//         requestedAt: new Date().toISOString()
//       }
//     });
//   } catch (error) {
//     logger.error('upload_signature_failed', { error: error.message, userId: session.user.id });
//     return res.status(500).json({ error: 'Failed to generate upload signature' });
//   } finally {
//     await enqueueJob({
//       type: 'upload.moderate',
//       payload: {
//         phase: 'signature_requested',
//         userId: session.user.id,
//         ip,
//         folder: parsed.success ? (parsed.data.folder || 'issues') : 'issues'
//       },
//       maxAttempts: 3
//     });
//     await writeAuditLog(req, {
//       actorUser: session.user.id,
//       action: 'upload.signature_requested',
//       targetType: 'UploadPolicy'
//     });
//   }
// }


import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth } from '@/lib/apiAuth';
import { enforceMaxBodySize, enforceRateLimit, getClientIp } from '@/lib/apiSecurity';
import { logger } from '@/lib/logger';
import { writeAuditLog } from '@/lib/audit';
import { enqueueJob } from '@/lib/jobs/queue';

const DEFAULT_ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mkv'];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_FILES = 5;

const bodySchema = z.object({
  folder: z.string().trim().min(1).max(80).optional()
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const bodyAllowed = enforceMaxBodySize(req, res, 64 * 1024);
  if (!bodyAllowed) return;

  const session = await requireAuth(req, res, ['citizen', 'admin', 'agent']);
  if (!session) return;

  const ip = getClientIp(req);
  const allowed = await enforceRateLimit(req, res, {
    keyPrefix: 'upload_signature',
    windowMs: 60_000,
    max: 30,
    id: `${session.user.id}:${ip}`
  });
  if (!allowed) return;

  const parsed = bodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid signature payload' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    logger.error('cloudinary_env_missing', { path: req.url });
    return res.status(500).json({ error: 'Cloudinary environment variables are not configured' });
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = (parsed.data.folder || 'issues').replace(/[^a-zA-Z0-9/_-]/g, '');

    const allowedFormats = (process.env.UPLOAD_ALLOWED_FORMATS || DEFAULT_ALLOWED_FORMATS.join(','))
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const maxFileSize = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES || DEFAULT_MAX_FILE_SIZE);
    const maxFiles = Number(process.env.UPLOAD_MAX_FILES || DEFAULT_MAX_FILES);

    // max_file_size removed — not a valid Cloudinary signature parameter
    const toSignParts = [
      `allowed_formats=${allowedFormats.join(',')}`,
      `folder=${folder}`,
      `timestamp=${timestamp}`
    ];

    const signature = crypto
      .createHash('sha1')
      .update(`${toSignParts.join('&')}${apiSecret}`)
      .digest('hex');

    return res.status(200).json({
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      allowedFormats,
      maxFileSize,
      maxFiles,
      uploadContext: {
        requestedBy: session.user.id,
        requestedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('upload_signature_failed', { error: error.message, userId: session.user.id });
    return res.status(500).json({ error: 'Failed to generate upload signature' });
  } finally {
    await enqueueJob({
      type: 'upload.moderate',
      payload: {
        phase: 'signature_requested',
        userId: session.user.id,
        ip,
        folder: parsed.success ? (parsed.data.folder || 'issues') : 'issues'
      },
      maxAttempts: 3
    });
    await writeAuditLog(req, {
      actorUser: session.user.id,
      action: 'upload.signature_requested',
      targetType: 'UploadPolicy'
    });
  }
}
import dbConnect from '@/lib/dbConnect';
import AuditLog from '@/models/AuditLog';
import { getClientIp } from '@/lib/apiSecurity';
import { logger } from '@/lib/logger';

export async function writeAuditLog(req, payload) {
  try {
    await dbConnect();
    await AuditLog.create({
      actorUser: payload.actorUser || null,
      action: payload.action,
      targetType: payload.targetType || null,
      targetId: payload.targetId ? String(payload.targetId) : null,
      ip: getClientIp(req),
      metadata: payload.metadata || {}
    });
  } catch (error) {
    logger.error('audit_log_write_failed', { error: error.message, action: payload.action });
  }
}

import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    ip: { type: String, default: 'unknown' },
    metadata: { type: Object, default: {} }
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

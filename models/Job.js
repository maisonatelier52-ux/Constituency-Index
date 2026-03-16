import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'running', 'failed', 'succeeded', 'dead_letter'],
      default: 'pending',
      index: true
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 3, min: 1, max: 20 },
    nextRunAt: { type: Date, default: Date.now, index: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    lastError: { type: String, default: null },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

JobSchema.index({ status: 1, nextRunAt: 1, createdAt: 1 });

export default mongoose.models.Job || mongoose.model('Job', JobSchema);

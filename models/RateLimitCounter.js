import mongoose from 'mongoose';

const RateLimitCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    windowStart: { type: Date, required: true, index: true },
    count: { type: Number, required: true, min: 0, default: 0 },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

RateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RateLimitCounter || mongoose.model('RateLimitCounter', RateLimitCounterSchema);

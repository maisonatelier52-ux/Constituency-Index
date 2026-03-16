import mongoose from 'mongoose';

const AuthTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['email_verification', 'password_reset'], required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AuthToken || mongoose.model('AuthToken', AuthTokenSchema);

import mongoose from 'mongoose';

const PromiseSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'fulfilled', 'broken'],
      default: 'pending'
    },
    representative: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Representative'
    },
    constituency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Constituency'
    }
  },
  { timestamps: true }
);

export default mongoose.models.Promise || mongoose.model('Promise', PromiseSchema);

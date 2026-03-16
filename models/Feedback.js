import mongoose from 'mongoose';

const FeedbackSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    representative: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Representative'
    },
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue'
    }
  },
  { timestamps: true }
);

export default mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);

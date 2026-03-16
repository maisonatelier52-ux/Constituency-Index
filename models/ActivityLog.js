import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    representative: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Representative',
      required: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    activityType: {
      type: String,
      enum: ['event', 'project', 'meeting', 'field_visit', 'other'],
      default: 'other'
    },
    location: { type: String, trim: true },
    activityDate: { type: Date, required: true },
    visibility: {
      type: String,
      enum: ['public', 'internal'],
      default: 'public'
    }
  },
  { timestamps: true }
);

export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);

import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue'
    },
    type: {
      type: String,
      enum: ['issue_created', 'issue_updated', 'deadline_updated', 'status_updated'],
      required: true
    },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

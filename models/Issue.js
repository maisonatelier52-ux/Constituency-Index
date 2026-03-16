import mongoose from 'mongoose';

const IssueStatusUpdateSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      required: true
    },
    note: { type: String, trim: true },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const IssueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    locationTags: [{ type: String, trim: true }],
    evidenceUrls: [{ type: String, trim: true }],
    geo: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    deadline: { type: Date },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open'
    },
    statusHistory: [IssueStatusUpdateSchema],
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    constituency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Constituency'
    },
    resolvedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.models.Issue || mongoose.model('Issue', IssueSchema);

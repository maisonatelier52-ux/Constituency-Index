import mongoose from 'mongoose';
import { JURISDICTION_TYPES, LOCAL_BODY_TYPES, OFFICE_LEVELS, STATUS_TYPES } from '@/lib/politicsScope';

const RepresentativeSchema = new mongoose.Schema(
  {
    canonicalId: { type: String, trim: true, index: true, unique: true, sparse: true },
    fullName: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['MP', 'MLA'], required: true },
    officeLevel: {
      type: String,
      enum: OFFICE_LEVELS,
      default: 'other_local_representative',
      index: true
    },
    officeTitle: { type: String, trim: true },
    jurisdictionType: {
      type: String,
      enum: JURISDICTION_TYPES,
      default: 'constituency'
    },
    jurisdictionCode: { type: String, trim: true },
    country: { type: String, enum: ['IN', 'US'], default: 'IN' },
    state: { type: String, trim: true },
    district: { type: String, trim: true },
    block: { type: String, trim: true },
    ward: { type: String, trim: true },
    localBodyType: {
      type: String,
      enum: LOCAL_BODY_TYPES,
      default: 'other'
    },
    localBodyName: { type: String, trim: true },
    normalizedName: { type: String, trim: true },
    transliteratedName: { type: String, trim: true },
    party: { type: String, trim: true },
    termStart: { type: Date },
    termEnd: { type: Date },
    sourceUrl: { type: String, trim: true },
    sourceLastUpdated: { type: Date },
    status: {
      type: String,
      enum: STATUS_TYPES,
      default: 'active'
    },
    constituency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Constituency'
    },
    attendanceRate: { type: Number, default: 0, min: 0, max: 100 },
    engagementLevel: {
      type: String,
      enum: ['low', 'moderate', 'high'],
      default: 'moderate'
    },
    manifesto: [{ type: String, trim: true }],
    achievements: [{ type: String, trim: true }],
    ongoingProjects: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

RepresentativeSchema.index({ officeLevel: 1, state: 1, jurisdictionCode: 1 });
RepresentativeSchema.index({ district: 1, localBodyType: 1, localBodyName: 1 });
RepresentativeSchema.index({ status: 1 });
RepresentativeSchema.index({ sourceLastUpdated: -1 });

export default mongoose.models.Representative || mongoose.model('Representative', RepresentativeSchema);

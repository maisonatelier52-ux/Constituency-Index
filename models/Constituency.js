import mongoose from 'mongoose';

const GeoBoundarySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Polygon', 'MultiPolygon'],
      required: true
    },
    coordinates: {
      type: Array,
      required: true
    }
  },
  { _id: false }
);

const ConstituencySchema = new mongoose.Schema(
  {
    country: {
      type: String,
      enum: ['IN', 'US'],
      default: 'IN',
      index: true
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    state: { type: String, trim: true },
    constituencyType: {
      type: String,
      enum: ['parliamentary', 'assembly', 'congressional_district', 'senate_statewide'],
      default: 'assembly'
    },
    profileType: {
      type: String,
      enum: ['urban', 'rural', 'universal'],
      default: 'universal'
    },
    geoBoundary: GeoBoundarySchema,
    centroid: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    indexWeights: {
      promises: { type: Number, min: 0 },
      infrastructure: { type: Number, min: 0 },
      welfare: { type: Number, min: 0 },
      employment: { type: Number, min: 0 },
      education: { type: Number, min: 0 },
      healthcare: { type: Number, min: 0 },
      environment: { type: Number, min: 0 }
    },
    indexMetrics: {
      promises: { type: Number, default: 0, min: 0, max: 100 },
      infrastructure: { type: Number, default: 0, min: 0, max: 100 },
      welfare: { type: Number, default: 0, min: 0, max: 100 },
      employment: { type: Number, default: 0, min: 0, max: 100 },
      education: { type: Number, default: 0, min: 0, max: 100 },
      healthcare: { type: Number, default: 0, min: 0, max: 100 },
      environment: { type: Number, default: 0, min: 0, max: 100 }
    },
    representative: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Representative'
    }
  },
  { timestamps: true }
);

export default mongoose.models.Constituency || mongoose.model('Constituency', ConstituencySchema);

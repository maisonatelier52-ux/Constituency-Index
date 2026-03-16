/* eslint-disable no-console */
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mp-accountability-tracker';

const STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

const ConstituencySchema = new mongoose.Schema(
  {
    name: String,
    code: String,
    state: String,
    constituencyType: { type: String, enum: ['parliamentary', 'assembly'] },
    profileType: { type: String, enum: ['urban', 'rural', 'universal'] },
    indexMetrics: {
      promises: Number,
      infrastructure: Number,
      welfare: Number,
      employment: Number,
      education: Number,
      healthcare: Number,
      environment: Number
    }
  },
  { timestamps: true }
);

const Constituency = mongoose.models.Constituency || mongoose.model('Constituency', ConstituencySchema);

function profileTypeFor(i) {
  const mod = i % 3;
  if (mod === 0) return 'urban';
  if (mod === 1) return 'rural';
  return 'universal';
}

function metricsFor(i) {
  const base = 45 + (i % 40);
  return {
    promises: Math.min(95, base + 3),
    infrastructure: Math.min(95, base + 1),
    welfare: Math.min(95, base - 1),
    employment: Math.min(95, base + 2),
    education: Math.min(95, base),
    healthcare: Math.min(95, base - 2),
    environment: Math.min(95, base - 4)
  };
}

function buildDocs(total, type, prefix) {
  return Array.from({ length: total }, (_, idx) => {
    const n = idx + 1;
    const digits = type === 'parliamentary' ? 3 : 4;
    const code = `${prefix}-${String(n).padStart(digits, '0')}`;

    return {
      name: `${type === 'parliamentary' ? 'Lok Sabha' : 'Vidhan Sabha'} Constituency ${String(n).padStart(
        digits,
        '0'
      )}`,
      code,
      state: STATES[idx % STATES.length],
      constituencyType: type,
      profileType: profileTypeFor(idx),
      indexMetrics: metricsFor(idx)
    };
  });
}

async function run() {
  await mongoose.connect(MONGODB_URI);

  const parliamentary = buildDocs(543, 'parliamentary', 'PC');
  const assembly = buildDocs(4123, 'assembly', 'AC');
  const docs = [...parliamentary, ...assembly];

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { code: doc.code },
      update: { $set: doc },
      upsert: true
    }
  }));

  const result = await Constituency.bulkWrite(ops, { ordered: false });

  console.log('Seed completed');
  console.log(`Upserted: ${result.upsertedCount || 0}`);
  console.log(`Modified: ${result.modifiedCount || 0}`);
  console.log(`Total targeted: ${docs.length}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

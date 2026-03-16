/* eslint-disable no-console */
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mp-accountability-tracker';

const HOUSE_APPORTIONMENT = {
  AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14,
  HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8,
  MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12,
  NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7,
  SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1
};

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming'
};

const ConstituencySchema = new mongoose.Schema(
  {
    country: String,
    name: String,
    code: String,
    state: String,
    constituencyType: String,
    profileType: String,
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

function metricsFor(i) {
  const base = 50 + (i % 35);
  return {
    promises: Math.min(95, base + 1),
    infrastructure: Math.min(95, base),
    welfare: Math.min(95, base - 2),
    employment: Math.min(95, base + 2),
    education: Math.min(95, base + 1),
    healthcare: Math.min(95, base - 1),
    environment: Math.min(95, base - 3)
  };
}

async function run() {
  await mongoose.connect(MONGODB_URI);

  const docs = [];
  let i = 0;

  for (const [abbr, seats] of Object.entries(HOUSE_APPORTIONMENT)) {
    const state = STATE_NAMES[abbr] || abbr;

    for (let d = 1; d <= seats; d += 1) {
      docs.push({
        country: 'US',
        name: `${state} Congressional District ${d}`,
        code: `US-HOUSE-${abbr}-${String(d).padStart(2, '0')}`,
        state,
        constituencyType: 'congressional_district',
        profileType: d % 2 === 0 ? 'urban' : 'universal',
        indexMetrics: metricsFor(i++)
      });
    }

    docs.push({
      country: 'US',
      name: `${state} Senate (Statewide)`,
      code: `US-SEN-${abbr}`,
      state,
      constituencyType: 'senate_statewide',
      profileType: 'universal',
      indexMetrics: metricsFor(i++)
    });
  }

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { code: doc.code },
      update: { $set: doc },
      upsert: true
    }
  }));

  const result = await Constituency.bulkWrite(ops, { ordered: false });

  console.log('US constituency seed completed');
  console.log(`Total targeted: ${docs.length}`);
  console.log(`Upserted: ${result.upsertedCount || 0}`);
  console.log(`Modified: ${result.modifiedCount || 0}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

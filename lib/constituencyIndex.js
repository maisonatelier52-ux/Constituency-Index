export const WEIGHT_PRESETS = {
  urban: {
    promises: 20,
    infrastructure: 15,
    welfare: 20,
    employment: 25,
    education: 10,
    healthcare: 10,
    environment: 5
  },
  rural: {
    promises: 20,
    infrastructure: 30,
    welfare: 20,
    employment: 15,
    education: 10,
    healthcare: 15,
    environment: 5
  },
  universal: {
    promises: 25,
    infrastructure: 25,
    welfare: 20,
    employment: 15,
    education: 10,
    healthcare: 10,
    environment: 5
  }
};

const METRIC_KEYS = ['promises', 'infrastructure', 'welfare', 'employment', 'education', 'healthcare', 'environment'];

export function normalizeWeights(weights) {
  const total = METRIC_KEYS.reduce((sum, key) => sum + Number(weights?.[key] || 0), 0);
  if (total <= 0) {
    return WEIGHT_PRESETS.universal;
  }

  return METRIC_KEYS.reduce((acc, key) => {
    acc[key] = (Number(weights?.[key] || 0) / total) * 100;
    return acc;
  }, {});
}

export function computeConstituencyIndex({ metrics = {}, weights = WEIGHT_PRESETS.universal }) {
  const normalizedWeights = normalizeWeights(weights);

  let score = 0;
  for (const key of METRIC_KEYS) {
    const metricValue = Number(metrics[key] || 0);
    score += (normalizedWeights[key] / 100) * metricValue;
  }

  return Number(score.toFixed(2));
}

export function resolveWeights(profile = 'universal', customWeights = null) {
  if (customWeights) {
    return normalizeWeights(customWeights);
  }

  return WEIGHT_PRESETS[profile] || WEIGHT_PRESETS.universal;
}

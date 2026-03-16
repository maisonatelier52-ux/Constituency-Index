// import dbConnect from '@/lib/dbConnect';
// import RateLimitCounter from '@/models/RateLimitCounter';

// function bucketStart(windowMs) {
//   return Math.floor(Date.now() / windowMs) * windowMs;
// }

// export async function checkRateLimit(key, { windowMs, max }) {
//   await dbConnect();

//   const startMs = bucketStart(windowMs);
//   const windowStart = new Date(startMs);
//   const expiresAt = new Date(startMs + windowMs * 2);

//   const doc = await RateLimitCounter.findOneAndUpdate(
//     { key, windowStart },
//     {
//       $setOnInsert: {
//         key,
//         windowStart,
//         expiresAt
//       },
//       $inc: { count: 1 }
//     },
//     {
//       upsert: true,
//       new: true
//     }
//   ).lean();

//   const count = doc?.count || 0;
//   const allowed = count <= max;
//   return {
//     allowed,
//     remaining: Math.max(0, max - count),
//     retryAfterMs: allowed ? 0 : Math.max(0, startMs + windowMs - Date.now())
//   };
// }

import dbConnect from '@/lib/dbConnect';
import RateLimitCounter from '@/models/RateLimitCounter';

function bucketStart(windowMs) {
  return Math.floor(Date.now() / windowMs) * windowMs;
}

export async function checkRateLimit(key, { windowMs, max }) {
  await dbConnect();

  const startMs = bucketStart(windowMs);
  const windowStart = new Date(startMs);
  const expiresAt = new Date(startMs + windowMs * 2);

  try {
    const doc = await RateLimitCounter.findOneAndUpdate(
      { key, windowStart },
      {
        $setOnInsert: {
          key,
          windowStart,
          expiresAt
        },
        $inc: { count: 1 }
      },
      {
        upsert: true,
        new: true
      }
    ).lean();

    const count = doc?.count || 0;
    const allowed = count <= max;
    return {
      allowed,
      remaining: Math.max(0, max - count),
      retryAfterMs: allowed ? 0 : Math.max(0, startMs + windowMs - Date.now())
    };
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key on concurrent upsert — retry with a plain find
      const doc = await RateLimitCounter.findOneAndUpdate(
        { key, windowStart },
        { $inc: { count: 1 } },
        { new: true }
      ).lean();

      const count = doc?.count || 0;
      const allowed = count <= max;
      return {
        allowed,
        remaining: Math.max(0, max - count),
        retryAfterMs: allowed ? 0 : Math.max(0, startMs + windowMs - Date.now())
      };
    }
    throw err;
  }
}

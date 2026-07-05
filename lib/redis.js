const { Redis } = require('@upstash/redis');

// Redis.fromEnv() reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
// automatically (these are set for you if you install the Upstash Redis
// integration from the Vercel Marketplace — see README for exact steps,
// since Vercel's own "Vercel KV" product was deprecated and migrated to
// Upstash in December 2024, and new projects go through the Marketplace
// integration instead).
//
// This module-level client is created once per serverless function
// instance and reused across invocations on the same warm instance
// (Vercel keeps instances warm between requests when traffic is frequent
// enough) — this doesn't persist across cold starts, but it avoids
// creating a brand new client on every single request when the instance
// is already warm.
let redisClient = null;

function getRedis() {
  if (!redisClient) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. ' +
          'Install the Upstash Redis integration from the Vercel Marketplace ' +
          'and connect it to this project — see README.md for exact steps.'
      );
    }
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

module.exports = { getRedis };

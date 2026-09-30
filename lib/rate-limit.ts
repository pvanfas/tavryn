// In-memory sliding window rate limiter for agent and cron routes

import {
  RATE_LIMIT_CLEANUP_INTERVAL_MS,
  RATE_LIMIT_STALE_THRESHOLD_MS,
} from "@/lib/constants";

interface RateLimitRecord {
  timestamps: number[];
}

const memoryStore = new Map<string, RateLimitRecord>();

// Periodically clean up stale entries to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      record.timestamps = record.timestamps.filter(
        (ts) => now - ts < RATE_LIMIT_STALE_THRESHOLD_MS,
      );
      if (record.timestamps.length === 0) {
        memoryStore.delete(key);
      }
    }
  }, RATE_LIMIT_CLEANUP_INTERVAL_MS).unref?.();
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Check and record a rate limit hit using a sliding window.
 * @param key Unique key for client/route (e.g. IP address, businessId, or route name)
 * @param limit Maximum allowed requests within window
 * @param windowMs Window duration in milliseconds (e.g. 60_000 for 1 minute)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let record = memoryStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    memoryStore.set(key, record);
  }

  // Filter timestamps within the current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldestTimestamp));
    return {
      success: false,
      limit,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    limit,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}

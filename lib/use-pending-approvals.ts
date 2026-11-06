"use client";

import { useEffect, useState } from "react";

// Module-level cache and subscriber set to share state and deduplicate calls
// across AppSidebar and MobileTabBar without firing multiple concurrent network requests.
let cachedCount = 0;
let lastFetchedAt = 0;
let inflightPromise: Promise<number> | null = null;
const subscribers = new Set<(count: number) => void>();

async function fetchApprovalsCount(businessId?: string): Promise<number> {
  // Never poll in background or hidden tabs
  if (typeof document !== "undefined" && document.hidden) {
    return cachedCount;
  }

  const now = Date.now();
  // Throttle: if fetched within last 15 seconds, reuse existing count
  if (now - lastFetchedAt < 15_000 && lastFetchedAt > 0) {
    return cachedCount;
  }

  // Deduplicate concurrent in-flight requests
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const query = businessId
        ? `?businessId=${encodeURIComponent(businessId)}`
        : "";
      const res = await fetch(`/api/approvals/count${query}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === "number") {
          cachedCount = data.count;
          lastFetchedAt = Date.now();
          subscribers.forEach((cb) => cb(cachedCount));
          return cachedCount;
        }
      }
    } catch {
      // Ignore network hiccups
    } finally {
      inflightPromise = null;
    }
    return cachedCount;
  })();

  return inflightPromise;
}

export function usePendingApprovals(activeBusinessId?: string): number {
  const [count, setCount] = useState<number>(cachedCount);

  useEffect(() => {
    subscribers.add(setCount);

    // Initial fetch (deduplicated across subscribers)
    fetchApprovalsCount(activeBusinessId);

    // Poll every 60s only when tab is active
    const interval = setInterval(() => {
      fetchApprovalsCount(activeBusinessId);
    }, 60_000);

    // Re-fetch immediately when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchApprovalsCount(activeBusinessId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscribers.delete(setCount);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeBusinessId]);

  return count;
}


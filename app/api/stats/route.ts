import { NextRequest, NextResponse } from "next/server";

import { getTractionMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/**
 * Public stats endpoint — no auth required.
 * Returns aggregate counts only, no business-identifying detail.
 * Cached in 5-minute intervals to protect against high request volumes,
 * with immediate re-computation on custom refresh (?refresh=true).
 * Rate-limited: 60 requests per IP per minute via headers.
 */

const STATS_INTERVAL_MS = 5 * 60 * 1000; // 5 minute interval

interface StatsSummary {
  generatedAt: string;
  interval: string;
  nextUpdateAt: string;
  isCustomRefresh?: boolean;
  totalRealBusinesses: number;
  totalContractsAnalyzed: number;
  totalNegotiations: number;
  totalUsdcMoved: number;
  totalUsdcEscrowed: number;
  decisionsAutoApproved: number;
  decisionsEscalated: number;
  humanAgreementRatePct: number;
  reviewerAgreementRatePct: number;
  savingsNegotiated: number;
  savingsRealized: number;
  savingsRatePct: number;
}

// In-memory 5-minute interval cache
let cachedStats: StatsSummary | null = null;
let cachedAt = 0;
let inflightCalculation: Promise<StatsSummary> | null = null;

// Simple in-memory rate limiter (per-instance, resets on redeploy)
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

async function calculateStats(isCustom = false): Promise<StatsSummary> {
  const metrics = await getTractionMetrics({ realOnly: true });

  const totalDecisions =
    metrics.governance.humanApprovedCount +
    metrics.governance.humanRejectedCount +
    metrics.governance.humanPendingCount;
  const autoApproved = metrics.governance.agentDecisionsCount - totalDecisions;

  const now = Date.now();
  return {
    generatedAt: metrics.generatedAt,
    interval: "5m",
    nextUpdateAt: new Date(now + STATS_INTERVAL_MS).toISOString(),
    isCustomRefresh: isCustom,
    totalRealBusinesses: metrics.businesses.realCount,
    totalContractsAnalyzed: metrics.contractsAndNegotiations.contractsTotal,
    totalNegotiations: metrics.contractsAndNegotiations.negotiationsRun,
    totalUsdcMoved: metrics.usdcVolume.released,
    totalUsdcEscrowed: metrics.usdcVolume.escrowed,
    decisionsAutoApproved: Math.max(0, autoApproved),
    decisionsEscalated: metrics.governance.humanEscalationsCount,
    humanAgreementRatePct: metrics.governance.humanApprovalRatePct,
    reviewerAgreementRatePct:
      metrics.reviewer.totalReviews > 0
        ? Math.round(
            (metrics.reviewer.agreedCount / metrics.reviewer.totalReviews) *
              1000,
          ) / 10
        : 100,
    savingsNegotiated: metrics.savings.negotiated,
    savingsRealized: metrics.savings.realized,
    savingsRatePct: metrics.savings.savingsRatePct,
  };
}

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 60 requests per minute." },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const url = new URL(req.url);
  const isCustomRefresh =
    url.searchParams.get("refresh") === "true" ||
    url.searchParams.get("custom") === "true" ||
    url.searchParams.get("fresh") === "true" ||
    url.searchParams.get("force") === "true" ||
    req.headers.get("x-custom-refresh") === "true";

  const now = Date.now();

  try {
    // 1. Custom refresh: bypass 5-minute interval cache and re-compute fresh stats immediately
    if (isCustomRefresh) {
      const stats = await calculateStats(true);
      cachedStats = stats;
      cachedAt = Date.now();

      return NextResponse.json(
        { ok: true, stats },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Stats-Interval": "5m",
            "X-Stats-Refresh": "custom",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // 2. Standard request: return 5-minute interval cache if fresh
    if (cachedStats && now - cachedAt < STATS_INTERVAL_MS) {
      return NextResponse.json(
        { ok: true, stats: cachedStats },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            "X-Stats-Interval": "5m",
            "X-Stats-Cache": "HIT",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // 3. Interval expired: compute next 5-minute interval snapshot (deduplicated)
    if (!inflightCalculation) {
      inflightCalculation = calculateStats(false)
        .then((fresh) => {
          cachedStats = fresh;
          cachedAt = Date.now();
          return fresh;
        })
        .finally(() => {
          inflightCalculation = null;
        });
    }

    const stats = await inflightCalculation;

    return NextResponse.json(
      { ok: true, stats },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
          "X-Stats-Interval": "5m",
          "X-Stats-Cache": "MISS",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("[/api/stats] Error:", error);

    // Fallback gracefully to stale cached stats if DB has transient issues
    if (cachedStats) {
      return NextResponse.json(
        { ok: true, stats: cachedStats, stale: true },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
            "X-Stats-Interval": "5m",
            "X-Stats-Fallback": "stale",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    return NextResponse.json(
      { error: "Failed to compute stats" },
      { status: 500 },
    );
  }
}

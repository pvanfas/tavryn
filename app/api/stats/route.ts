import { NextRequest, NextResponse } from "next/server";

import { getTractionMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/**
 * Public stats endpoint — no auth required.
 * Returns aggregate counts only, no business-identifying detail.
 * Rate-limited: 60 requests per IP per minute via headers.
 */

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

  try {
    const metrics = await getTractionMetrics({ realOnly: true });

    // Compute aggregate-only public summary — no names, wallet addresses, or transaction details
    const totalDecisions =
      metrics.governance.humanApprovedCount +
      metrics.governance.humanRejectedCount +
      metrics.governance.humanPendingCount;
    const autoApproved =
      metrics.governance.agentDecisionsCount - totalDecisions;

    const stats = {
      generatedAt: metrics.generatedAt,
      totalRealBusinesses: metrics.businesses.realCount,
      totalContractsAnalyzed:
        metrics.contractsAndNegotiations.contractsTotal,
      totalNegotiations: metrics.contractsAndNegotiations.negotiationsRun,
      totalUsdcMoved: metrics.usdcVolume.released,
      totalUsdcEscrowed: metrics.usdcVolume.escrowed,
      decisionsAutoApproved: Math.max(0, autoApproved),
      decisionsEscalated: metrics.governance.humanEscalationsCount,
      humanAgreementRatePct: metrics.governance.humanApprovalRatePct,
      reviewerAgreementRatePct:
        metrics.reviewer.totalReviews > 0
          ? Math.round(
              (metrics.reviewer.agreedCount /
                metrics.reviewer.totalReviews) *
                1000,
            ) / 10
          : 100,
      savingsNegotiated: metrics.savings.negotiated,
      savingsRealized: metrics.savings.realized,
      savingsRatePct: metrics.savings.savingsRatePct,
    };

    return NextResponse.json(
      { ok: true, stats },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("[/api/stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to compute stats" },
      { status: 500 },
    );
  }
}

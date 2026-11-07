import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/metrics", () => {
  let callCount = 0;
  return {
    getTractionMetrics: vi.fn(async () => {
      callCount++;
      return {
        generatedAt: `2026-11-07T12:00:0${callCount}.000Z`,
        businesses: { realCount: 12 + callCount },
        contractsAndNegotiations: {
          contractsTotal: 40 + callCount,
          negotiationsRun: 25,
        },
        usdcVolume: { released: 150000, escrowed: 50000 },
        governance: {
          humanApprovedCount: 10,
          humanRejectedCount: 2,
          humanPendingCount: 1,
          agentDecisionsCount: 50,
          humanEscalationsCount: 3,
          humanApprovalRatePct: 83.3,
        },
        reviewer: { totalReviews: 30, agreedCount: 29 },
        savings: { negotiated: 45000, realized: 38000, savingsRatePct: 25.3 },
      };
    }),
  };
});

describe("/api/stats 5-minute interval caching & custom refresh", () => {
  it("serves stats with 5m interval metadata and caches subsequent calls", async () => {
    const { GET } = await import("../app/api/stats/route");

    const req1 = new NextRequest("http://localhost:3000/api/stats");
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);

    const json1 = await res1.json();
    expect(json1.ok).toBe(true);
    expect(json1.stats.interval).toBe("5m");
    expect(json1.stats.nextUpdateAt).toBeDefined();
    expect(res1.headers.get("Cache-Control")).toContain("s-maxage=300");

    // Second request should be a cache hit within 5 minutes
    const req2 = new NextRequest("http://localhost:3000/api/stats");
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-Stats-Cache")).toBe("HIT");

    const json2 = await res2.json();
    expect(json2.stats.generatedAt).toBe(json1.stats.generatedAt);
  });

  it("custom refresh (?refresh=true) bypasses 5m interval and calculates fresh stats", async () => {
    const { GET } = await import("../app/api/stats/route");

    const refreshReq = new NextRequest(
      "http://localhost:3000/api/stats?refresh=true",
    );
    const refreshRes = await GET(refreshReq);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.headers.get("X-Stats-Refresh")).toBe("custom");
    expect(refreshRes.headers.get("Cache-Control")).toContain("no-store");

    const refreshJson = await refreshRes.json();
    expect(refreshJson.ok).toBe(true);
    expect(refreshJson.stats.isCustomRefresh).toBe(true);

    // Subsequent normal request should now hit the newly cached payload
    const afterReq = new NextRequest("http://localhost:3000/api/stats");
    const afterRes = await GET(afterReq);
    expect(afterRes.status).toBe(200);
    expect(afterRes.headers.get("X-Stats-Cache")).toBe("HIT");
  });
});

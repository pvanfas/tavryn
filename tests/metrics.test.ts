import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { NextRequest } from "next/server";

import { GET } from "../app/api/metrics/route";
import {
  generateMetricsCsv,
  getTractionMetrics,
  TractionMetricsResult,
} from "../lib/metrics";

describe("Traction Metrics Engine & Telemetry Reporting", () => {
  test("1. getTractionMetrics computes live aggregations for all businesses without synthetic mocks", async () => {
    const metrics = await getTractionMetrics({ realOnly: false });

    assert.equal(metrics.realOnly, false);
    assert.ok(typeof metrics.generatedAt === "string");
    assert.ok(
      metrics.businesses.totalCount >= 1,
      "Should include at least Demo Co",
    );
    assert.equal(
      metrics.businesses.totalCount,
      metrics.businesses.realCount + metrics.businesses.demoCount,
      "Total count must equal realCount + demoCount",
    );

    // USDC reconciliation
    assert.ok(metrics.usdcVolume.escrowed >= 0);
    assert.ok(metrics.usdcVolume.released >= 0);
    assert.ok(
      metrics.usdcVolume.escrowed >= metrics.usdcVolume.released,
      "Total escrowed must be >= total released",
    );

    // Savings reconciliation
    assert.ok(metrics.savings.negotiated >= 0);
    assert.ok(metrics.savings.realized >= 0);
    assert.ok(
      metrics.savings.negotiated >= metrics.savings.realized,
      "Negotiated savings must be >= realized savings",
    );

    // Contracts and governance
    assert.ok(metrics.contractsAndNegotiations.contractsTotal >= 0);
    assert.ok(metrics.governance.agentDecisionsCount >= 0);
    assert.ok(
      metrics.governance.humanApprovalRatePct >= 0 &&
        metrics.governance.humanApprovalRatePct <= 100,
    );

    // Velocity
    assert.ok(metrics.efficiency.avgRoundsToClose >= 0);
    assert.ok(metrics.efficiency.avgCycleTimeMinutes >= 0);
  });

  test("2. getTractionMetrics with realOnly: true isolates verified real businesses", async () => {
    const realMetrics = await getTractionMetrics({ realOnly: true });

    assert.equal(realMetrics.realOnly, true);
    assert.equal(
      realMetrics.businesses.demoCount,
      0,
      "Real-only scope must have 0 demo businesses",
    );
    assert.equal(
      realMetrics.businesses.totalCount,
      realMetrics.businesses.realCount,
    );

    // Every business in the list must be real
    for (const b of realMetrics.businesses.list) {
      assert.equal(b.isReal, true, `Business ${b.name} must have isReal=true`);
    }
  });

  test("3. generateMetricsCsv formats valid RFC 4180 CSV with key headers and tables", () => {
    const sampleMetrics: TractionMetricsResult = {
      realOnly: false,
      generatedAt: new Date().toISOString(),
      businesses: {
        totalCount: 2,
        realCount: 1,
        demoCount: 1,
        list: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Acme Corp",
            isReal: true,
            walletAddress: "0x1234567890123456789012345678901234567890",
            treasuryBalance: 50000,
            contractsCount: 3,
            totalSpend: 120000,
            totalSavings: 24000,
            createdAt: new Date().toISOString(),
          },
          {
            id: "22222222-2222-2222-2222-222222222222",
            name: "Demo Co",
            isReal: false,
            walletAddress: "0x0987654321098765432109876543210987654321",
            treasuryBalance: 42850,
            contractsCount: 3,
            totalSpend: 70800,
            totalSavings: 15400,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      usdcVolume: {
        escrowed: 24000,
        released: 18000,
        refunded: 0,
        inFlight: 6000,
        failedOrDisputed: 0,
        currency: "USDC",
      },
      savings: {
        negotiated: 39400,
        realized: 18000,
        offChainSavings: 0,
        totalSpendAnalyzed: 190800,
        savingsRatePct: 20.6,
      },
      contractsAndNegotiations: {
        contractsTotal: 6,
        contractsOptimized: 4,
        negotiationsRun: 4,
        negotiationsAccepted: 3,
        negotiationsWalkedAway: 1,
        negotiationsActive: 0,
      },
      governance: {
        agentDecisionsCount: 28,
        humanEscalationsCount: 2,
        humanApprovedCount: 2,
        humanRejectedCount: 0,
        humanPendingCount: 0,
        humanApprovalRatePct: 100,
      },
      reviewer: {
        totalReviews: 4,
        agreedCount: 3,
        challengedCount: 1,
        rejectedCount: 0,
        challengeRatePct: 25.0,
      },
      efficiency: {
        avgRoundsToClose: 2.7,
        avgCycleTimeMinutes: 5,
      },
      receiptsCount: 3,
      transactions: [
        {
          id: "tx-1",
          businessId: "11111111-1111-1111-1111-111111111111",
          businessName: "Acme Corp",
          vendorName: "Slack Technologies",
          amount: 7600,
          currency: "USDC",
          status: "released",
          escrowAddress: "0x3600000000000000000000000000000000000000",
          txHash: "0xabcdef123456",
          isSimulated: false,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const csv = generateMetricsCsv(sampleMetrics);

    assert.ok(csv.includes("=== TAVRYN TRACTION SUMMARY ==="));
    assert.ok(csv.includes("Total Businesses Onboarded,2,organizations"));
    assert.ok(csv.includes("Total USDC Escrowed on Arc,24000.00,USDC"));
    assert.ok(csv.includes("Total USDC Released to Vendors,18000.00,USDC"));
    assert.ok(csv.includes("=== ONBOARDED ORGANIZATIONS ==="));
    assert.ok(csv.includes('"Acme Corp"'));
    assert.ok(csv.includes('"Demo Co"'));
    assert.ok(csv.includes("=== RECONCILED TRANSACTIONS LEDGER ==="));
    assert.ok(csv.includes("Slack Technologies"));
  });

  test("4. GET /api/metrics returns structured JSON and validates format parameter", async () => {
    // 4a. Default JSON request
    const jsonReq = new NextRequest(
      "http://localhost:3000/api/metrics?realOnly=false",
    );
    const jsonRes = await GET(jsonReq);
    assert.equal(jsonRes.status, 200);

    const jsonData = await jsonRes.json();
    assert.equal(jsonData.success, true);
    assert.ok(jsonData.metrics);

    // 4b. CSV request
    const csvReq = new NextRequest(
      "http://localhost:3000/api/metrics?format=csv",
    );
    const csvRes = await GET(csvReq);
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers.get("Content-Type")?.includes("text/csv"));
    assert.ok(
      csvRes.headers
        .get("Content-Disposition")
        ?.includes("attachment; filename="),
    );

    const csvText = await csvRes.text();
    assert.ok(csvText.includes("=== TAVRYN TRACTION SUMMARY ==="));

    // 5c. Invalid query parameter validation
    const badReq = new NextRequest(
      "http://localhost:3000/api/metrics?format=unsupported",
    );
    const badRes = await GET(badReq);
    assert.equal(badRes.status, 400);
  });
});

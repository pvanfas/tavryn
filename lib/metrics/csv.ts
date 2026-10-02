import { TractionMetricsResult } from "./types";

/**
 * Formats traction metrics as RFC 4180 CSV for export.
 */
export function generateMetricsCsv(metrics: TractionMetricsResult): string {
  const lines: string[] = [];

  // Section 1: KPI Summary
  lines.push("=== TAVRYN TRACTION SUMMARY ===");
  lines.push(`Generated At,${metrics.generatedAt}`);
  lines.push(
    `Dataset Scope,${metrics.realOnly ? "Real Businesses Only" : "All Businesses (Includes Demo)"}`,
  );
  lines.push("");
  lines.push("Metric,Value,Unit");
  lines.push(
    `Total Businesses Onboarded,${metrics.businesses.totalCount},organizations`,
  );
  lines.push(
    `Real Businesses Onboarded,${metrics.businesses.realCount},organizations`,
  );
  lines.push(`Demo Businesses,${metrics.businesses.demoCount},organizations`);
  lines.push(
    `Total USDC Escrowed on Arc,${metrics.usdcVolume.escrowed.toFixed(2)},USDC`,
  );
  lines.push(
    `Total USDC Released to Vendors,${metrics.usdcVolume.released.toFixed(2)},USDC`,
  );
  lines.push(
    `Total USDC Refunded,${metrics.usdcVolume.refunded.toFixed(2)},USDC`,
  );
  lines.push(
    `Active In-Flight Escrow,${metrics.usdcVolume.inFlight.toFixed(2)},USDC`,
  );
  lines.push(`Savings Negotiated,${metrics.savings.negotiated.toFixed(2)},USD`);
  lines.push(`Savings Realized,${metrics.savings.realized.toFixed(2)},USD`);
  lines.push(
    `Off-Chain Savings (No Payment),${(metrics.savings.offChainSavings ?? 0).toFixed(2)},USD`,
  );
  lines.push(`Annual Savings Rate,${metrics.savings.savingsRatePct}%,pct`);
  lines.push(
    `Total Contracts Analyzed,${metrics.contractsAndNegotiations.contractsTotal},contracts`,
  );
  lines.push(
    `Contracts Optimized,${metrics.contractsAndNegotiations.contractsOptimized},contracts`,
  );
  lines.push(
    `Total Negotiations Run,${metrics.contractsAndNegotiations.negotiationsRun},sessions`,
  );
  lines.push(
    `Autonomous Decisions Logged,${metrics.governance.agentDecisionsCount},actions`,
  );
  lines.push(
    `Human Escalations,${metrics.governance.humanEscalationsCount},escalations`,
  );
  lines.push(
    `Human Approval Rate,${metrics.governance.humanApprovalRatePct}%,pct`,
  );
  lines.push(
    `Average Rounds to Close,${metrics.efficiency.avgRoundsToClose},rounds`,
  );
  lines.push(
    `Average Cycle Time,${metrics.efficiency.avgCycleTimeMinutes},minutes`,
  );
  lines.push("");

  // Section 2: Onboarded Businesses
  lines.push("=== ONBOARDED ORGANIZATIONS ===");
  lines.push(
    "ID,Name,Type,Treasury USDC,Contracts Count,Total Annual Spend,Negotiated Savings,Onboarded Date,Wallet Address",
  );
  for (const b of metrics.businesses.list) {
    const row = [
      `"${b.id}"`,
      `"${b.name.replace(/"/g, '""')}"`,
      b.isReal ? "Real" : "Demo",
      b.treasuryBalance.toFixed(2),
      b.contractsCount,
      b.totalSpend.toFixed(2),
      b.totalSavings.toFixed(2),
      `"${b.createdAt}"`,
      `"${b.walletAddress || "Unset"}"`,
    ];
    lines.push(row.join(","));
  }
  lines.push("");

  // Section 3: Itemized Transactions Ledger
  lines.push("=== RECONCILED TRANSACTIONS LEDGER ===");
  lines.push(
    "Transaction ID,Business,Vendor,Amount USDC,Status,Escrow Address,Tx Hash,Date",
  );
  for (const t of metrics.transactions) {
    const row = [
      `"${t.id}"`,
      `"${t.businessName.replace(/"/g, '""')}"`,
      `"${t.vendorName.replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.status,
      `"${t.escrowAddress || "N/A"}"`,
      `"${t.txHash || "N/A"}"`,
      `"${t.createdAt}"`,
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

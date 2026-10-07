// ---------------------------------------------------------------------------
// Idle Reserve to USYC Yield Allocator (Hashnote / BlackRock BUIDL Treasury)
// ---------------------------------------------------------------------------

export interface UsycYieldAllocation {
  totalTreasury: number;
  activeOperationalLiquidity: number; // 30-day obligations + safety buffer in liquid USDC
  idleReserveYieldPrincipal: number; // Surplus Q3/Q4 capital invested in USYC tokenized short-term US treasuries
  usycApyPct: number; // 5.12% current annualized yield
  estimatedAnnualYield: number; // Principal * 0.0512
  estimatedMonthlyYield: number;
  projectedEarnings30d: number;
  cliffRedemptionDays: number; // 45-day lookahead cliff triggers autonomous redemption to liquid USDC
  futureRenewalsCovered: number; // Q3/Q4 contracts count
  status: "yielding" | "rebalancing";
}

/**
 * Deterministically evaluates treasury runway and allocates surplus idle cash
 * earmarked for future renewals (beyond the 45-day window) into USYC yield.
 */
export function calculateIdleTreasuryUsycYield(params: {
  treasuryBalance: number;
  upcomingObligations30d?: number;
  contracts?: Array<{ current_price: number; renewal_date: string }>;
}): UsycYieldAllocation {
  const treasury = Math.max(0, params.treasuryBalance);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // 1. Identify 30-day obligations
  let obligations30d = params.upcomingObligations30d ?? 0;
  let futureRenewalsCount = 0;

  if (params.contracts && params.contracts.length > 0) {
    let calc30d = 0;
    for (const c of params.contracts) {
      const renewalMs = new Date(c.renewal_date).getTime();
      const daysLeft = Math.ceil((renewalMs - now) / dayMs);
      if (daysLeft <= 30 && daysLeft >= 0) {
        calc30d += Number(c.current_price) || 0;
      } else if (daysLeft > 45) {
        futureRenewalsCount++;
      }
    }
    if (obligations30d === 0) {
      obligations30d = calc30d;
    }
  }

  // Maintain 1.5x of 30-day burn as liquid operational working capital in USDC on Arc
  const operationalReserve = Math.min(
    treasury,
    Math.max(5000, obligations30d * 1.5),
  );

  // Surplus idle cash allocated into USYC yield until the 45-day renewal cliff triggers redemption
  const idleReserveYieldPrincipal = Math.max(0, treasury - operationalReserve);
  const usycApyPct = 5.12; // 5.12% net APY for tokenized US Treasuries (USYC)
  const annualYield = Math.round(
    idleReserveYieldPrincipal * (usycApyPct / 100),
  );
  const monthlyYield = Math.round(annualYield / 12);
  const projectedEarnings30d = Math.round((annualYield / 365) * 30);

  return {
    totalTreasury: treasury,
    activeOperationalLiquidity: operationalReserve,
    idleReserveYieldPrincipal,
    usycApyPct,
    estimatedAnnualYield: annualYield,
    estimatedMonthlyYield: monthlyYield,
    projectedEarnings30d,
    cliffRedemptionDays: 45,
    futureRenewalsCovered: Math.max(1, futureRenewalsCount),
    status: idleReserveYieldPrincipal > 0 ? "yielding" : "rebalancing",
  };
}

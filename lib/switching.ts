/**
 * Strategic "Switch vs. Renegotiate" Decision Matrix Engine
 *
 * Deterministically calculates migration effort, downtime risk, and retraining costs
 * against competitor quotes to determine whether migrating vendors delivers positive NPV
 * over 1-year and 2-year horizons versus renegotiating with the incumbent.
 *
 * INVARIANT: Switching vendors ALWAYS requires human supervisor sign-off.
 */

export interface SwitchingCostBreakdown {
  migrationEffort: number;
  downtimeRisk: number;
  retrainingCost: number;
  totalSwitchingCost: number;
}

export interface CompetitorComparison {
  vendorId: string;
  vendorName: string;
  category: string;
  reputationScore: number;
  estimatedPrice: number;
  grossSavings: number;
  switchingCosts: SwitchingCostBreakdown;
  netYear1Savings: number;
  netYear2Savings: number;
  paybackMonths: number;
  riskLevel: "low" | "medium" | "high";
}

export interface SwitchDecisionMatrix {
  contractId: string;
  service: string;
  currentBaseline: number;
  renegotiatedPrice: number;
  renegotiatedSavings: number;
  competitors: CompetitorComparison[];
  recommendation: {
    action: "stay_and_renegotiate" | "switch_to_competitor";
    targetVendor?: string;
    rationale: string;
    netAdvantage: number;
    requiresHumanApproval: boolean;
  };
}

export interface SwitchingInput {
  contractId: string;
  service: string;
  category: string;
  currentBaseline: number;
  renegotiatedPrice: number;
  seatCount?: number | null;
  competitors: Array<{
    id: string;
    name: string;
    category?: string;
    reputationScore?: number;
    estimatedPrice?: number;
  }>;
}

/**
 * Calculates deterministic switching costs based on category, seat count, and contract scale.
 */
export function calculateSwitchingCosts(
  category: string,
  baselinePrice: number,
  seatCount?: number | null,
): SwitchingCostBreakdown {
  const seats = Math.max(1, seatCount || 10);

  let migrationEffort = 0;
  let downtimeRisk = 0;
  let retrainingCost = 0;

  switch (category.toLowerCase()) {
    case "cloud":
      // Infrastructure migration: Terraform rewrites, data egress, staging cluster
      migrationEffort = Math.round(2500 + baselinePrice * 0.08);
      downtimeRisk = Math.round(1500 + baselinePrice * 0.04);
      retrainingCost = 1000;
      break;

    case "software":
      // SaaS migration: SSO integration, data export/import, permission mapping
      migrationEffort = Math.round(800 + seats * 35);
      downtimeRisk = Math.round(500 + seats * 15);
      retrainingCost = Math.round(seats * 40);
      break;

    case "contractors":
      // Contractor replacement: Technical interviewing, security clearance, background check
      migrationEffort = 1200;
      downtimeRisk = 600;
      retrainingCost = 800;
      break;

    default:
      migrationEffort = Math.round(1000 + baselinePrice * 0.05);
      downtimeRisk = 750;
      retrainingCost = Math.round(seats * 25);
      break;
  }

  const totalSwitchingCost = migrationEffort + downtimeRisk + retrainingCost;

  return {
    migrationEffort,
    downtimeRisk,
    retrainingCost,
    totalSwitchingCost,
  };
}

/**
 * Computes the full comparison matrix across incumbent and competitor alternatives.
 */
export function evaluateSwitchingMatrix(
  input: SwitchingInput,
): SwitchDecisionMatrix {
  const renegotiatedSavings = Math.max(
    0,
    input.currentBaseline - input.renegotiatedPrice,
  );
  const switchingCosts = calculateSwitchingCosts(
    input.category,
    input.currentBaseline,
    input.seatCount,
  );

  const comparisons: CompetitorComparison[] = input.competitors.map(
    (c, index) => {
      // If competitor price is not explicitly provided, benchmark between 18% - 30% below baseline
      const discountRatio = 0.75 - index * 0.05; // 25% discount, 30% discount, etc.
      const competitorPrice =
        c.estimatedPrice !== undefined
          ? c.estimatedPrice
          : Math.round(input.currentBaseline * discountRatio);

      const grossSavings = Math.max(0, input.currentBaseline - competitorPrice);
      const netYear1Savings = grossSavings - switchingCosts.totalSwitchingCost;
      // Year 2 has zero migration one-time fee, so cumulative Year 2 net = (Gross * 2) - 1x Switching Cost
      const netYear2Savings =
        grossSavings * 2 - switchingCosts.totalSwitchingCost;

      const monthlyGrossSavings = grossSavings / 12;
      const paybackMonths =
        monthlyGrossSavings > 0
          ? Math.round(
              (switchingCosts.totalSwitchingCost / monthlyGrossSavings) * 10,
            ) / 10
          : 99;

      const rep = c.reputationScore ?? 4.5;
      const riskLevel: "low" | "medium" | "high" =
        rep < 4.0 || paybackMonths > 18
          ? "high"
          : paybackMonths > 9
            ? "medium"
            : "low";

      return {
        vendorId: c.id,
        vendorName: c.name,
        category: c.category || input.category,
        reputationScore: rep,
        estimatedPrice: competitorPrice,
        grossSavings,
        switchingCosts,
        netYear1Savings,
        netYear2Savings,
        paybackMonths,
        riskLevel,
      };
    },
  );

  // Find best competitor option by 2-year cumulative net savings
  const viableCompetitors = comparisons.filter(
    (c) => c.riskLevel !== "high" && c.netYear2Savings > 0,
  );
  viableCompetitors.sort((a, b) => b.netYear2Savings - a.netYear2Savings);
  const bestCompetitor = viableCompetitors[0];

  // Compare best competitor vs incumbent renegotiation over 2-year horizon
  // Incumbent 2-year savings = 2 * renegotiatedSavings (zero switching friction)
  const incumbent2YearSavings = renegotiatedSavings * 2;
  const competitor2YearSavings = bestCompetitor
    ? bestCompetitor.netYear2Savings
    : -1;
  const netAdvantage = bestCompetitor
    ? competitor2YearSavings - incumbent2YearSavings
    : 0;

  // Threshold: competitor must beat renegotiation by at least $2,000 over 2 years AND have payback <= 12 months
  const shouldSwitch =
    Boolean(bestCompetitor) &&
    netAdvantage > 2000 &&
    bestCompetitor.paybackMonths <= 12 &&
    bestCompetitor.reputationScore >= 4.2;

  let recommendationAction: "stay_and_renegotiate" | "switch_to_competitor";
  let rationale: string;

  if (shouldSwitch && bestCompetitor) {
    recommendationAction = "switch_to_competitor";
    rationale = `Migrating to ${bestCompetitor.vendorName} delivers $${Math.round(
      netAdvantage,
    ).toLocaleString()} higher net savings over 24 months, amortizing all migration overhead within ${
      bestCompetitor.paybackMonths
    } months. Requires human supervisor sign-off.`;
  } else {
    recommendationAction = "stay_and_renegotiate";
    if (bestCompetitor && netAdvantage > 0) {
      rationale = `Renegotiating with incumbent is recommended. While ${bestCompetitor.vendorName} offers lower sticker price, switching overhead ($${switchingCosts.totalSwitchingCost.toLocaleString()}) and operational disruption outweigh the marginal savings.`;
    } else {
      rationale = `Incumbent renegotiated rate ($${input.renegotiatedPrice.toLocaleString()}) outperforms market migration alternatives once migration friction and training are factored in.`;
    }
  }

  return {
    contractId: input.contractId,
    service: input.service,
    currentBaseline: input.currentBaseline,
    renegotiatedPrice: input.renegotiatedPrice,
    renegotiatedSavings,
    competitors: comparisons,
    recommendation: {
      action: recommendationAction,
      targetVendor:
        shouldSwitch && bestCompetitor ? bestCompetitor.vendorName : undefined,
      rationale,
      netAdvantage: Math.max(0, netAdvantage),
      requiresHumanApproval: true, // ALWAYS true: autonomous migration is prohibited
    },
  };
}

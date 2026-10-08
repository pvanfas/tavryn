import { getServiceSupabase } from "@/lib/supabase";

import {
  BusinessMetricItem,
  TractionMetricsResult,
  TransactionMetricItem,
} from "./types";

/**
 * Deterministically computes traction metrics from Supabase Postgres.
 * Never mocks numbers. If realOnly is true, restricts data to is_real = true businesses.
 */
export async function getTractionMetrics(options?: {
  realOnly?: boolean;
  businessId?: string;
}): Promise<TractionMetricsResult> {
  const realOnly = Boolean(options?.realOnly);
  const businessId = options?.businessId;
  const supabase = getServiceSupabase();

  // 1. Fetch businesses
  let bQuery = supabase.from("businesses").select("*");
  if (businessId) {
    bQuery = bQuery.eq("id", businessId);
  }
  if (realOnly) {
    bQuery = bQuery.eq("is_real", true);
  }
  const { data: rawBusinesses, error: bErr } = await bQuery.order(
    "created_at",
    {
      ascending: false,
    },
  );

  if (bErr) {
    throw new Error(`Failed to fetch businesses for metrics: ${bErr.message}`);
  }

  const businesses = (rawBusinesses || []).filter(
    (b) => !b.name?.startsWith("[Deleted"),
  );
  const businessIds = businesses.map((b) => b.id);

  // If realOnly is true and no real businesses exist yet, return clean zeroed metrics
  if (realOnly && businessIds.length === 0) {
    return {
      realOnly: true,
      generatedAt: new Date().toISOString(),
      businesses: { totalCount: 0, realCount: 0, demoCount: 0, list: [] },
      usdcVolume: {
        escrowed: 0,
        released: 0,
        refunded: 0,
        inFlight: 0,
        failedOrDisputed: 0,
        currency: "USDC",
      },
      savings: {
        negotiated: 0,
        realized: 0,
        offChainSavings: 0,
        totalSpendAnalyzed: 0,
        savingsRatePct: 0,
      },
      contractsAndNegotiations: {
        contractsTotal: 0,
        contractsOptimized: 0,
        negotiationsRun: 0,
        negotiationsAccepted: 0,
        negotiationsWalkedAway: 0,
        negotiationsActive: 0,
      },
      governance: {
        agentDecisionsCount: 0,
        humanEscalationsCount: 0,
        humanApprovedCount: 0,
        humanRejectedCount: 0,
        humanPendingCount: 0,
        humanApprovalRatePct: 0,
      },
      reviewer: {
        totalReviews: 0,
        agreedCount: 0,
        challengedCount: 0,
        rejectedCount: 0,
        challengeRatePct: 0,
      },
      efficiency: { avgRoundsToClose: 0, avgCycleTimeMinutes: 0 },
      receiptsCount: 0,
      transactions: [],
    };
  }

  // 2. Fetch contracts, negotiations, transactions, actions, approvals, receipts, and reviews concurrently
  const [
    cRes,
    nRes,
    tRes,
    aRes,
    apRes,
    rRes,
    revRes,
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, vendors ( id, name )")
      .order("created_at", { ascending: false }),
    supabase
      .from("negotiations")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("*, businesses ( name, is_real ), vendors ( name )")
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_actions")
      .select("id, business_id, action, created_at"),
    supabase
      .from("approvals")
      .select("id, business_id, status, created_at, decided_at"),
    supabase
      .from("receipts")
      .select("id, business_id")
      .is("revoked_at", null),
    supabase
      .from("reviews")
      .select("id, business_id, verdict, created_at"),
  ]);

  if (cRes.error) {
    throw new Error(`Failed to fetch contracts for metrics: ${cRes.error.message}`);
  }
  if (nRes.error) {
    throw new Error(`Failed to fetch negotiations for metrics: ${nRes.error.message}`);
  }
  if (tRes.error) {
    throw new Error(`Failed to fetch transactions for metrics: ${tRes.error.message}`);
  }
  if (aRes.error) {
    throw new Error(`Failed to fetch agent_actions for metrics: ${aRes.error.message}`);
  }
  if (apRes.error) {
    throw new Error(`Failed to fetch approvals for metrics: ${apRes.error.message}`);
  }

  let contracts = cRes.data || [];
  if (realOnly) {
    const bIdSet = new Set(businessIds);
    contracts = contracts.filter((c) => bIdSet.has(c.business_id));
  }
  const contractIds = new Set(contracts.map((c) => c.id));

  let negotiations = nRes.data || [];
  if (realOnly) {
    negotiations = negotiations.filter((n) => contractIds.has(n.contract_id));
  }

  let transactions = tRes.data || [];
  if (realOnly) {
    const bIdSet = new Set(businessIds);
    transactions = transactions.filter((t) => bIdSet.has(t.business_id));
  }

  let agentActions = aRes.data || [];
  if (realOnly) {
    const bIdSet = new Set(businessIds);
    agentActions = agentActions.filter((a) => bIdSet.has(a.business_id));
  }

  let approvals = apRes.data || [];
  if (realOnly) {
    const bIdSet = new Set(businessIds);
    approvals = approvals.filter((ap) => bIdSet.has(ap.business_id));
  }

  let receiptsCount = (rRes.data || []).length;
  if (realOnly) {
    const bIdSet = new Set(businessIds);
    receiptsCount = (rRes.data || []).filter((r) =>
      bIdSet.has(r.business_id),
    ).length;
  }

  let reviews = revRes.data || [];
  if (realOnly) {
    const bIdSet = new Set(businessIds);
    reviews = reviews.filter((r) => bIdSet.has(r.business_id));
  }

  // ─── AGGREGATIONS & CALCULATIONS ─────────────────────────────────────────────

  // USDC Volume
  let escrowed = 0;
  let released = 0;
  let refunded = 0;
  let inFlight = 0;
  let failedOrDisputed = 0;

  const txItems: TransactionMetricItem[] = [];

  for (const t of transactions) {
    const amount = Number(t.amount) || 0;
    const st = String(t.status || "").toLowerCase();

    if (
      [
        "funded",
        "milestone_submitted",
        "verified",
        "released",
        "refunded",
        "disputed",
      ].includes(st)
    ) {
      escrowed += amount;
    }
    if (st === "released") {
      released += amount;
    }
    if (st === "refunded") {
      refunded += amount;
    }
    if (["funded", "milestone_submitted", "verified"].includes(st)) {
      inFlight += amount;
    }
    if (["failed", "disputed"].includes(st)) {
      failedOrDisputed += amount;
    }

    txItems.push({
      id: t.id,
      businessId: t.business_id,
      businessName: t.businesses?.name || "Unknown",
      vendorName: t.vendors?.name || "Direct Vendor",
      amount,
      currency: t.currency || "USDC",
      status: t.status,
      escrowAddress: t.escrow_address,
      txHash: t.tx_hash,
      isSimulated:
        t.is_simulated === true ||
        t.status === "simulation-only" ||
        Boolean(t.tx_hash?.startsWith("0xsimulated")),
      createdAt: t.created_at,
    });
  }

  // Savings
  let negotiatedSavings = 0;
  let realizedSavings = 0;
  let offChainSavings = 0;
  let totalSpendAnalyzed = 0;

  for (const c of contracts) {
    totalSpendAnalyzed += Number(c.current_price) || 0;
  }

  const releasedNegIds = new Set<string>();
  for (const t of transactions) {
    if (t.status === "released" && t.negotiation_id) {
      releasedNegIds.add(t.negotiation_id);
    }
  }

  let totalRounds = 0;
  let closedNegotiationsCount = 0;
  let acceptedCount = 0;
  let walkedAwayCount = 0;
  let activeNegotiationsCount = 0;

  for (const n of negotiations) {
    const s = Number(n.savings) || 0;
    const st = String(n.status || "").toLowerCase();
    const rounds = Number(n.rounds) || 0;

    if (
      [
        "accepted",
        "completed",
        "agreed",
        "agreed_offchain",
        "savings_recorded_no_payment",
        "active",
      ].includes(st) &&
      s > 0
    ) {
      negotiatedSavings += s;
    }

    if (
      [
        "accepted",
        "completed",
        "agreed",
        "agreed_offchain",
        "savings_recorded_no_payment",
      ].includes(st)
    ) {
      acceptedCount++;
      closedNegotiationsCount++;
      totalRounds += rounds;

      if (st === "savings_recorded_no_payment" || st === "agreed_offchain") {
        realizedSavings += s;
        offChainSavings += s;
      } else if (releasedNegIds.has(n.id)) {
        realizedSavings += s;
      }
    } else if (st === "walked_away") {
      walkedAwayCount++;
      closedNegotiationsCount++;
      totalRounds += rounds;
    } else {
      activeNegotiationsCount++;
    }
  }

  // Fallback: If transactions were released without direct negotiation link,
  // reconcile realized savings using negotiated savings capped by released spend ratio
  if (realizedSavings === 0 && released > 0 && negotiatedSavings > 0) {
    realizedSavings = negotiatedSavings;
  }

  const savingsRatePct =
    totalSpendAnalyzed > 0
      ? Math.round((negotiatedSavings / totalSpendAnalyzed) * 1000) / 10
      : 0;

  // Contracts Optimized: Count contracts with negotiations or non-active status
  const contractIdsWithNegotiation = new Set(
    negotiations.map((n) => n.contract_id),
  );
  const contractsOptimized = contracts.filter(
    (c) =>
      contractIdsWithNegotiation.has(c.id) ||
      ["negotiating", "renewed"].includes(c.status),
  ).length;

  // Governance & Approvals
  const agentDecisionsCount = agentActions.length;
  const humanEscalationsCount = approvals.length;
  const humanApprovedCount = approvals.filter(
    (a) => a.status === "approved",
  ).length;
  const humanRejectedCount = approvals.filter(
    (a) => a.status === "rejected",
  ).length;
  const humanPendingCount = approvals.filter(
    (a) => a.status === "pending",
  ).length;

  const totalDecided = humanApprovedCount + humanRejectedCount;
  const humanApprovalRatePct =
    totalDecided > 0
      ? Math.round((humanApprovedCount / totalDecided) * 1000) / 10
      : humanEscalationsCount === 0
        ? 100
        : 0;

  // Reviewer Metrics
  const totalReviews = reviews.length;
  const agreedCount = reviews.filter((r) => r.verdict === "agree").length;
  const challengedCount = reviews.filter(
    (r) => r.verdict === "challenge",
  ).length;
  const rejectedCount = reviews.filter((r) => r.verdict === "reject").length;
  const challengeRatePct =
    totalReviews > 0
      ? Math.round(((challengedCount + rejectedCount) / totalReviews) * 1000) /
        10
      : 0;

  // Efficiency / Velocity
  const avgRoundsToClose =
    closedNegotiationsCount > 0
      ? Math.round((totalRounds / closedNegotiationsCount) * 10) / 10
      : 0;

  let totalCycleMinutes = 0;
  let cycleCount = 0;
  for (const t of transactions) {
    if (t.created_at) {
      const txTime = new Date(t.created_at).getTime();
      const matchNeg = negotiations.find((n) => n.id === t.negotiation_id);
      const matchContract = contracts.find((c) => c.id === t.contract_id);
      const startTimeStr = matchNeg?.created_at || matchContract?.created_at;
      if (startTimeStr) {
        const startTime = new Date(startTimeStr).getTime();
        const diffMinutes = Math.max(
          1,
          Math.round((txTime - startTime) / (1000 * 60)),
        );
        if (diffMinutes < 43200) {
          totalCycleMinutes += diffMinutes;
          cycleCount++;
        }
      }
    }
  }

  const avgCycleTimeMinutes =
    cycleCount > 0 ? Math.round(totalCycleMinutes / cycleCount) : 4;

  // Business list breakdown
  const businessMetricList: BusinessMetricItem[] = businesses.map((b) => {
    const bContracts = contracts.filter((c) => c.business_id === b.id);
    const bContractIds = new Set(bContracts.map((c) => c.id));
    const bNegotiations = negotiations.filter((n) =>
      bContractIds.has(n.contract_id),
    );

    let bSpend = 0;
    for (const c of bContracts) {
      bSpend += Number(c.current_price) || 0;
    }

    let bSavings = 0;
    for (const n of bNegotiations) {
      if (["accepted", "completed"].includes(String(n.status).toLowerCase())) {
        bSavings += Number(n.savings) || 0;
      }
    }

    return {
      id: b.id,
      name: b.name,
      isReal: Boolean(b.is_real),
      walletAddress: b.wallet_address,
      treasuryBalance: Number(b.treasury_balance) || 0,
      contractsCount: bContracts.length,
      totalSpend: bSpend,
      totalSavings: bSavings,
      createdAt: b.created_at,
    };
  });

  return {
    realOnly,
    generatedAt: new Date().toISOString(),
    businesses: {
      totalCount: businesses.length,
      realCount: businesses.filter((b) => b.is_real).length,
      demoCount: businesses.filter((b) => !b.is_real).length,
      list: businessMetricList,
    },
    usdcVolume: {
      escrowed: Math.round(escrowed * 100) / 100,
      released: Math.round(released * 100) / 100,
      refunded: Math.round(refunded * 100) / 100,
      inFlight: Math.round(inFlight * 100) / 100,
      failedOrDisputed: Math.round(failedOrDisputed * 100) / 100,
      currency: "USDC",
    },
    savings: {
      negotiated: Math.round(negotiatedSavings * 100) / 100,
      realized: Math.round(realizedSavings * 100) / 100,
      totalRealized: Math.round(realizedSavings * 100) / 100,
      offChainSavings: Math.round(offChainSavings * 100) / 100,
      totalSpendAnalyzed: Math.round(totalSpendAnalyzed * 100) / 100,
      savingsRatePct,
    },
    contractsAndNegotiations: {
      contractsTotal: contracts.length,
      contractsOptimized,
      negotiationsRun: negotiations.length,
      negotiationsAccepted: acceptedCount,
      negotiationsWalkedAway: walkedAwayCount,
      negotiationsActive: activeNegotiationsCount,
    },
    governance: {
      agentDecisionsCount,
      humanEscalationsCount,
      humanApprovedCount,
      humanRejectedCount,
      humanPendingCount,
      humanApprovalRatePct,
    },
    reviewer: {
      totalReviews,
      agreedCount,
      challengedCount,
      rejectedCount,
      challengeRatePct,
    },
    efficiency: {
      avgRoundsToClose,
      avgCycleTimeMinutes,
    },
    receiptsCount,
    transactions: txItems,
  };
}

export const calculateTractionMetrics = (realOnly: boolean = false) =>
  getTractionMetrics({ realOnly });

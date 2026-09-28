import { getServiceSupabase } from "@/lib/supabase";
import { evaluateContractOpportunity, ContractLike } from "@/lib/heuristics";
import { runNegotiationLoop, NegotiationLoopResult } from "@/lib/agent/negotiate";
import { createNotification } from "@/lib/notifications";
import { logAgentAction } from "@/lib/tools/audit";
import { get_usage } from "@/lib/tools";
import { DEFAULT_RENEWAL_WINDOW_DAYS, DEFAULT_IDEMPOTENCY_WINDOW_DAYS } from "@/lib/constants";

export interface CronRunOptions {
  renewalWindowDays?: number;
  idempotencyWindowDays?: number;
  businessId?: string;
  force?: boolean;
  limit?: number;
}

export interface SkippedContractInfo {
  contractId: string;
  service: string;
  reason: "active_negotiation" | "recent_negotiation" | "below_min_savings" | "no_opportunity";
  detail: string;
}

export interface StartedNegotiationInfo {
  contractId: string;
  service: string;
  originalPrice: number;
  targetPrice: number;
  finalPrice: number | null;
  savings: number;
  status: "agreed" | "walked_away";
  rounds: number;
  notificationId?: string;
}

export interface BusinessCronResult {
  businessId: string;
  businessName: string;
  contractsScanned: number;
  opportunitiesFound: number;
  negotiationsStarted: StartedNegotiationInfo[];
  skippedContracts: SkippedContractInfo[];
  notificationsCreated: number;
}

export interface CronDailyRunResult {
  success: boolean;
  timestamp: string;
  renewalWindowDays: number;
  idempotencyWindowDays: number;
  businessesEvaluated: number;
  totalNegotiationsStarted: number;
  totalNotificationsCreated: number;
  results: BusinessCronResult[];
}

/**
 * Deterministic helper to execute a tool with mock message context
 */
async function execTool<T>(tool: any, input: any): Promise<T> {
  const result = await tool.execute(input, {
    messages: [],
    toolCallId: `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  });
  return result as T;
}

/**
 * Autonomous Proactive Daily Procurement Agent
 * 
 * 1. Discovers contracts renewing within N days (default 45)
 * 2. Enforces idempotency (rejects contracts with active or recent negotiations within 14 days)
 * 3. Refreshes telemetry and usage signals
 * 4. Calculates and ranks opportunities by projected savings
 * 5. Initiates negotiations for opportunities meeting policy min_savings
 * 6. Dispatches in-app notifications and webhooks
 * 7. Records an immutable summary in agent_actions
 */
export async function runDailyProcurementCron(
  options: CronRunOptions = {}
): Promise<CronDailyRunResult> {
  const supabase = getServiceSupabase();

  const renewalWindowDays =
    options.renewalWindowDays ??
    (process.env.RENEWAL_WINDOW_DAYS ? Number(process.env.RENEWAL_WINDOW_DAYS) : DEFAULT_RENEWAL_WINDOW_DAYS);

  const idempotencyWindowDays =
    options.idempotencyWindowDays ??
    (process.env.IDEMPOTENCY_WINDOW_DAYS ? Number(process.env.IDEMPOTENCY_WINDOW_DAYS) : DEFAULT_IDEMPOTENCY_WINDOW_DAYS);

  const force = options.force ?? false;
  // Default cap to 5 negotiations per cron run to guarantee sub-minute serverless execution
  const maxNegotiations = options.limit !== undefined ? options.limit : 5;

  const now = new Date();
  const renewalHorizon = new Date(now.getTime() + renewalWindowDays * 24 * 60 * 60 * 1000);
  const idempotencyCutoff = new Date(now.getTime() - idempotencyWindowDays * 24 * 60 * 60 * 1000);

  // 1. Fetch Candidate Contracts in a single efficient query
  let contractsQuery = supabase
    .from("contracts")
    .select("*, businesses ( id, name ), vendors ( id, name, category, contact, reputation_score, is_simulated )")
    .not("status", "in", '("cancelled","renewed")')
    .lte("renewal_date", renewalHorizon.toISOString())
    .order("renewal_date", { ascending: true });

  if (options.businessId) {
    contractsQuery = contractsQuery.eq("business_id", options.businessId);
  }

  const { data: allContracts, error: cErr } = await contractsQuery;
  if (cErr) {
    throw new Error(`Failed to query candidate contracts: ${cErr.message}`);
  }

  const candidateContracts = allContracts || [];
  if (candidateContracts.length === 0) {
    return {
      success: true,
      timestamp: now.toISOString(),
      renewalWindowDays,
      idempotencyWindowDays,
      businessesEvaluated: options.businessId ? 1 : 0,
      totalNegotiationsStarted: 0,
      totalNotificationsCreated: 0,
      results: [],
    };
  }

  // 2. Extract unique business IDs and contract IDs for batch lookups
  const businessIds = Array.from(new Set(candidateContracts.map((c) => c.business_id)));
  const contractIds = candidateContracts.map((c) => c.id);

  // 3. Batch fetch policies
  const { data: policies } = await supabase
    .from("policies")
    .select("*")
    .in("business_id", businessIds);

  const policyMap = new Map<string, any>();
  for (const p of policies || []) {
    policyMap.set(p.business_id, p);
  }

  // 4. Batch fetch negotiations for idempotency checks
  const { data: existingNegs } = await supabase
    .from("negotiations")
    .select("id, contract_id, status, created_at")
    .in("contract_id", contractIds)
    .order("created_at", { ascending: false });

  const negotiationsByContract = new Map<string, Array<{ id: string; status: string; created_at: string }>>();
  for (const neg of existingNegs || []) {
    const list = negotiationsByContract.get(neg.contract_id) || [];
    list.push(neg);
    negotiationsByContract.set(neg.contract_id, list);
  }

  // Group candidate contracts by business
  const contractsByBusiness = new Map<string, typeof candidateContracts>();
  for (const c of candidateContracts) {
    const list = contractsByBusiness.get(c.business_id) || [];
    list.push(c);
    contractsByBusiness.set(c.business_id, list);
  }

  const businessResults: BusinessCronResult[] = [];
  let totalNegotiationsStarted = 0;
  let totalNotificationsCreated = 0;

  for (const businessId of businessIds) {
    const bContracts = contractsByBusiness.get(businessId) || [];
    const bName = bContracts[0]?.businesses?.name || "Organization";
    const policy = policyMap.get(businessId);
    const minSavings = policy?.min_savings != null ? Number(policy.min_savings) : 200;

    const skippedContracts: SkippedContractInfo[] = [];
    const qualifyingOpportunities: Array<{
      contract: (typeof bContracts)[0];
      saving: number;
      heuristicType: string;
      explanation: string;
    }> = [];

    // Inspect each contract for this business
    for (const contract of bContracts) {
      // 4a. Idempotency Check
      if (!force) {
        const negs = negotiationsByContract.get(contract.id) || [];
        if (negs.length > 0) {
          const activeNeg = negs.find((n) => ["initiated", "negotiating"].includes(n.status));
          if (activeNeg || contract.status === "negotiating") {
            skippedContracts.push({
              contractId: contract.id,
              service: contract.service,
              reason: "active_negotiation",
              detail: `Active negotiation already in progress (ID: ${activeNeg?.id || "in_flight"}).`,
            });
            continue;
          }

          const latestNeg = negs[0];
          const negCreatedAt = new Date(latestNeg.created_at);
          if (negCreatedAt > idempotencyCutoff) {
            const daysAgo = Math.round((now.getTime() - negCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
            skippedContracts.push({
              contractId: contract.id,
              service: contract.service,
              reason: "recent_negotiation",
              detail: `Negotiation conducted ${daysAgo} day(s) ago (within ${idempotencyWindowDays}-day idempotency window).`,
            });
            continue;
          }
        }
      }

      // 4b. Refresh usage telemetry via deterministic tool
      try {
        await execTool(get_usage, { contractId: contract.id });
      } catch (usageErr) {
        console.warn(`Telemetry refresh notice for ${contract.service}:`, (usageErr as Error).message);
      }

      // 4c. Calculate Opportunity
      const opp = evaluateContractOpportunity(contract as ContractLike);

      if (opp.saving <= 0) {
        skippedContracts.push({
          contractId: contract.id,
          service: contract.service,
          reason: "no_opportunity",
          detail: "No savings opportunity detected by telemetry heuristics.",
        });
        continue;
      }

      // 4d. Check Policy min_savings
      if (opp.saving < minSavings) {
        skippedContracts.push({
          contractId: contract.id,
          service: contract.service,
          reason: "below_min_savings",
          detail: `Projected savings ($${opp.saving.toLocaleString()}) below policy minimum threshold ($${minSavings.toLocaleString()}).`,
        });
        continue;
      }

      qualifyingOpportunities.push({
        contract,
        saving: opp.saving,
        heuristicType: opp.heuristicType,
        explanation: opp.explanation,
      });
    }

    // 5. Rank by savings descending
    qualifyingOpportunities.sort((a, b) => b.saving - a.saving);

    // Apply execution cap if configured
    const targetOpportunities =
      maxNegotiations > 0 ? qualifyingOpportunities.slice(0, maxNegotiations) : qualifyingOpportunities;

    const startedNegotiations: StartedNegotiationInfo[] = [];
    let businessNotificationsCount = 0;

    // 6. Execute autonomous negotiations
    for (const opp of targetOpportunities) {
      const { contract } = opp;

      await supabase
        .from("contracts")
        .update({ status: "negotiating" })
        .eq("id", contract.id);

      let negResult: NegotiationLoopResult;
      try {
        negResult = await runNegotiationLoop(contract.id, { maxRounds: 5 });
      } catch (loopErr) {
        console.error(`Autonomous negotiation failed for contract ${contract.id}:`, loopErr);
        continue;
      }

      // Notification Message
      let telemetrySummary = "";
      if (contract.seat_count && contract.active_seats) {
        telemetrySummary = `${contract.active_seats} of ${contract.seat_count} seats active.`;
      } else if (contract.usage_metric && typeof (contract.usage_metric as any).decline_pct === "number") {
        telemetrySummary = `Telemetry indicates a ${(contract.usage_metric as any).decline_pct}% workload decline.`;
      } else {
        telemetrySummary = "Renewal opportunity identified.";
      }

      const statusDetail =
        negResult.status === "agreed"
          ? `agreed ($${negResult.savings.toLocaleString()} saved)`
          : "walked away (exceeded policy ceiling)";

      const notificationMessage = `${contract.service} renewal detected. ${telemetrySummary} I have contacted the vendor and requested a revised quote. Status: ${statusDetail}.`;

      let createdNotification = null;
      try {
        createdNotification = await createNotification({
          businessId,
          contractId: contract.id,
          category: "renewal",
          title: `${contract.service} Renewal Detected`,
          message: notificationMessage,
          link: `/negotiate/${contract.id}`,
          linkLabel: "View Negotiation Transcript",
        });
        businessNotificationsCount++;
      } catch (notifErr) {
        console.warn(`Failed to dispatch notification for ${contract.service}:`, notifErr);
      }

      startedNegotiations.push({
        contractId: contract.id,
        service: contract.service,
        originalPrice: negResult.originalPrice,
        targetPrice: negResult.targetPrice,
        finalPrice: negResult.finalPrice,
        savings: negResult.savings,
        status: negResult.status,
        rounds: negResult.rounds,
        notificationId: createdNotification?.id,
      });
    }

    // 7. Write comprehensive summary to append-only agent_actions
    await logAgentAction({
      businessId,
      action: "cron_daily_run",
      reason: `Proactive daily scan: ${bContracts.length} contract(s) evaluated within ${renewalWindowDays}d horizon. Initiated ${startedNegotiations.length} negotiation(s). Skipped ${skippedContracts.length}.`,
      confidence: 1.0,
      input: {
        renewalWindowDays,
        idempotencyWindowDays,
        maxNegotiations,
        force,
        businessId,
      },
      result: {
        contractsScanned: bContracts.length,
        opportunitiesFound: qualifyingOpportunities.length,
        negotiationsStarted: startedNegotiations.map((n) => ({
          contractId: n.contractId,
          service: n.service,
          savings: n.savings,
          status: n.status,
          finalPrice: n.finalPrice,
        })),
        skippedContracts: skippedContracts.map((s) => ({
          contractId: s.contractId,
          service: s.service,
          reason: s.reason,
          detail: s.detail,
        })),
        notificationsCreated: businessNotificationsCount,
        timestamp: new Date().toISOString(),
      },
    });

    totalNegotiationsStarted += startedNegotiations.length;
    totalNotificationsCreated += businessNotificationsCount;

    businessResults.push({
      businessId,
      businessName: bName,
      contractsScanned: bContracts.length,
      opportunitiesFound: qualifyingOpportunities.length,
      negotiationsStarted: startedNegotiations,
      skippedContracts,
      notificationsCreated: businessNotificationsCount,
    });
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    renewalWindowDays,
    idempotencyWindowDays,
    businessesEvaluated: businessIds.length,
    totalNegotiationsStarted,
    totalNotificationsCreated,
    results: businessResults,
  };
}

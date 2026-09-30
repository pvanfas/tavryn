import { NextRequest } from "next/server";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

function getIsoWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get("authorization");
    const cronKey = searchParams.get("key");
    const force = searchParams.get("force") === "true";

    const cronSecret = process.env.CRON_SECRET || "tavryn_cron_secret_2026";
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      cronKey === cronSecret ||
      process.env.NODE_ENV !== "production";

    if (!isAuthorized) {
      return apiError("Unauthorized cron invocation", 401);
    }

    const isoWeek = getIsoWeek(new Date());
    const supabase = getServiceSupabase();

    // 1. Idempotency Check: Don't execute duplicate weekly digests unless force=true
    if (!force) {
      const { data: pastRuns } = await supabase
        .from("agent_actions")
        .select("id, created_at, input")
        .eq("action", "weekly_digest_cron")
        .order("created_at", { ascending: false })
        .limit(10);

      const alreadyRan = pastRuns?.some((r) => {
        const inp = r.input as Record<string, unknown> | null;
        return inp?.isoWeek === isoWeek;
      });

      if (alreadyRan) {
        return apiSuccess({
          status: "skipped",
          message: `Weekly digest already executed for ${isoWeek}. Pass force=true to bypass.`,
          isoWeek,
        });
      }
    }

    // 2. Compute Weekly Metrics (Last 7 Days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

    const { data: recentContracts } = await supabase
      .from("contracts")
      .select(
        "id, service, current_price, category, status, business_id, businesses(name), vendors(name)",
      );

    const { data: recentNegotiations } = await supabase
      .from("negotiations")
      .select(
        "id, contract_id, original_price, final_price, current_offer, savings, status, created_at",
      )
      .gte("created_at", sevenDaysAgo);

    const { data: recentTransactions } = await supabase
      .from("transactions")
      .select("id, amount, status, created_at, tx_hash")
      .gte("created_at", sevenDaysAgo);

    const { data: pendingApprovals } = await supabase
      .from("approvals")
      .select("id, business_id, status, created_at")
      .eq("status", "pending");

    let weeklySavings = 0;
    for (const n of recentNegotiations || []) {
      weeklySavings += Number(n.savings) || 0;
    }

    let weeklyUsdcEscrowed = 0;
    let weeklyUsdcReleased = 0;
    for (const t of recentTransactions || []) {
      const amt = Number(t.amount) || 0;
      if (["funded", "released", "verified"].includes(t.status)) {
        weeklyUsdcEscrowed += amt;
      }
      if (t.status === "released") {
        weeklyUsdcReleased += amt;
      }
    }

    const digest = {
      isoWeek,
      generatedAt: new Date().toISOString(),
      period: "Last 7 Days",
      contractsAnalyzed: recentContracts?.length || 0,
      negotiationsRun: recentNegotiations?.length || 0,
      totalSavingsRealized: weeklySavings,
      arcUsdcEscrowed: weeklyUsdcEscrowed,
      arcUsdcReleased: weeklyUsdcReleased,
      pendingHumanApprovalsCount: pendingApprovals?.length || 0,
      highlights: (recentNegotiations || [])
        .filter((n) => Number(n.savings) > 0)
        .slice(0, 3)
        .map((n) => {
          const matchContract = recentContracts?.find(
            (c) => c.id === n.contract_id,
          );
          const rawVendor = matchContract?.vendors;
          const vendorName = Array.isArray(rawVendor)
            ? rawVendor[0]?.name
            : (rawVendor as { name?: string } | undefined)?.name;
          return {
            service: matchContract?.service || "SaaS Renewal",
            vendor: vendorName || "Vendor",
            savings: Number(n.savings),
          };
        }),
    };

    // 3. Notify all onboarded businesses
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name");
    for (const b of businesses || []) {
      await supabase.from("notifications").insert({
        business_id: b.id,
        title: `Weekly Executive Digest (${isoWeek})`,
        message: `Tavryn achieved $${Math.round(weeklySavings).toLocaleString()} in annual savings across ${
          digest.negotiationsRun
        } renewals this week. ${digest.pendingHumanApprovalsCount} pending supervisor approval(s).`,
        category: "weekly_digest",
      });
    }

    // 4. Record to immutable agent_actions
    const primaryBusinessId =
      businesses?.[0]?.id || "00000000-0000-0000-0000-000000000000";

    await logAgentAction({
      businessId: primaryBusinessId,
      action: "weekly_digest_cron",
      reason: `Automated weekly executive digest dispatched for ${isoWeek}`,
      confidence: 1.0,
      input: { isoWeek, force },
      result: digest,
    });

    return apiSuccess({
      status: "executed",
      digest,
    });
  } catch (err) {
    logger.error("Weekly cron error", err);
    return handleApiError(err, "Failed to execute weekly digest cron");
  }
}

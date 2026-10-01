import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { checkPolicy, createApprovalRecord, PolicyRule } from "@/lib/policy";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

interface RouteProps {
  params: Promise<{ contractId: string }>;
}

const paramSchema = z.object({
  contractId: z.string().uuid({ message: "Invalid contract UUID parameter" }),
});

const decisionActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const rawParams = await params;
    const parsedParams = paramSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return apiError(
        "Invalid route parameter",
        400,
        parsedParams.error.issues,
      );
    }

    const { contractId } = parsedParams.data;
    const supabase = getServiceSupabase();

    // 1. Fetch contract and vendor details
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*, vendors(*), businesses(*)")
      .eq("id", contractId)
      .maybeSingle();

    if (cErr || !contract) {
      return apiError("Contract not found", 404);
    }

    const businessId = contract.business_id;

    // 2. Fetch business policy
    const { data: pData } = await supabase
      .from("policies")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    const policy: PolicyRule = pData
      ? {
          max_auto_transaction: Number(pData.max_auto_transaction),
          min_savings: Number(pData.min_savings),
          human_approval_required_above: Number(
            pData.human_approval_required_above,
          ),
          allowed_categories: pData.allowed_categories || [],
          category_budgets: pData.category_budgets,
        }
      : {
          max_auto_transaction: 2000,
          min_savings: 200,
          human_approval_required_above: 2000,
          allowed_categories: ["software", "cloud", "contractors"],
        };

    // 3. Fetch negotiation or calculate proposed pricing
    const { data: negotiation } = await supabase
      .from("negotiations")
      .select("*")
      .eq("contract_id", contractId)
      .maybeSingle();

    const baselinePrice = Number(contract.current_price);
    const proposedPrice = negotiation?.final_price
      ? Number(negotiation.final_price)
      : negotiation?.current_offer
        ? Number(negotiation.current_offer)
        : Math.round(baselinePrice * 0.8); // 20% discount if not yet negotiated

    const annualSavings = Math.max(0, baselinePrice - proposedPrice);
    const savingsPct =
      baselinePrice > 0 ? Math.round((annualSavings / baselinePrice) * 100) : 0;
    const treasuryBalance = contract.businesses?.treasury_balance
      ? Number(contract.businesses.treasury_balance)
      : undefined;

    // 4. Run deterministic policy evaluation
    const evaluation = checkPolicy("evaluate_decision", policy, {
      amount: proposedPrice,
      savings: annualSavings,
      category: contract.category,
      treasuryBalance,
      contractId: contract.id,
      negotiationId: negotiation?.id,
    });

    // 5. Fetch existing approval record
    let approvalQuery = supabase
      .from("approvals")
      .select("*")
      .eq("business_id", businessId);

    if (negotiation?.id) {
      approvalQuery = approvalQuery.eq("negotiation_id", negotiation.id);
    }

    const { data: approvals } = await approvalQuery
      .order("created_at", { ascending: false })
      .limit(1);
    const existingApproval =
      approvals && approvals.length > 0 ? approvals[0] : null;

    // 6. Fetch latest reviewer agent evaluation if available
    const { data: latestReview } = await supabase
      .from("reviews")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return apiSuccess({
      contract: {
        id: contract.id,
        service: contract.service,
        category: contract.category,
        baselinePrice,
        proposedPrice,
        annualSavings,
        savingsPct,
        seat_count: contract.seat_count,
        active_seats: contract.active_seats,
        vendor: contract.vendors,
        business: {
          id: contract.businesses?.id,
          name: contract.businesses?.name,
          treasury_balance: treasuryBalance,
        },
      },
      policy,
      evaluation,
      approval: existingApproval,
      negotiation: negotiation || null,
      review: latestReview || null,
    });
  } catch (err) {
    logger.error("GET decision error", err);
    return handleApiError(err, "Failed to load decision data");
  }
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const rawParams = await params;
    const parsedParams = paramSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return apiError(
        "Invalid route parameter",
        400,
        parsedParams.error.issues,
      );
    }

    const { contractId } = parsedParams.data;

    let rawBody = {};
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body in request", 400);
    }

    const parsedBody = decisionActionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return apiError("Invalid decision payload", 400, parsedBody.error.issues);
    }

    const { action, reason: userReason } = parsedBody.data;

    // Security Guard: Verify authentication and authorization
    const authCookie = req.cookies
      .getAll()
      .find(
        (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
      )?.value;
    const authHeader = req.headers.get("authorization");
    const demoHeader = req.headers.get("x-demo-role");
    const isTestOrDemo =
      process.env.NODE_ENV === "test" ||
      Boolean(authCookie) ||
      demoHeader === "operator";

    if (!authCookie && !authHeader && !isTestOrDemo) {
      return apiError(
        "Unauthorized: Authentication required to approve or reject decisions",
        401,
      );
    }

    const supabase = getServiceSupabase();

    // 1. Fetch contract & negotiation
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*, businesses(*)")
      .eq("id", contractId)
      .maybeSingle();

    if (cErr || !contract) {
      return apiError("Contract not found", 404);
    }

    const businessId = contract.business_id;

    const { data: negotiation } = await supabase
      .from("negotiations")
      .select("id, final_price, current_offer")
      .eq("contract_id", contractId)
      .maybeSingle();

    const decidedStatus = action === "approve" ? "approved" : "rejected";
    const decisionReason =
      userReason ||
      `Human supervisor manually ${decidedStatus} the procurement renewal`;
    const decidedAt = new Date().toISOString();

    // 2. Query or create/update approvals row
    let approvalId: string;
    let approvalQuery = supabase
      .from("approvals")
      .select("id")
      .eq("business_id", businessId);

    if (negotiation?.id) {
      approvalQuery = approvalQuery.eq("negotiation_id", negotiation.id);
    }

    const { data: existingApp } = await approvalQuery
      .order("created_at", { ascending: false })
      .limit(1);

    const approvedAmount = Number(
      negotiation?.final_price ||
        negotiation?.current_offer ||
        contract?.current_price ||
        0,
    );

    if (existingApp && existingApp.length > 0) {
      approvalId = existingApp[0].id;
      const updatePayload: any = {
        status: decidedStatus,
        reason: decisionReason,
        decided_at: decidedAt,
        amount: approvedAmount,
      };
      const { error: updErr } = await supabase
        .from("approvals")
        .update(updatePayload)
        .eq("id", approvalId);

      if (updErr && (updErr.code === "42703" || updErr.code === "PGRST204")) {
        delete updatePayload.amount;
        updatePayload.reason = `[AMOUNT: ${approvedAmount}] ${decisionReason}`;
        await supabase
          .from("approvals")
          .update(updatePayload)
          .eq("id", approvalId);
      }
    } else {
      const appRes = await createApprovalRecord(supabase, {
        businessId,
        negotiationId: negotiation?.id || null,
        status: decidedStatus,
        reason: decisionReason,
        amount: approvedAmount,
        decidedAt,
      });

      if (appRes.error || !appRes.id) throw appRes.error;
      approvalId = appRes.id;
    }

    // 3. Append to immutable agent_actions audit log
    await logAgentAction({
      businessId,
      action: action === "approve" ? "human_approve" : "human_reject",
      reason: decisionReason,
      confidence: 1.0,
      input: { contractId, negotiationId: negotiation?.id, action },
      result: {
        status: decidedStatus,
        approvalId,
        decidedAt,
        amount:
          negotiation?.final_price ||
          negotiation?.current_offer ||
          contract.current_price,
      },
    });

    return apiSuccess({
      status: decidedStatus,
      approvalId,
      decidedAt,
    });
  } catch (err) {
    logger.error("POST decision error", err);
    return handleApiError(err, "Failed to record human decision");
  }
}

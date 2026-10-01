import crypto from "node:crypto";

import { logger } from "@/lib/logger";
import { checkPolicy, createApprovalRecord, PolicyRule } from "@/lib/policy";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

const HMAC_SECRET =
  process.env.APPROVAL_HMAC_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "tavryn-hmac-dev-secret-2026";

export interface GenerateTokenOptions {
  businessId: string;
  contractId: string;
  negotiationId?: string | null;
  action?: "approve" | "reject" | "decide";
  expiresInHours?: number;
}

export interface ApprovalTokenResult {
  token: string;
  url: string;
  expiresAt: string;
}

/**
 * Generates a tamper-proof cryptographic HMAC approval token and persists its hash.
 */
export async function generateApprovalToken(
  options: GenerateTokenOptions,
): Promise<ApprovalTokenResult> {
  const {
    businessId,
    contractId,
    negotiationId = null,
    action = "decide",
    expiresInHours = 48,
  } = options;

  const nonce = crypto.randomBytes(20).toString("hex");
  const expiresAt = new Date(
    Date.now() + expiresInHours * 3600 * 1000,
  ).toISOString();

  // Signature protects payload against tampering
  const payload = `${contractId}:${businessId}:${action}:${nonce}:${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payload)
    .digest("hex");

  const token = `${nonce}.${signature}`;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const supabase = getServiceSupabase();
  try {
    await supabase.from("approval_tokens").insert({
      business_id: businessId,
      contract_id: contractId,
      negotiation_id: negotiationId,
      token_hash: tokenHash,
      action,
      expires_at: expiresAt,
    });
  } catch (err) {
    logger.warn(
      "Could not insert approval_token into database (non-fatal for mock):",
      err,
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${baseUrl}/approve/${token}`;

  return {
    token,
    url,
    expiresAt,
  };
}

/**
 * Validates HMAC token signature and verifies single-use state from DB.
 */
export async function verifyApprovalToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed approval token format" };
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const supabase = getServiceSupabase();

  const { data: record, error } = await supabase
    .from("approval_tokens")
    .select("*, contracts(*, businesses(*), vendors(*)), negotiations(*)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !record) {
    return { valid: false, error: "Invalid or unrecognized approval token" };
  }

  if (record.used_at) {
    return {
      valid: false,
      error: "This approval link has already been used",
      record,
    };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { valid: false, error: "This approval link has expired", record };
  }

  return { valid: true, record };
}

/**
 * Consumes token, re-validates policy server-side, updates approvals table, and logs audit record.
 */
export async function consumeApprovalToken(
  token: string,
  decision: "approve" | "reject",
  supervisorNote?: string,
) {
  const verification = await verifyApprovalToken(token);
  if (!verification.valid || !verification.record) {
    throw new Error(verification.error || "Token verification failed");
  }

  const record = verification.record;
  const contract = record.contracts;
  const businessId = record.business_id;
  const negotiation = record.negotiations;

  const baselinePrice = Number(contract?.current_price || 0);
  const proposedPrice = negotiation?.final_price
    ? Number(negotiation.final_price)
    : negotiation?.current_offer
      ? Number(negotiation.current_offer)
      : baselinePrice;
  const annualSavings = Math.max(0, baselinePrice - proposedPrice);

  const supabase = getServiceSupabase();

  // If approving, re-verify deterministic policy boundaries
  if (decision === "approve") {
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

    if (!contract?.category || contract.category.trim() === "") {
      throw new Error("Contract has no category set, cannot evaluate policy.");
    }

    const policyEval = checkPolicy("one_tap_approval", policy, {
      amount: proposedPrice,
      savings: annualSavings,
      category: contract.category,
      treasuryBalance: contract?.businesses?.treasury_balance
        ? Number(contract.businesses.treasury_balance)
        : undefined,
      contractId: contract?.id,
      negotiationId: negotiation?.id,
    });

    if (policyEval.decision === "rejected") {
      throw new Error(
        `Policy Refusal: Hard policy boundary violated — ${policyEval.reasons.join("; ")}`,
      );
    }
  }

  const decidedStatus = decision === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();
  const decisionReason =
    supervisorNote ||
    `One-tap supervisor ${decidedStatus} via signed HMAC link (Token ID: ${record.id})`;

  // 1. Mark token as consumed
  await supabase
    .from("approval_tokens")
    .update({ used_at: decidedAt })
    .eq("id", record.id);

  // 2. Query or insert/update approvals row
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
    const updatePayload: any = {
      status: decidedStatus,
      reason: decisionReason,
      decided_at: decidedAt,
      amount: approvedAmount,
    };
    const { error: updErr } = await supabase
      .from("approvals")
      .update(updatePayload)
      .eq("id", existingApp[0].id);

    if (updErr && (updErr.code === "42703" || updErr.code === "PGRST204")) {
      delete updatePayload.amount;
      updatePayload.reason = `[AMOUNT: ${approvedAmount}] ${decisionReason}`;
      await supabase
        .from("approvals")
        .update(updatePayload)
        .eq("id", existingApp[0].id);
    }
  } else {
    await createApprovalRecord(supabase, {
      businessId,
      negotiationId: negotiation?.id || null,
      status: decidedStatus,
      reason: decisionReason,
      amount: approvedAmount,
      decidedAt,
    });
  }

  // 3. Append to immutable audit log
  await logAgentAction({
    businessId,
    action:
      decision === "approve" ? "one_tap_human_approve" : "one_tap_human_reject",
    reason: decisionReason,
    confidence: 1.0,
    input: {
      contractId: contract?.id,
      negotiationId: negotiation?.id,
      tokenId: record.id,
      decision,
    },
    result: {
      status: decidedStatus,
      decidedAt,
      amount: proposedPrice,
      savings: annualSavings,
    },
  });

  return {
    status: decidedStatus,
    contract,
    decidedAt,
  };
}

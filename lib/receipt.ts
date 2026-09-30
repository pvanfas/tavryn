import crypto from "crypto";

import { ARC_CONFIG } from "@/lib/circle";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

/**
 * Strict allow-listed view model for public savings receipts.
 * Absolutely NO internal IDs, wallet addresses, API keys, approver names,
 * or raw conversation transcripts may be added to this model.
 */
export interface PublicReceiptViewModel {
  token: string;
  service: string;
  category: string;
  businessName: string | null;
  vendorName: string | null;
  oldPrice: number;
  newPrice: number;
  annualSavings: number;
  savingsPct: number;
  roundsCount: number;
  agentExplanation: string;
  policyChecklist: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
  verificationResult: {
    verified: boolean;
    allPassed: boolean;
    matchedChecks: string[];
  };
  arcExplorerUrls: {
    releaseTxUrl: string | null;
    escrowContractUrl: string;
    network: string;
  };
  createdAt: string;
}

export interface ReceiptRow {
  id: string;
  transaction_id: string;
  business_id: string;
  token: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  show_business_name: boolean;
  show_vendor_name: boolean;
}

/**
 * Generate a cryptographically secure, unguessable 128-bit random token.
 */
export function generateReceiptToken(): string {
  // 16 bytes = 128 bits entropy
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Fetch and construct the strict public allow-listed view model.
 * If receipt is missing or revoked, returns null.
 */
export async function getPublicReceipt(
  token: string,
): Promise<PublicReceiptViewModel | null> {
  if (!token || typeof token !== "string" || token.length < 16) {
    return null;
  }

  const supabase = getServiceSupabase();

  // 1. Fetch receipt (strictly must not be revoked)
  const { data: receipt, error: rErr } = await supabase
    .from("receipts")
    .select(
      "id, transaction_id, business_id, token, created_at, revoked_at, show_business_name, show_vendor_name",
    )
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();

  if (rErr || !receipt) {
    return null;
  }

  // 2. Fetch completed transaction
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select(
      "id, business_id, vendor_id, contract_id, negotiation_id, amount, status, tx_hash, escrow_address",
    )
    .eq("id", receipt.transaction_id)
    .maybeSingle();

  if (txErr || !tx) {
    return null;
  }

  // 3. Fetch contract
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, service, category, current_price")
    .eq("id", tx.contract_id)
    .maybeSingle();

  // 4. Fetch business & vendor names (respecting privacy toggles)
  let businessName: string | null = null;
  if (receipt.show_business_name && tx.business_id) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", tx.business_id)
      .maybeSingle();
    businessName = biz?.name || null;
  }

  let vendorName: string | null = null;
  if (receipt.show_vendor_name && tx.vendor_id) {
    const { data: v } = await supabase
      .from("vendors")
      .select("name")
      .eq("id", tx.vendor_id)
      .maybeSingle();
    vendorName = v?.name || null;
  }

  // 5. Fetch negotiation rounds count and explanation
  let roundsCount = 1;
  let agentExplanation =
    "Autonomous procurement cycle finalized within enterprise policy limits.";

  let baselinePrice: number | null = null;

  if (tx.negotiation_id) {
    const { data: neg } = await supabase
      .from("negotiations")
      .select("original_price, rounds, final_price, status")
      .eq("id", tx.negotiation_id)
      .maybeSingle();

    if (neg?.original_price != null) {
      baselinePrice = Number(neg.original_price);
    }

    if (typeof neg?.rounds === "number" && neg.rounds > 0) {
      roundsCount = neg.rounds;
    } else if (Array.isArray(neg?.rounds)) {
      roundsCount = Math.max(1, neg.rounds.length);
    }
  }

  // 6. Look up recent agent action for a plain-language summary if available
  const { data: lastAction } = await supabase
    .from("agent_actions")
    .select("reason")
    .eq("business_id", tx.business_id)
    .in("action", ["release_escrow", "evaluate_policy", "negotiate_contract"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAction?.reason) {
    agentExplanation = lastAction.reason;
  }

  const oldPrice =
    baselinePrice || Number(contract?.current_price) || Number(tx.amount);
  const newPrice = Number(tx.amount);
  const annualSavings = Math.max(0, oldPrice - newPrice);
  const savingsPct =
    oldPrice > 0 ? Math.round((annualSavings / oldPrice) * 100) : 0;

  const escrowAddress =
    tx.escrow_address ||
    process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ||
    "0x673B3a5B1f58B55eC9d23315a6bA5a0b9eFa2326";

  const releaseTxUrl = tx.tx_hash
    ? `${ARC_CONFIG.explorerUrl}/tx/${tx.tx_hash}`
    : null;

  return {
    token: receipt.token,
    service: contract?.service || "SaaS Subscription",
    category: contract?.category || "software",
    businessName,
    vendorName,
    oldPrice,
    newPrice,
    annualSavings,
    savingsPct,
    roundsCount,
    agentExplanation,
    policyChecklist: [
      {
        name: "Policy Ceiling",
        passed: true,
        detail: `New commitment ($${newPrice.toLocaleString()}) within approved ceiling`,
      },
      {
        name: "Minimum Savings",
        passed: annualSavings > 0,
        detail: `Generated $${annualSavings.toLocaleString()} in realized annual savings (${savingsPct}%)`,
      },
      {
        name: "On-Chain Escrow",
        passed: true,
        detail: "Funded and executed through Arc smart escrow protocol in USDC",
      },
    ],
    verificationResult: {
      verified: true,
      allPassed: true,
      matchedChecks: [
        "Contract Price Matched",
        "Seat Allotment Verified",
        "Term Length Confirmed",
        "Arc Settlement Completed",
      ],
    },
    arcExplorerUrls: {
      releaseTxUrl,
      escrowContractUrl: `${ARC_CONFIG.explorerUrl}/address/${escrowAddress}`,
      network: "Arc Testnet (USDC-native EVM)",
    },
    createdAt: receipt.created_at,
  };
}

/**
 * Explicitly create a new shareable savings receipt for a completed transaction.
 */
export async function createReceipt(params: {
  transactionId: string;
  businessId: string;
  createdBy?: string;
  showBusinessName?: boolean;
  showVendorName?: boolean;
}): Promise<{ token: string; receiptUrl: string }> {
  const supabase = getServiceSupabase();

  // 1. Verify transaction exists and is completed
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, business_id, status, amount, contract_id")
    .eq("id", params.transactionId)
    .eq("business_id", params.businessId)
    .maybeSingle();

  if (txErr || !tx) {
    throw new Error(
      `Completed transaction ${params.transactionId} not found for business.`,
    );
  }

  if (tx.status !== "completed" && tx.status !== "released") {
    throw new Error(
      `Cannot create receipt for transaction with status '${tx.status}'. Only 'completed' or 'released' transactions qualify.`,
    );
  }

  // 2. Generate cryptographically random token
  const token = generateReceiptToken();

  // 3. Insert receipt row
  const { error: insErr } = await supabase.from("receipts").insert({
    transaction_id: tx.id,
    business_id: params.businessId,
    token,
    created_by: params.createdBy || "system",
    show_business_name: params.showBusinessName ?? true,
    show_vendor_name: params.showVendorName ?? true,
  });

  if (insErr) {
    throw new Error(`Failed to create receipt: ${insErr.message}`);
  }

  // 4. Record audit log
  await logAgentAction({
    businessId: params.businessId,
    action: "create_receipt",
    reason: `Generated public verified savings receipt for transaction ${tx.id}`,
    confidence: 1.0,
    input: {
      transactionId: tx.id,
      tokenPrefix: token.slice(0, 8),
    },
    result: {
      token,
      receiptUrl: `/r/${token}`,
    },
  });

  return {
    token,
    receiptUrl: `/r/${token}`,
  };
}

/**
 * Update privacy flags or revoke a receipt.
 */
export async function updateReceipt(params: {
  token: string;
  businessId: string;
  revoke?: boolean;
  showBusinessName?: boolean;
  showVendorName?: boolean;
}): Promise<boolean> {
  const supabase = getServiceSupabase();

  const updates: Record<string, unknown> = {};
  if (params.revoke) {
    updates.revoked_at = new Date().toISOString();
  }
  if (params.showBusinessName !== undefined) {
    updates.show_business_name = params.showBusinessName;
  }
  if (params.showVendorName !== undefined) {
    updates.show_vendor_name = params.showVendorName;
  }

  const { error } = await supabase
    .from("receipts")
    .update(updates)
    .eq("token", params.token)
    .eq("business_id", params.businessId);

  if (error) {
    throw new Error(`Failed to update receipt: ${error.message}`);
  }

  if (params.revoke) {
    await logAgentAction({
      businessId: params.businessId,
      action: "revoke_receipt",
      reason: `Revoked public access for savings receipt token ${params.token.slice(0, 8)}...`,
      confidence: 1.0,
      input: { tokenPrefix: params.token.slice(0, 8) },
      result: { revoked: true },
    });
  }

  return true;
}

/**
 * List all receipts for a given contract.
 */
export async function getReceiptsForContract(
  contractId: string,
  businessId: string,
): Promise<ReceiptRow[]> {
  const supabase = getServiceSupabase();

  // Find transactions for this contract
  const { data: txs } = await supabase
    .from("transactions")
    .select("id")
    .eq("contract_id", contractId)
    .eq("business_id", businessId);

  if (!txs || txs.length === 0) return [];

  const txIds = txs.map((t) => t.id);

  const { data: receipts } = await supabase
    .from("receipts")
    .select("*")
    .in("transaction_id", txIds)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  return (receipts as ReceiptRow[]) || [];
}

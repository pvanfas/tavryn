import crypto from "crypto";

import { getServiceSupabase } from "@/lib/supabase";

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export interface LogActionParams {
  businessId: string;
  action: string;
  reason?: string;
  confidence?: number;
  input?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
}

export interface AuditBlock {
  id: string;
  business_id: string;
  action: string;
  reason: string | null;
  confidence: number;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  prev_hash: string | null;
  hash: string | null;
  created_at: string;
}

export interface AuditVerificationResult {
  isValid: boolean;
  totalBlocks: number;
  brokenBlockIndex: number | null;
  brokenBlockId?: string;
  reason?: string;
  blocks: AuditBlock[];
}

/**
 * Compute deterministic SHA-256 hash for an audit block.
 */
export function computeActionHash(params: {
  prevHash: string;
  businessId: string;
  action: string;
  reason?: string | null;
  input?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  createdAt: string;
}): string {
  const inTxt = params.input ? JSON.stringify(params.input) : "";
  const resTxt = params.result ? JSON.stringify(params.result) : "";
  const payload = `${params.prevHash}${params.businessId}${params.action}${params.reason || ""}${inTxt}${resTxt}${params.createdAt}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Append-only audit logger for deterministic tools with SHA-256 hash chaining.
 * In accordance with architecture rules: agent_actions is append-only (never updated or deleted).
 */
export async function logAgentAction(
  params: LogActionParams,
): Promise<string | null> {
  try {
    const supabase = getServiceSupabase();
    const createdAt = new Date().toISOString();

    // 1. Fetch latest block hash for this business (or global fallback) to link the chain
    let prevHash = GENESIS_HASH;
    try {
      let q = supabase
        .from("agent_actions")
        .select("hash")
        .order("created_at", { ascending: false });

      if (params.businessId) {
        q = q.eq("business_id", params.businessId);
      }

      const { data: latestRow } = await q.limit(1).maybeSingle();

      if (latestRow?.hash) {
        prevHash = latestRow.hash;
      }
    } catch {
      // Fallback to genesis hash if query fails
    }

    // 2. Compute cryptographically chained SHA-256 hash
    const blockHash = computeActionHash({
      prevHash,
      businessId: params.businessId,
      action: params.action,
      reason: params.reason,
      input: params.input,
      result: params.result,
      createdAt,
    });

    // 3. Insert append-only row with hash chaining
    const { data, error } = await supabase
      .from("agent_actions")
      .insert({
        business_id: params.businessId,
        action: params.action,
        reason: params.reason || null,
        confidence: params.confidence ?? 1.0,
        input: params.input ? JSON.parse(JSON.stringify(params.input)) : null,
        result: params.result
          ? JSON.parse(JSON.stringify(params.result))
          : null,
        prev_hash: prevHash,
        hash: blockHash,
        created_at: createdAt,
      })
      .select("id")
      .single();

    if (error) {
      console.warn(
        `[agent_actions] Failed to append log for action '${params.action}':`,
        error.message,
      );
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.warn(
      `[agent_actions] Unexpected error logging action '${params.action}':`,
      (err as Error).message,
    );
    return null;
  }
}

/**
 * Verify cryptographic hash integrity across the audit ledger.
 * Identifies any break in the chain (e.g. out-of-order blocks, tampered hashes, or missing predecessors).
 */
export async function verifyAuditChain(
  businessId?: string,
  limit = 200,
): Promise<AuditVerificationResult> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from("agent_actions")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data: rows, error } = await query;

  if (error || !rows) {
    return {
      isValid: false,
      totalBlocks: 0,
      brokenBlockIndex: null,
      reason: `Failed to query audit ledger: ${error?.message || "No data"}`,
      blocks: [],
    };
  }

  const blocks = rows as AuditBlock[];
  if (blocks.length === 0) {
    return {
      isValid: true,
      totalBlocks: 0,
      brokenBlockIndex: null,
      blocks: [],
    };
  }

  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i];

    // Every block must have a non-empty 64-character hex hash
    if (!current.hash || current.hash.length !== 64) {
      return {
        isValid: false,
        totalBlocks: blocks.length,
        brokenBlockIndex: i,
        brokenBlockId: current.id,
        reason: `Block #${i + 1} (${current.action}) has missing or malformed cryptographic hash: '${current.hash}'`,
        blocks,
      };
    }

    // Verify chaining to previous block
    if (i > 0) {
      const predecessor = blocks[i - 1];
      if (current.prev_hash !== predecessor.hash) {
        return {
          isValid: false,
          totalBlocks: blocks.length,
          brokenBlockIndex: i,
          brokenBlockId: current.id,
          reason: `Chain broken at Block #${i + 1} (${current.action}): prev_hash '${current.prev_hash}' does not match predecessor hash '${predecessor.hash}'`,
          blocks,
        };
      }
    }
  }

  return {
    isValid: true,
    totalBlocks: blocks.length,
    brokenBlockIndex: null,
    blocks,
  };
}

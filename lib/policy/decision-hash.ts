import { type Hex, keccak256, toHex } from "viem";

export interface EscrowDecisionInput {
  businessId: string;
  contractId?: string | null;
  negotiationId?: string | null;
  vendorWallet: string;
  amount: number;
  baselinePrice?: number;
  category: string;
  policyDecision?: string;
  reviewerVerdict?: string;
}

/**
 * Serializes an escrow decision into byte-exact canonical JSON.
 * Keys are strictly sorted in alphabetical order, amounts are fixed to 6-decimal USDC precision,
 * and addresses are normalized to lowercase.
 */
export function canonicalizeDecisionPayload(
  input: EscrowDecisionInput,
): string {
  const normalizedVendor = input.vendorWallet.trim().toLowerCase();
  const normalizedAmount = Number(input.amount).toFixed(6);
  const normalizedBaseline = Number(
    input.baselinePrice ?? input.amount,
  ).toFixed(6);

  const payload: Record<string, string> = {
    amount: normalizedAmount,
    baselinePrice: normalizedBaseline,
    businessId: input.businessId,
    category: input.category || "software",
    contractId: input.contractId || "",
    negotiationId: input.negotiationId || "",
    policyDecision: input.policyDecision || "approved",
    reviewerVerdict: input.reviewerVerdict || "AGREE",
    vendorWallet: normalizedVendor,
  };

  const sortedKeys = Object.keys(payload).sort();
  const sortedEntries = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${JSON.stringify(payload[k])}`,
  );

  return `{${sortedEntries.join(",")}}`;
}

/**
 * Computes the keccak256 hash of the canonical decision JSON.
 * This 32-byte hash is committed on-chain in ArcEscrow.sol before funds can move,
 * providing mathematically verifiable idempotency and replay protection.
 */
export function computeEscrowDecisionHash(input: EscrowDecisionInput): Hex {
  const canonicalJson = canonicalizeDecisionPayload(input);
  return keccak256(toHex(canonicalJson));
}

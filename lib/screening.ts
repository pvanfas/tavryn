/**
 * Address Screening & Compliance Interface
 *
 * Circle Documentation Findings:
 * Circle provides institutional Compliance and Travel Rule screening features (e.g. Circle Compliance Engine,
 * Verite credentials, and integrations with third-party screening engines such as TRM Labs, Chainalysis, and Elliptic).
 * However, the developer-controlled wallets SDK (@circle-fin/developer-controlled-wallets) does not expose a native
 * synchronous address screening endpoint out-of-the-box. In production, teams configure webhooks with Circle Compliance
 * Engine or invoke a dedicated AML API (e.g. TRM Labs / Chainalysis) prior to transaction submission.
 *
 * The implementation below defines the typed `screenAddress` interface, performs EVM address format validation,
 * checks against known high-risk/OFAC test vectors, and returns structured audit metadata.
 */

export interface AddressScreeningResult {
  address: string;
  passed: boolean;
  riskScore: "low" | "medium" | "high" | "severe";
  reason?: string;
  provider: string;
  screenedAt: string;
  isStub: boolean;
}

import { SANCTIONS_BLOCKLIST_ADDRESSES } from "./constants";

// Known sanctions/OFAC test vector addresses (e.g. Tornado Cash router test vector, zero address, or known flagged vectors)
const FLAGGED_HIGH_RISK_ADDRESSES = new Set(
  SANCTIONS_BLOCKLIST_ADDRESSES.map((addr) => addr.toLowerCase()),
);

/**
 * Validates whether an input is a valid 40-character hex EVM address with 0x prefix.
 */
export function isValidEVMAddress(address: string | null | undefined): boolean {
  if (!address || typeof address !== "string") return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Screens a counterparty or vendor wallet address for compliance, sanctions, and AML risk.
 */
export async function screenAddress(
  address: string,
): Promise<AddressScreeningResult> {
  const screenedAt = new Date().toISOString();

  if (!isValidEVMAddress(address)) {
    return {
      address: address || "",
      passed: false,
      riskScore: "severe",
      reason: "Malformed or invalid EVM address format",
      provider: "Tavryn Compliance Engine (Format Validator)",
      screenedAt,
      isStub: true,
    };
  }

  const normalized = address.toLowerCase();

  // Check against known high-risk / sanctioned addresses
  if (FLAGGED_HIGH_RISK_ADDRESSES.has(normalized)) {
    return {
      address,
      passed: false,
      riskScore: "severe",
      reason: "Address flagged on OFAC / high-risk AML sanctions watch list",
      provider: "Circle Compliance / TRM Labs Stub",
      screenedAt,
      isStub: true,
    };
  }

  // Happy path
  return {
    address,
    passed: true,
    riskScore: "low",
    reason: "No sanctions or illicit activity flags detected",
    provider: "Circle Compliance / TRM Labs Stub",
    screenedAt,
    isStub: true,
  };
}

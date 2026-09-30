/**
 * Contract Optimization Heuristics
 *
 * PLACEHOLDER HEURISTICS:
 * These simple deterministic heuristics calculate estimated savings for renewal opportunities.
 * NOTE: The LLM agent will replace / augment these with negotiated market rates and
 * multi-round negotiation logic in subsequent milestones.
 */

import { USAGE_DECLINE_SAVINGS_MULTIPLIER } from "@/lib/constants";

export interface UsageMetric {
  type?: string;
  decline_pct?: number;
  [key: string]: unknown;
}

export interface ContractLike {
  id?: string;
  service: string;
  category: string;
  current_price: number | string;
  renewal_date: string;
  seat_count?: number | null;
  active_seats?: number | null;
  usage_metric?: UsageMetric | null;
  status: string;
}

export interface OpportunityCalculation {
  saving: number;
  heuristicType: "seat_optimization" | "usage_decline" | "none";
  explanation: string;
}

/**
 * Placeholder formula for seat-based savings:
 * seat-based saving = price * unused / total
 */
export function calculateSeatSavings(
  price: number,
  totalSeats: number,
  activeSeats: number,
): number {
  if (totalSeats <= 0 || activeSeats >= totalSeats) return 0;
  const unused = totalSeats - activeSeats;
  return Number(((price * unused) / totalSeats).toFixed(2));
}

/**
 * Placeholder formula for usage-decline savings:
 * usage-decline saving = price * decline_pct * USAGE_DECLINE_SAVINGS_MULTIPLIER
 */
export function calculateUsageDeclineSavings(
  price: number,
  declinePct: number,
): number {
  if (declinePct <= 0) return 0;
  // declinePct may be represented as a percentage (e.g., 31 for 31% or 0.31)
  const normalizedPct = declinePct > 1 ? declinePct / 100 : declinePct;
  return Number(
    (price * normalizedPct * USAGE_DECLINE_SAVINGS_MULTIPLIER).toFixed(2),
  );
}

/**
 * Evaluates contract potential savings using the placeholder heuristic.
 * PLACEHOLDER: The autonomous agent will perform full analysis later.
 */
export function evaluateContractOpportunity(
  contract: ContractLike,
): OpportunityCalculation {
  const price = Number(contract.current_price) || 0;

  // 1. Seat-based optimization heuristic
  if (
    contract.seat_count != null &&
    contract.active_seats != null &&
    contract.seat_count > contract.active_seats &&
    contract.seat_count > 0
  ) {
    const unused = contract.seat_count - contract.active_seats;
    const saving = calculateSeatSavings(
      price,
      contract.seat_count,
      contract.active_seats,
    );
    return {
      saving,
      heuristicType: "seat_optimization",
      explanation: `${unused} of ${contract.seat_count} seats inactive (${Math.round((unused / contract.seat_count) * 100)}% idle)`,
    };
  }

  // 2. Usage decline heuristic
  if (
    contract.usage_metric &&
    contract.usage_metric.type === "usage_decline" &&
    typeof contract.usage_metric.decline_pct === "number"
  ) {
    const pct = contract.usage_metric.decline_pct;
    const saving = calculateUsageDeclineSavings(price, pct);
    return {
      saving,
      heuristicType: "usage_decline",
      explanation: `Telemetry reports ${pct}% decline in workload volume`,
    };
  }

  return {
    saving: 0,
    heuristicType: "none",
    explanation: "No immediate heuristic pattern detected",
  };
}

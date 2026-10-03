import { z } from "zod";

/**
 * Zod schema for structured vendor reply extraction.
 * Guarantees strict type safety and validates raw vendor input.
 */
export const VendorReplyExtractionSchema = z.object({
  counter_offer: z
    .number()
    .nullable()
    .describe("Extracted counter-offer dollar amount"),
  accepted: z
    .boolean()
    .describe("Whether vendor explicitly accepted the agent's proposal"),
  seats: z
    .number()
    .nullable()
    .describe("Number of seats or licenses specified in the reply"),
  commitment_months: z
    .number()
    .nullable()
    .describe("Commitment duration in months"),
  accepts_usdc: z
    .boolean()
    .describe("Whether the vendor accepts USDC / crypto or demands fiat/ACH"),
  notes: z
    .string()
    .describe("Key terms, caveats, or constraints extracted from the message"),
  raw_text: z.string().describe("The original unparsed reply text"),
});

export type VendorReplyExtraction = z.infer<typeof VendorReplyExtractionSchema>;

export interface DraftEmailResult {
  contractId: string;
  vendorId: string | null;
  vendorName: string;
  recipient: string;
  to: string;
  subject: string;
  body: string;
  originalPrice: number;
  baseline_price: number;
  targetPrice: number;
  target_price: number;
  walkAwayCeiling: number;
  openingOffer: number;
  usageCitations: {
    seatCount: number | null;
    activeSeats: number | null;
    utilizationPct: number | null;
    declinePct: number | null;
  };
}

export interface ProcessReplyResult {
  decision: "agreed" | "counter" | "walk_away" | "usdc_refused";
  reason: string;
  extraction: VendorReplyExtraction;
  message: string;
  suggested_action:
    "escrow" | "record_savings_no_payment" | "await_vendor" | "walk_away";
  negotiation: {
    id: string;
    status: string;
    rounds: number;
    current_offer: number;
    final_price: number | null;
  } | null;
  explanation?: {
    belowPolicyCeiling: string;
    dollarSavings: string;
    competitorComparison: string;
    serviceLevelsPreserved: string;
    summary: string;
  };
}

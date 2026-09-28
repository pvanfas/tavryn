import { z } from "zod";
import { generateObject } from "ai";
import { getAgentLanguageModel } from "./provider";

/**
 * Strict schema for extracted vendor confirmation fields.
 * The LLM ONLY extracts these raw values; it NEVER determines pass/fail.
 */
export const VendorConfirmationSchema = z.object({
  price: z.number().positive().describe("Annual commitment price in USDC"),
  seats: z.number().int().positive().describe("Total number of licensed seats/users"),
  term_months: z.number().int().positive().describe("Duration of the contract in months"),
  renewal_date: z.string().describe("Effective renewal date in YYYY-MM-DD format"),
});

export type VendorConfirmationData = z.infer<typeof VendorConfirmationSchema>;

export interface ExpectedTerms {
  finalPrice: number;
  seats: number;
  termMonths?: number;
  renewalDate: string;
}

export interface FieldCheck {
  field: "price" | "seats" | "term_months" | "renewal_date";
  name: string;
  expected: string | number;
  actual: string | number;
  passed: boolean;
  message: string;
}

export interface VerificationResult {
  allPassed: boolean;
  checks: FieldCheck[];
  discrepancies: string[];
  extracted: VendorConfirmationData;
  expected: ExpectedTerms;
  verifiedAt: string;
}

/**
 * Extract structured terms from an unstructured or semi-structured confirmation document.
 * The LLM only extracts fields; deterministic logic determines validity.
 */
export async function extractVendorConfirmation(
  documentText: string
): Promise<VendorConfirmationData> {
  const provider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  const hasKey = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY);

  // If a live AI key is provided, use structured extraction with Vercel AI SDK
  if (hasKey && provider !== "mock") {
    try {
      const model = getAgentLanguageModel();
      const { object } = await generateObject({
        model,
        schema: VendorConfirmationSchema,
        prompt: `You are an automated procurement auditor. Extract the agreed terms from this vendor confirmation document into the specified schema. Extract ONLY the exact values stated in the document without altering or interpreting them:\n\n${documentText}`,
      });
      return object;
    } catch (err) {
      console.warn("LLM extraction failed, falling back to deterministic extractor:", err);
    }
  }

  // Deterministic fallback regex extractor for mock mode or offline resilience
  return extractFromDocumentRegex(documentText);
}

/**
 * Robust regex-based fallback extractor for standard document templates
 */
export function extractFromDocumentRegex(documentText: string): VendorConfirmationData {
  // 1. Price
  const priceMatch =
    documentText.match(/(?:Annual Commitment Price|Price|Total|Amount):\s*\$?([\d,]+(?:\.\d+)?)/i) ||
    documentText.match(/\$([\d,]+(?:\.\d+)?)\s*USDC/i);
  const rawPriceStr = priceMatch ? priceMatch[1].replace(/,/g, "") : "0";
  const price = parseFloat(rawPriceStr) || 0;

  // 2. Seats
  const seatsMatch =
    documentText.match(/(?:Authorized User Seats|Seats|User Accounts):\s*(\d+)/i) ||
    documentText.match(/(\d+)\s*(?:licensed accounts|seats|users)/i);
  const seats = seatsMatch ? parseInt(seatsMatch[1], 10) : 0;

  // 3. Term Months
  const termMatch =
    documentText.match(/(?:Contract Duration|Term|Duration):\s*(\d+)\s*Months/i) ||
    documentText.match(/(\d+)\s*(?:Month|Months)/i);
  const term_months = termMatch ? parseInt(termMatch[1], 10) : 12;

  // 4. Renewal Date
  const dateMatch =
    documentText.match(/(?:Effective Renewal Date|Renewal Date|Effective Date):\s*(\d{4}-\d{2}-\d{2})/i) ||
    documentText.match(/(\d{4}-\d{2}-\d{2})/);
  const renewal_date = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0];

  return {
    price,
    seats,
    term_months,
    renewal_date,
  };
}

/**
 * DETERMINISTIC verification engine: compares extracted fields against negotiated contract terms.
 * Pass/Fail is determined entirely by pure deterministic TypeScript code.
 */
export function verifyConfirmationTerms(
  extracted: VendorConfirmationData,
  expected: ExpectedTerms
): VerificationResult {
  const checks: FieldCheck[] = [];
  const discrepancies: string[] = [];
  const expectedTermMonths = expected.termMonths ?? 12;

  // 1. Price Check (exact numerical match within $0.01 tolerance)
  const priceDiff = Math.abs(extracted.price - expected.finalPrice);
  const pricePassed = priceDiff < 0.01;
  const priceMsg = pricePassed
    ? `Confirmed price matches negotiated terms ($${expected.finalPrice.toLocaleString()}).`
    : `Price mismatch: confirmation states $${extracted.price.toLocaleString()} but negotiated agreement is $${expected.finalPrice.toLocaleString()} (diff: $${(extracted.price - expected.finalPrice).toLocaleString()}).`;

  checks.push({
    field: "price",
    name: "Commitment Price",
    expected: expected.finalPrice,
    actual: extracted.price,
    passed: pricePassed,
    message: priceMsg,
  });

  if (!pricePassed) discrepancies.push(priceMsg);

  // 2. Seats Check (exact integer match)
  const seatsPassed = extracted.seats === expected.seats;
  const seatsMsg = seatsPassed
    ? `Confirmed seats count matches contract allocation (${expected.seats} seats).`
    : `Seat allocation mismatch: confirmation states ${extracted.seats} seats but contract specifies ${expected.seats} seats.`;

  checks.push({
    field: "seats",
    name: "User Seats Allocation",
    expected: expected.seats,
    actual: extracted.seats,
    passed: seatsPassed,
    message: seatsMsg,
  });

  if (!seatsPassed) discrepancies.push(seatsMsg);

  // 3. Term Months Check (standard 12-month commitment)
  const termPassed = extracted.term_months === expectedTermMonths;
  const termMsg = termPassed
    ? `Confirmed term length matches 12-month annual commitment.`
    : `Term duration mismatch: confirmation states ${extracted.term_months} months instead of expected ${expectedTermMonths} months.`;

  checks.push({
    field: "term_months",
    name: "Contract Term Duration",
    expected: expectedTermMonths,
    actual: extracted.term_months,
    passed: termPassed,
    message: termMsg,
  });

  if (!termPassed) discrepancies.push(termMsg);

  // 4. Renewal Date Check (normalized YYYY-MM-DD comparison)
  const normalizeDate = (d: string) => {
    try {
      return new Date(d).toISOString().split("T")[0];
    } catch {
      return d;
    }
  };

  const normExtractedDate = normalizeDate(extracted.renewal_date);
  const normExpectedDate = normalizeDate(expected.renewalDate);
  const datePassed = normExtractedDate === normExpectedDate;
  const dateMsg = datePassed
    ? `Confirmed renewal date matches contract schedule (${normExpectedDate}).`
    : `Renewal date mismatch: confirmation states ${normExtractedDate} but contract schedule is ${normExpectedDate}.`;

  checks.push({
    field: "renewal_date",
    name: "Renewal Effective Date",
    expected: normExpectedDate,
    actual: normExtractedDate,
    passed: datePassed,
    message: dateMsg,
  });

  if (!datePassed) discrepancies.push(dateMsg);

  const allPassed = checks.every((c) => c.passed);

  return {
    allPassed,
    checks,
    discrepancies,
    extracted,
    expected,
    verifiedAt: new Date().toISOString(),
  };
}

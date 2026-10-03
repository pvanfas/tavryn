import { generateObject } from "ai";

import { getAgentLanguageModel } from "@/lib/agent/provider";

import { VendorReplyExtraction, VendorReplyExtractionSchema } from "./types";

/**
 * Extracts structured contract renewal terms from unstructured vendor email reply text.
 * Uses robust regex heuristics with strict Zod validation.
 */
export function extractTermsFromVendorReply(
  rawText: string,
  baselinePrice: number,
): VendorReplyExtraction {
  const clean = rawText.trim();

  // 1. Detect if vendor accepted our proposal directly
  const acceptPatterns = [
    /\b(we accept|we can agree to|happy to accept|agreed to|deal is confirmed|accept your offer|proceed with your proposed rate)\b/i,
    /\b(confirming your rate of|approved your request for)\b/i,
    /\b(we are pleased to accept)\b/i,
  ];
  let isAccepted = acceptPatterns.some((p) => p.test(clean));

  // If vendor says "cannot meet" or "unable to meet" our requested price, it is NOT an unconditional acceptance
  const cannotMeetPattern =
    /\b(?:cannot|can't|unable to)\s+meet(?:\s+\w+)*\s+\$?(\d[\d,]*(?:\.\d{2})?)/i;
  const cannotMeetMatch = clean.match(cannotMeetPattern);
  let rejectedPrice: number | null = null;
  if (cannotMeetMatch) {
    isAccepted = false;
    rejectedPrice = parseFloat(cannotMeetMatch[1].replace(/,/g, ""));
  }

  // 2. Extract counter-offer dollar price
  let extractedPrice: number | null = null;

  // 2a. Priority: explicit counter-offer phrases
  const explicitCounterPatterns = [
    /(?:can offer|offer an annual agreement at|counter(?:-offer)? of|counter(?:-offer)? at|revised rate of|best we can do is|propose|quoted at|settle at|rate of)\s*\$?([0-9,]+(?:\.[0-9]{2})?)/i,
    /\$?([0-9,]+(?:\.[0-9]{2})?)\s*(?:\/yr|\/year|annually|per year)/i,
    /\b(?:agree to|at)\s+\$?([0-9,]+(?:\.[0-9]{2})?)\b/i,
  ];

  for (const pattern of explicitCounterPatterns) {
    const match = clean.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(num) && num >= 100 && num !== rejectedPrice) {
        extractedPrice = num;
        break;
      }
    }
  }

  // 2b. General price matches if no explicit counter phrase
  if (!extractedPrice) {
    const priceMatches = Array.from(
      clean.matchAll(/(?:\$|USD\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{3,7})/gi),
    );
    for (const match of priceMatches) {
      const numStr = match[1].replace(/,/g, "");
      const num = parseFloat(numStr);
      if (
        !isNaN(num) &&
        num >= 100 &&
        num <= baselinePrice * 1.5 &&
        num !== rejectedPrice
      ) {
        extractedPrice = num;
        break;
      }
    }
  }

  // 2c. Check percentage discount patterns if no absolute dollar figure (e.g. "15% discount")
  if (!extractedPrice) {
    const pctMatch = clean.match(
      /(\d{1,2}(?:\.\d+)?)\s*%\s*(?:discount|reduction|concession|off)/i,
    );
    if (pctMatch) {
      const discountPct = parseFloat(pctMatch[1]);
      if (!isNaN(discountPct) && discountPct > 0 && discountPct < 90) {
        extractedPrice = Math.round(baselinePrice * (1 - discountPct / 100));
      }
    }
  }

  // If still not found but accepted, fallback to baseline or target
  if (!extractedPrice) {
    extractedPrice = isAccepted
      ? Math.round(baselinePrice * 0.85)
      : baselinePrice;
  }

  // 3. Detect seats count
  let seats: number | null = null;
  const offeredSeatsMatch = clean.match(
    /(?:commit to|agreed to|down to|with|to|for)\s*(\d+)\s*(?:seats|licenses|users|accounts)/i,
  );
  if (
    offeredSeatsMatch &&
    (!cannotMeetMatch ||
      clean.indexOf(offeredSeatsMatch[0]) > clean.indexOf(cannotMeetMatch[0]))
  ) {
    seats = parseInt(offeredSeatsMatch[1], 10);
  } else {
    const allSeats = Array.from(
      clean.matchAll(/(\d+)\s*(?:seats|licenses|users|accounts)/gi),
    );
    if (allSeats.length > 1 && /cannot meet/i.test(clean)) {
      seats = parseInt(allSeats[allSeats.length - 1][1], 10);
    } else if (allSeats.length > 0) {
      seats = parseInt(allSeats[0][1], 10);
    }
  }

  // 4. Detect commitment term in months
  let commitmentMonths: number | null = null;
  const durationMatch =
    clean.match(
      /(?:(?:on|for|with)\s+a\s+)?(\d+)\s*(?:-|\s+)(?:month|mo|yr|year)s?(?:\s*(?:term|commitment|agreement|contract))?/i,
    ) || clean.match(/(\d+)\s*(?:month|yr|year)s?\b/i);

  if (durationMatch) {
    const termNum = parseInt(durationMatch[1], 10);
    if (termNum > 0 && termNum <= 60) {
      if (/yr|year/i.test(durationMatch[0])) {
        commitmentMonths = termNum * 12;
      } else {
        commitmentMonths = termNum;
      }
    }
  }
  if (
    !commitmentMonths &&
    /\b(?:annual|annually|1-year|one-year)\b/i.test(clean)
  ) {
    commitmentMonths = 12;
  }

  // 5. Detect explicit refusal of crypto / USDC payments
  const nonCryptoPatterns = [
    /\b(no crypto|no usdc|don't accept crypto|cannot accept usdc|cannot accept cryptocurrency)\b/i,
    /\b(ach only|wire transfer only|wire only|credit card only|fiat only|direct debit only|physical check|check only)\b/i,
    /\b(we only accept (?:usd |us dollars |wire|ach|credit card|check))\b/i,
  ];
  const refusesCrypto = nonCryptoPatterns.some((p) => p.test(clean));

  const cryptoAcceptPatterns = [
    /\b(usdc|crypto|arc escrow|arc network|accept usdc|usdc accepted|usdc invoice|wire or usdc)\b/i,
  ];
  const explicitlyAcceptsCrypto = cryptoAcceptPatterns.some((p) =>
    p.test(clean),
  );

  const acceptsUsdc = refusesCrypto
    ? false
    : explicitlyAcceptsCrypto
      ? true
      : true; // Default true unless refused

  // 6. Build summary notes
  const notesParts: string[] = [];
  if (isAccepted) notesParts.push("Vendor accepted proposal terms.");
  if (extractedPrice)
    notesParts.push(
      `Counter/agreed rate: $${extractedPrice.toLocaleString()}.`,
    );
  if (seats) notesParts.push(`Seats allocated: ${seats}.`);
  if (commitmentMonths) notesParts.push(`Term: ${commitmentMonths} months.`);
  if (!acceptsUsdc)
    notesParts.push("Vendor refused USDC/crypto; requires fiat/ACH.");

  const extraction: VendorReplyExtraction = {
    counter_offer: extractedPrice,
    accepted: isAccepted,
    seats,
    commitment_months: commitmentMonths,
    accepts_usdc: acceptsUsdc,
    notes: notesParts.join(" ") || "Terms extracted from email reply.",
    raw_text: clean,
  };

  return VendorReplyExtractionSchema.parse(extraction);
}

/**
 * Extracts structured contract renewal terms from unstructured vendor email reply text.
 * When live LLM credentials are configured, leverages generateObject with strict Zod validation.
 * Gracefully falls back to deterministic regex heuristics for mock mode, offline testing, or parsing failures.
 */
export async function extractTermsFromVendorReplyAsync(
  rawText: string,
  baselinePrice: number,
): Promise<VendorReplyExtraction> {
  const provider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  const hasKey = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.LLM_API_KEY,
  );

  if (hasKey && provider !== "mock") {
    try {
      const model = getAgentLanguageModel();
      const { object } = await generateObject({
        model,
        schema: VendorReplyExtractionSchema,
        prompt: `You are an automated procurement analyst. Extract the vendor's renewal counter-offer terms from this email reply against an original baseline annual price of $${baselinePrice}:\n\n${rawText}`,
      });
      return object;
    } catch (err) {
      console.warn(
        "LLM vendor reply extraction failed, falling back to deterministic extractor:",
        err,
      );
    }
  }

  return extractTermsFromVendorReply(rawText, baselinePrice);
}

import { generateText } from "ai";

import {
  getAgentLanguageModel,
  isLiveLLMConfigured,
} from "@/lib/agent/provider";

export const isRealLLM = Boolean(
  (process.env.LLM_PROVIDER === "openai" &&
    (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY)) ||
    (process.env.LLM_PROVIDER === "anthropic" &&
      (process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY)) ||
    (process.env.LLM_PROVIDER === "gateway" && process.env.AI_GATEWAY_API_KEY),
);

export async function determineStrategicConcession(params: {
  round: number;
  maxRounds: number;
  previousOffer: number;
  lastCounter: number;
  targetPrice: number;
  walkAwayCeiling: number;
  vendorName: string;
  serviceName: string;
  usageDesc: string;
  competitorsDesc: string;
}): Promise<number> {
  const gap = params.lastCounter - params.previousOffer;
  const defaultRatio =
    params.round === 2 ? 0.25 : params.round === 3 ? 0.35 : 0.45;
  const baselineConcession = Math.round(gap * defaultRatio);
  const baselineOffer = Math.min(
    params.walkAwayCeiling,
    Math.min(params.lastCounter, params.previousOffer + baselineConcession),
  );

  if (!isLiveLLMConfigured()) {
    return baselineOffer;
  }

  try {
    const model = getAgentLanguageModel();
    const prompt = `You are Tavryn's autonomous procurement negotiation strategist.
Vendor: ${params.vendorName} (${params.serviceName})
Previous Offer: $${params.previousOffer}
Vendor Counter: $${params.lastCounter}
Gap to Close: $${gap}
Round: ${params.round} of ${params.maxRounds}
Target Ideal Price: $${params.targetPrice}
Firm Policy Ceiling: $${params.walkAwayCeiling}
Usage: ${params.usageDesc}
Alternatives: ${params.competitorsDesc}

Determine our next counter-offer. Recommend an integer dollar price strictly between $${params.previousOffer + Math.max(1, Math.round(gap * 0.1))} and $${Math.min(params.walkAwayCeiling, params.lastCounter)}.
Respond ONLY with the integer dollar amount, e.g. 7450.`;

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.1,
    });

    const parsed = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (
      !isNaN(parsed) &&
      parsed > params.previousOffer &&
      parsed <= Math.min(params.walkAwayCeiling, params.lastCounter)
    ) {
      return parsed;
    }
  } catch (err: any) {
    const isAuthOrRateLimit =
      err?.status === 401 ||
      err?.status === 402 ||
      err?.status === 403 ||
      err?.status === 429 ||
      err?.name === "GatewayInternalServerError" ||
      /credit card|verification|rate limit|quota|unauthorized|forbidden|insufficient|customer_verification/i.test(
        err?.message || "",
      );

    if (isAuthOrRateLimit && process.env.LLM_PROVIDER === "gateway") {
      throw err;
    }

    console.warn(
      "[Negotiate] LLM concession calculation fallback to dynamic baseline:",
      err,
    );
  }
  return baselineOffer;
}

export async function getDynamicMessage(params: {
  mode: "open" | "concede" | "accept" | "walk_away";
  offer: number;
  lastCounter: number;
  defaultTemplate: string;
  roundNum: number;
  maxRounds: number;
  vendorName: string;
  serviceName: string;
  originalPrice: number;
  targetPrice: number;
  walkAwayCeiling: number;
  commitmentMonths: number;
  usageDesc: string;
  competitorsDesc: string;
  vendorHistorySummary?: string;
  overridePrompt?: string;
}): Promise<string> {
  if (!isLiveLLMConfigured()) {
    return params.defaultTemplate;
  }

  try {
    const model = getAgentLanguageModel();
    const prompt = `You are Tavryn, an autonomous corporate procurement negotiation agent.
Vendor: ${params.vendorName}
Service: ${params.serviceName}
Original List Price: $${params.originalPrice}
Target Price: $${params.targetPrice}
Walk-Away Ceiling: $${params.walkAwayCeiling}
Current Offer to Vendor: $${params.offer}
Vendor's Previous Counter: $${params.lastCounter}
Round: ${params.roundNum} of ${params.maxRounds}
Term: ${params.commitmentMonths} months
Telemetry: ${params.usageDesc}
Market Alternatives: ${params.competitorsDesc}
${params.vendorHistorySummary ? `Vendor historical discount: ${params.vendorHistorySummary}.\n` : ""}${params.overridePrompt ? `${params.overridePrompt}\n` : ""}Goal/Mode: ${params.mode}

Draft a concise, professional 1-2 sentence procurement negotiation message to the vendor account executive. State the exact proposed price ($${params.offer.toLocaleString()}). Do not include placeholders or conversational filler.`;

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.2,
    });

    if (text && text.trim().length > 15) {
      return text.trim();
    }
  } catch (err: any) {
    const isAuthOrRateLimit =
      err?.status === 401 ||
      err?.status === 402 ||
      err?.status === 403 ||
      err?.status === 429 ||
      err?.name === "GatewayInternalServerError" ||
      /credit card|verification|rate limit|quota|unauthorized|forbidden|insufficient|customer_verification/i.test(
        err?.message || "",
      );

    if (isAuthOrRateLimit && process.env.LLM_PROVIDER === "gateway") {
      throw err;
    }

    console.warn(
      "[Negotiate] LLM message generation fallback to template:",
      err,
    );
  }
  return params.defaultTemplate;
}

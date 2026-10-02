import { z } from "zod";

import { runNegotiationLoop } from "@/lib/agent/negotiate";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { get_vendor_history } from "@/lib/memory";
import { checkRateLimit } from "@/lib/rate-limit";
import { get_contract, get_negotiation_status } from "@/lib/tools";

interface RouteProps {
  params: Promise<{ contractId: string }>;
}

const paramSchema = z.object({
  contractId: z.string().uuid({ message: "Invalid contract UUID parameter" }),
});

const negotiateBodySchema = z.object({
  maxRounds: z.number().int().min(1).max(20).optional(),
  walkAwayCeiling: z.number().positive().optional(),
  targetPrice: z.number().positive().optional(),
});

export async function GET(req: Request, { params }: RouteProps) {
  try {
    const rawParams = await params;
    const parsedParams = paramSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return apiError(
        "Invalid route parameter",
        400,
        parsedParams.error.issues,
      );
    }

    const { contractId } = parsedParams.data;

    const status = (await (get_negotiation_status as any).execute(
      { contractId },
      { messages: [], toolCallId: `call-status-${Date.now()}` },
    )) as { exists: boolean; negotiation: any };

    let contract = null;
    let memory = null;
    try {
      contract = await (get_contract as any).execute(
        { contractId },
        { messages: [], toolCallId: `call-contract-${Date.now()}` },
      );
      if (contract?.vendor?.id) {
        memory = await get_vendor_history(
          contract.vendor.id,
          contract.business_id,
        );
      }
    } catch (e) {
      logger.warn(
        "Could not retrieve contract or vendor memory for route GET",
        e,
      );
    }

    return apiSuccess({
      exists: status.exists,
      negotiation: status.negotiation,
      contract,
      memory,
      vendor_memory: memory,
    });
  } catch (err) {
    logger.error("GET negotiate error", err);
    return handleApiError(err, "Failed to retrieve negotiation status");
  }
}

export async function POST(req: Request, { params }: RouteProps) {
  try {
    const rawParams = await params;
    const parsedParams = paramSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return apiError(
        "Invalid route parameter",
        400,
        parsedParams.error.issues,
      );
    }

    const { contractId } = parsedParams.data;

    // Rate limit: 20 per minute per contract
    const rate = checkRateLimit(`negotiate_${contractId}`, 20, 60_000);
    if (!rate.success) {
      return apiError(
        "Negotiation rate limit exceeded for this contract",
        429,
        {
          resetMs: rate.resetMs,
        },
      );
    }

    let rawBody = {};
    const text = await req.text();
    if (text && text.trim() !== "") {
      try {
        rawBody = JSON.parse(text);
      } catch {
        return apiError("Malformed JSON body in request", 400);
      }
    }

    const parsedBody = negotiateBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return apiError("Invalid request body", 400, parsedBody.error.issues);
    }

    const { maxRounds, walkAwayCeiling, targetPrice } = parsedBody.data;

    const result = await runNegotiationLoop(contractId, {
      maxRounds,
      walkAwayCeiling,
      targetPrice,
    });

    return apiSuccess({ result });
  } catch (err) {
    logger.error("Negotiation loop error", err);
    return handleApiError(err, "Negotiation execution failed");
  }
}

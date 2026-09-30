import { NextRequest } from "next/server";
import { z } from "zod";

import { recordSavingsWithoutPayment } from "@/lib/agent/real-vendor";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteProps {
  params: Promise<{ contractId: string }>;
}

const paramSchema = z.object({
  contractId: z.string().uuid({ message: "Invalid contract UUID parameter" }),
});

const bodySchema = z.object({
  negotiationId: z.string().uuid({ message: "Invalid negotiation UUID" }),
  finalPrice: z.number().positive(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: RouteProps) {
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

    const rate = checkRateLimit(`record_savings_${contractId}`, 20, 60_000);
    if (!rate.success) {
      return apiError("Rate limit exceeded", 429);
    }

    const json = await req.json().catch(() => null);
    const parsedBody = bodySchema.safeParse(json);
    if (!parsedBody.success) {
      return apiError("Invalid request body", 400, parsedBody.error.issues);
    }

    const { negotiationId, finalPrice, reason } = parsedBody.data;

    const result = await recordSavingsWithoutPayment({
      contractId,
      negotiationId,
      finalPrice,
      reason,
    });

    return apiSuccess({
      result,
    });
  } catch (error) {
    return handleApiError(error, "Failed to record off-chain savings");
  }
}

import { z } from "zod";

import { runAgentAnalysis } from "@/lib/agent/run";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteProps {
  params: Promise<{ contractId: string }>;
}

const paramSchema = z.object({
  contractId: z.string().uuid({ message: "Invalid contract UUID parameter" }),
});

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

    // Rate limit per contractId: 20 per minute
    const rate = checkRateLimit(`analyze_${contractId}`, 20, 60_000);
    if (!rate.success) {
      return apiError("Analysis rate limit exceeded for this contract", 429, {
        resetMs: rate.resetMs,
      });
    }

    const analysis = await runAgentAnalysis(contractId);

    return apiSuccess({ analysis });
  } catch (err) {
    logger.error("Agent analysis route error", err);
    return handleApiError(err, "Agent analysis failed");
  }
}

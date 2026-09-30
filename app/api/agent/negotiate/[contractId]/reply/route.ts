import { NextRequest } from "next/server";
import { z } from "zod";

import { processVendorReply } from "@/lib/agent/real-vendor";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteProps {
  params: Promise<{ contractId: string }>;
}

const paramSchema = z.object({
  contractId: z.string().uuid({ message: "Invalid contract UUID parameter" }),
});

const replyBodySchema = z.object({
  rawReply: z.string().min(1, "Vendor reply text cannot be empty"),
  acceptsUsdcOverride: z.boolean().optional(),
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

    // Rate limit: 20 per minute
    const rate = checkRateLimit(`vendor_reply_${contractId}`, 20, 60_000);
    if (!rate.success) {
      return apiError("Rate limit exceeded for vendor reply ingestion", 429);
    }

    const json = await req.json().catch(() => null);
    const parsedBody = replyBodySchema.safeParse(json);
    if (!parsedBody.success) {
      return apiError("Invalid request body", 400, parsedBody.error.issues);
    }

    const { rawReply, acceptsUsdcOverride } = parsedBody.data;

    const result = await processVendorReply({
      contractId,
      rawReply,
      acceptsUsdcOverride,
    });

    return apiSuccess({
      result,
    });
  } catch (error) {
    return handleApiError(error, "Failed to process vendor reply");
  }
}

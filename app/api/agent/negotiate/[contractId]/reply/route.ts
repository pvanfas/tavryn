import { NextRequest } from "next/server";
import { z } from "zod";

import { processVendorReply } from "@/lib/agent/real-vendor";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireContractAccess } from "@/lib/auth-guard";
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

    const authCheck = await requireContractAccess(req, contractId);
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
    }

    // Rate limit: 20 per minute
    const rate = checkRateLimit(`vendor_reply_${contractId}`, 20, 60_000);
    if (!rate.success) {
      return apiError("Rate limit exceeded for vendor reply ingestion", 429);
    }

    let rawReply = "";
    let acceptsUsdcOverride: boolean | undefined = undefined;

    const contentType = req.headers.get("content-type") || "";
    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await req.formData();
      rawReply =
        (formData.get("text") as string) ||
        (formData.get("body") as string) ||
        (formData.get("html") as string) ||
        (formData.get("rawReply") as string) ||
        "";
    } else {
      const json = await req.json().catch(() => null);
      if (json) {
        rawReply =
          json.rawReply || json.text || json.body || json.message || "";
        acceptsUsdcOverride = json.acceptsUsdcOverride;
      }
    }

    if (!rawReply || rawReply.trim().length === 0) {
      return apiError(
        "Vendor reply text cannot be empty (provide rawReply, text, or body)",
        400,
      );
    }

    const result = await processVendorReply({
      contractId,
      rawReply: rawReply.trim(),
      acceptsUsdcOverride,
    });

    return apiSuccess({
      result,
    });
  } catch (error) {
    return handleApiError(error, "Failed to process vendor reply");
  }
}

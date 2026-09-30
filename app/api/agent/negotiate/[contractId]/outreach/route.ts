import { NextRequest } from "next/server";
import { z } from "zod";

import { draftVendorOutreachEmail } from "@/lib/agent/real-vendor";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteProps {
  params: Promise<{ contractId: string }>;
}

const paramSchema = z.object({
  contractId: z.string().uuid({ message: "Invalid contract UUID parameter" }),
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
    const rate = checkRateLimit(`draft_outreach_${contractId}`, 20, 60_000);
    if (!rate.success) {
      return apiError("Rate limit exceeded for drafting outreach", 429);
    }

    const draft = await draftVendorOutreachEmail(contractId);

    return apiSuccess({
      draft,
    });
  } catch (error) {
    return handleApiError(error, "Failed to draft vendor outreach email");
  }
}

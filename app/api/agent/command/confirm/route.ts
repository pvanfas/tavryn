import { z } from "zod";

import { executeConfirmedAction } from "@/lib/agent/command";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ConfirmActionSchema = z.object({
  action: z.enum(["start_negotiation", "request_approval", "create_receipt"]),
  businessId: z.string().uuid().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body", 400);
    }

    const validation = ConfirmActionSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError(
        "Invalid action confirmation payload",
        400,
        validation.error.format(),
      );
    }

    const { action, params, businessId: requestedBusinessId } = validation.data;

    let businessId: string = requestedBusinessId || "";
    if (!businessId) {
      const supabase = getServiceSupabase();
      const { data: firstB } = await supabase
        .from("businesses")
        .select("id")
        .limit(1)
        .maybeSingle();
      businessId = firstB?.id || "b655fb94-fc62-4e3c-8898-2c5f88068159";
    }

    const executionResult = await executeConfirmedAction(
      businessId,
      action,
      params,
    );

    return apiSuccess({
      action,
      success: executionResult.success,
      message: executionResult.message,
      data: executionResult.data,
    });
  } catch (err) {
    return handleApiError(err, "Failed to execute confirmed action");
  }
}

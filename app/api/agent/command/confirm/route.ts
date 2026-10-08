import { z } from "zod";

import { executeConfirmedAction } from "@/lib/agent/command";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { getAuthUser, requireBusinessAccess } from "@/lib/auth-guard";
import { DEMO_BUSINESS_ID } from "@/lib/constants";
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
    const supabase = getServiceSupabase();
    let businessId: string = "";

    if (requestedBusinessId) {
      const authCheck = await requireBusinessAccess(req, requestedBusinessId);
      if (!authCheck.authorized) {
        return apiError(authCheck.error, authCheck.status);
      }
      businessId = requestedBusinessId;
    } else {
      const user = await getAuthUser(req);
      if (user && !user.isDemo) {
        const { data: member } = await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", user.userId)
          .limit(1)
          .maybeSingle();
        businessId = member?.business_id || DEMO_BUSINESS_ID;
      } else {
        businessId = DEMO_BUSINESS_ID;
      }
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

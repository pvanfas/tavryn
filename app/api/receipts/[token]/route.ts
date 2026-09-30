import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublicReceipt, updateReceipt } from "@/lib/receipt";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const UpdateReceiptSchema = z.object({
  businessId: z.string().uuid().optional(),
  revoke: z.boolean().optional(),
  showBusinessName: z.boolean().optional(),
  showVendorName: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    // Rate limiting: 60 requests per minute per IP
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "anonymous";
    const rl = checkRateLimit(`receipt_public:${ip}`, 60, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          },
        },
      );
    }

    const receipt = await getPublicReceipt(token);
    if (!receipt) {
      // Generic 404 for both non-existent and revoked tokens to prevent token enumeration
      return apiError("Receipt not found or has been revoked.", 404);
    }

    return NextResponse.json(receipt, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Malformed JSON body", 400);
    }

    const parseResult = UpdateReceiptSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "Invalid update parameters",
        400,
        parseResult.error.format(),
      );
    }

    const {
      businessId: reqBizId,
      revoke,
      showBusinessName,
      showVendorName,
    } = parseResult.data;

    const supabase = getServiceSupabase();

    // Verify token exists and retrieve businessId
    const { data: receiptRecord, error: rErr } = await supabase
      .from("receipts")
      .select("id, business_id, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (rErr || !receiptRecord) {
      return apiError("Receipt not found", 404);
    }

    const businessId = reqBizId || receiptRecord.business_id;

    await updateReceipt({
      token,
      businessId,
      revoke,
      showBusinessName,
      showVendorName,
    });

    return apiSuccess({
      message: revoke
        ? "Receipt revoked successfully. Public access disabled."
        : "Receipt visibility updated successfully.",
      revoked: Boolean(revoke),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

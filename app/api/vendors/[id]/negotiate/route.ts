import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";
import {
  getVendorSimulatorConfig,
  simulateVendorNegotiation,
} from "@/lib/vendor-simulator";

const ParamSchema = z.object({
  id: z.string().min(1, "Vendor ID is required"),
});

const NegotiateBodySchema = z.object({
  contract_id: z.string().uuid("contract_id must be a valid UUID"),
  offer: z.coerce.number().positive("offer must be a positive number"),
  commitment_months: z.coerce.number().int().positive().default(12),
  round: z.coerce.number().int().positive().default(1),
});

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteProps) {
  try {
    const rawParams = await params;
    const parsedParams = ParamSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return apiError(
        "Invalid vendor route parameter",
        400,
        parsedParams.error.issues,
      );
    }
    const { id: vendorId } = parsedParams.data;

    let rawBody = {};
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body in request", 400);
    }

    const parsed = NegotiateBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError("Invalid negotiation payload", 400, parsed.error.issues);
    }

    const { contract_id, offer, commitment_months, round } = parsed.data;
    const supabase = getServiceSupabase();

    // 1. Fetch Contract & Vendor
    const { data: contract, error: contractErr } = await supabase
      .from("contracts")
      .select("*, vendors(*)")
      .eq("id", contract_id)
      .maybeSingle();

    if (contractErr || !contract) {
      return apiError(`Contract ${contract_id} not found`, 404);
    }

    const vendor = contract.vendors;
    const vendorName = vendor?.name || "Vendor";
    const vendorCategory = vendor?.category || contract.category || "software";

    // 2. Fetch existing negotiation state to find previous counter offer
    const { data: existingNeg } = await supabase
      .from("negotiations")
      .select("current_offer, original_price")
      .eq("contract_id", contract_id)
      .maybeSingle();

    const originalPrice = Number(
      existingNeg?.original_price ?? contract.current_price,
    );
    const previousCounter = existingNeg?.current_offer
      ? Number(existingNeg.current_offer)
      : originalPrice;

    // 3. Configure Vendor Simulator (with hidden floor & personality style)
    const vendorConfig = getVendorSimulatorConfig(
      vendorId || vendor?.id || "default-vendor",
      vendorName,
      vendorCategory,
    );

    // 4. Simulate Negotiation Turn
    const response = simulateVendorNegotiation(
      {
        contract_id,
        offer,
        commitment_months,
        round,
        original_price: originalPrice,
        previous_counter: previousCounter,
      },
      vendorConfig,
    );

    // Return counter offer, message, accepted. Never leak the floor!
    return apiSuccess({
      counter_offer: response.counter_offer,
      message: response.message,
      accepted: response.accepted,
    });
  } catch (err) {
    logger.error("Vendor negotiation API error", err);
    return handleApiError(err, "Internal negotiation error");
  }
}

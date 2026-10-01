import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

export const dynamic = "force-dynamic";

const CreateContractSchema = z.object({
  businessId: z.string().uuid(),
  vendor: z.string().min(1),
  service: z.string().min(1),
  category: z.enum(["software", "cloud", "contractors"]).default("software"),
  currentPrice: z.number().positive(),
  renewalDate: z.string(),
  seatCount: z.number().nullable().optional(),
  activeSeats: z.number().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const validation = CreateContractSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.format());
    }

    const data = validation.data;
    const supabase = getServiceSupabase();

    // 1. Resolve or create vendor
    let vendorId: string | null = null;
    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id")
      .ilike("name", data.vendor.trim())
      .maybeSingle();

    if (existingVendor) {
      vendorId = existingVendor.id;
    } else {
      const { data: newVendor } = await supabase
        .from("vendors")
        .insert({
          name: data.vendor.trim(),
          category: data.category,
          is_simulated: false,
          reputation_score: 4.8,
          contact: `procurement@${data.vendor.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        })
        .select("id")
        .single();
      if (newVendor) vendorId = newVendor.id;
    }

    // 2. Insert contract
    const { data: contract, error } = await supabase
      .from("contracts")
      .insert({
        business_id: data.businessId,
        vendor_id: vendorId,
        service: data.service.trim(),
        category: data.category,
        current_price: data.currentPrice,
        renewal_date: new Date(data.renewalDate).toISOString(),
        seat_count: data.seatCount ?? null,
        active_seats: data.activeSeats ?? null,
        status: "active",
      })
      .select("*, vendors(*)")
      .single();

    if (error) {
      return apiError(`Failed to insert contract: ${error.message}`, 500);
    }

    // 3. Log agent action
    await logAgentAction({
      businessId: data.businessId,
      action: "contract_created_from_invoice",
      reason: `Direct PDF/Invoice ingestion: Created contract '${data.service}' for $${data.currentPrice.toLocaleString()}/yr`,
      confidence: 1.0,
      input: data,
      result: { contractId: contract.id, vendor: data.vendor },
    });

    return apiSuccess({
      success: true,
      contract,
    });
  } catch (err) {
    return handleApiError(err, "Failed to create contract");
  }
}

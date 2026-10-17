import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireBusinessAccess } from "@/lib/auth-guard";
import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

export const dynamic = "force-dynamic";

const SubscriptionItemSchema = z.object({
  vendor: z.string().min(1),
  service: z.string().min(1),
  category: z.enum(["software", "cloud", "contractors"]).default("software"),
  annual_price: z.number().positive(),
  renewal_date: z.string(),
  seats: z.number().nullable().optional(),
  active_seats: z.number().nullable().optional(),
  usage_decline_pct: z.number().nullable().optional(),
});

const ImportCommitPayloadSchema = z.object({
  businessId: z.string().uuid(),
  subscriptions: z.array(SubscriptionItemSchema).min(1),
});

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body in request", 400);
    }

    const validation = ImportCommitPayloadSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.format());
    }

    const { businessId, subscriptions } = validation.data;

    // Check authorization for business
    const authCheck = await requireBusinessAccess(req, businessId);
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
    }

    const supabase = getServiceSupabase();

    // Verify business exists
    const { data: business, error: bError } = await supabase
      .from("businesses")
      .select("id, name, wallet_address, treasury_balance, default_currency")
      .eq("id", businessId)
      .single();

    if (bError || !business) {
      return apiError("Business not found", 404);
    }

    // 1. Resolve or create vendors
    let totalSpend = 0;
    const vendorMap = new Map<string, string>();
    const uniqueVendors = Array.from(
      new Set(subscriptions.map((s) => s.vendor.trim())),
    );

    for (const vendorName of uniqueVendors) {
      const { data: existingVendor } = await supabase
        .from("vendors")
        .select("id")
        .ilike("name", vendorName)
        .maybeSingle();

      if (existingVendor) {
        vendorMap.set(vendorName.toLowerCase(), existingVendor.id);
      } else {
        const sampleSub = subscriptions.find(
          (s) => s.vendor.trim().toLowerCase() === vendorName.toLowerCase(),
        );
        const { data: newVendor, error: vendorError } = await supabase
          .from("vendors")
          .insert({
            name: vendorName,
            category: sampleSub?.category || "software",
            is_simulated: false,
            reputation_score: 4.8,
            contact: `procurement@${vendorName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          })
          .select("id")
          .single();

        if (vendorError || !newVendor) {
          logger.error("Failed to insert vendor", vendorError);
        } else {
          vendorMap.set(vendorName.toLowerCase(), newVendor.id);
        }
      }
    }

    // 2. Insert Contracts
    const contractsPayload = subscriptions.map((sub) => {
      totalSpend += sub.annual_price;
      const vendorId = vendorMap.get(sub.vendor.trim().toLowerCase()) || null;
      return {
        business_id: business.id,
        vendor_id: vendorId,
        service: sub.service,
        category: sub.category,
        current_price: sub.annual_price,
        renewal_date: new Date(sub.renewal_date).toISOString(),
        seat_count: sub.seats ?? null,
        active_seats: sub.active_seats ?? null,
        usage_metric:
          sub.usage_decline_pct != null
            ? { type: "usage_decline", decline_pct: sub.usage_decline_pct }
            : null,
        status: "active",
      };
    });

    const { error: contractsError } = await supabase
      .from("contracts")
      .insert(contractsPayload);

    if (contractsError) {
      logger.error("Failed to insert contracts", contractsError);
      return apiError(`Database error: ${contractsError.message}`, 500);
    }

    // 3. Log agent action audit trail
    await logAgentAction({
      businessId: business.id,
      action: "contracts_imported",
      reason: `Directly imported ${contractsPayload.length} contracts for '${business.name}' with $${totalSpend.toLocaleString()} total annual spend`,
      confidence: 1.0,
      input: {
        business_id: business.id,
        business_name: business.name,
        contracts_count: contractsPayload.length,
        total_annual_spend: totalSpend,
      },
      result: {
        success: true,
        business_id: business.id,
        contracts_created: contractsPayload.length,
        vendors_count: vendorMap.size,
      },
    });

    return apiSuccess({
      businessId: business.id,
      businessName: business.name,
      walletAddress: business.wallet_address,
      contractsCount: contractsPayload.length,
      totalSpend,
    });
  } catch (err) {
    logger.error("Failed to commit imported contracts", err);
    return apiError(
      (err as Error).message || "Failed to commit imported contracts",
      500,
    );
  }
}

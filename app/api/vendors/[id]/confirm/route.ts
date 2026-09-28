import { NextRequest } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const ParamSchema = z.object({
  id: z.string().min(1, "Vendor ID is required"),
});

const ConfirmBodySchema = z.object({
  contractId: z.string().uuid().optional(),
});

const QuerySchema = z.object({
  tamper: z.enum(["seats", "price"]).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rawParams = await params;
    const parsedParams = ParamSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return apiError("Invalid route parameter", 400, parsedParams.error.issues);
    }
    const { id: vendorId } = parsedParams.data;

    const url = new URL(req.url);
    const parsedQuery = QuerySchema.safeParse({
      tamper: url.searchParams.get("tamper") || undefined,
    });
    if (!parsedQuery.success) {
      return apiError("Invalid query parameters", 400, parsedQuery.error.issues);
    }
    const tamper = parsedQuery.data.tamper;

    let rawBody = {};
    const text = await req.text();
    if (text && text.trim() !== "") {
      try {
        rawBody = JSON.parse(text);
      } catch {
        return apiError("Malformed JSON body in request", 400);
      }
    }

    const parsedBody = ConfirmBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return apiError("Invalid request body", 400, parsedBody.error.issues);
    }

    const supabase = getServiceSupabase();

    // 1. Fetch vendor details
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, name, category, contact")
      .eq("id", vendorId)
      .maybeSingle();

    const vendorName = vendor?.name || "Enterprise Vendor";

    // 2. Fetch associated contract & negotiation
    let contractQuery = supabase.from("contracts").select("*");
    if (parsedBody.data.contractId) {
      contractQuery = contractQuery.eq("id", parsedBody.data.contractId);
    } else {
      contractQuery = contractQuery.eq("vendor_id", vendorId);
    }

    const { data: contracts } = await contractQuery.limit(1);
    const contract = contracts?.[0] || null;

    let finalPrice = contract ? Number(contract.current_price) * 0.8 : 9600;
    const seats = contract?.seat_count || 18;
    const termMonths = 12;
    const renewalDate = contract?.renewal_date
      ? new Date(contract.renewal_date).toISOString().split("T")[0]
      : "2026-10-15";

    if (contract?.id) {
      const { data: negotiation } = await supabase
        .from("negotiations")
        .select("final_price, target_price, current_offer")
        .eq("contract_id", contract.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (negotiation?.final_price) {
        finalPrice = Number(negotiation.final_price);
      } else if (negotiation?.target_price) {
        finalPrice = Number(negotiation.target_price);
      }
    }

    // 3. Apply Tamper logic if requested
    let confirmedPrice = finalPrice;
    let confirmedSeats = seats;

    if (tamper === "price") {
      // Tamper: inflate price by $1,800 above negotiated terms
      confirmedPrice = Math.round(finalPrice + 1800);
    } else if (tamper === "seats") {
      // Tamper: revert to unoptimized baseline seats (+5 seats)
      confirmedSeats = seats + 5;
    }

    const confirmationId = `CONF-${Math.random().toString(36).substring(2, 8).toUpperCase()}-2026`;
    const issuedAt = new Date().toISOString();

    // 4. Generate realistic enterprise order confirmation document
    const documentText = [
      `============================================================`,
      `ORDER CONFIRMATION & RENEWAL SCHEDULE`,
      `Confirmation Reference: ${confirmationId}`,
      `Vendor: ${vendorName}`,
      `Date Issued: ${issuedAt.split("T")[0]}`,
      `============================================================`,
      ``,
      `AGREEMENT SPECIFICATIONS:`,
      `• Annual Commitment Price: $${confirmedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
      `• Authorized User Seats: ${confirmedSeats} licensed accounts`,
      `• Contract Duration: ${termMonths} Months`,
      `• Effective Renewal Date: ${renewalDate}`,
      `• Settlement Escrow Asset: USDC (Arc Testnet)`,
      ``,
      `Payment instructions: Release escrow funds upon agreement verification.`,
      `============================================================`,
    ].join("\n");

    return apiSuccess({
      tampered: Boolean(tamper),
      tamperType: tamper || null,
      confirmation: {
        confirmation_id: confirmationId,
        vendor_id: vendorId,
        vendor_name: vendorName,
        contract_id: contract?.id || null,
        price: confirmedPrice,
        seats: confirmedSeats,
        term_months: termMonths,
        renewal_date: renewalDate,
        issued_at: issuedAt,
        status: "pending_payment",
      },
      document: documentText,
    });
  } catch (err: unknown) {
    logger.error("Vendor confirmation route error", err);
    return handleApiError(err, "Internal confirmation error");
  }
}

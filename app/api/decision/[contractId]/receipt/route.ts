import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { createReceipt, getReceiptsForContract } from "@/lib/receipt";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CreateReceiptSchema = z.object({
  transactionId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
  showBusinessName: z.boolean().optional(),
  showVendorName: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    const { contractId } = await params;
    const { searchParams } = new URL(req.url);
    let businessId = searchParams.get("businessId");

    const supabase = getServiceSupabase();
    if (!businessId) {
      const { data: contract } = await supabase
        .from("contracts")
        .select("business_id")
        .eq("id", contractId)
        .maybeSingle();

      businessId = contract?.business_id || null;
    }

    if (!businessId) {
      return apiError("Missing businessId for contract", 400);
    }

    const receipts = await getReceiptsForContract(contractId, businessId);
    return apiSuccess({ receipts });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    const { contractId } = await params;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed
    }

    const parseResult = CreateReceiptSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "Invalid receipt parameters",
        400,
        parseResult.error.format(),
      );
    }

    const {
      transactionId: reqTxId,
      businessId: reqBizId,
      showBusinessName,
      showVendorName,
    } = parseResult.data;

    const supabase = getServiceSupabase();

    // 1. Fetch contract
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, business_id, service")
      .eq("id", contractId)
      .maybeSingle();

    if (cErr || !contract) {
      return apiError(`Contract ${contractId} not found`, 404);
    }

    const businessId = reqBizId || contract.business_id;

    // 2. Identify completed transaction
    let transactionId = reqTxId;
    if (!transactionId) {
      const { data: tx, error: tErr } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("contract_id", contractId)
        .eq("business_id", businessId)
        .in("status", ["completed", "released"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tErr || !tx) {
        return apiError(
          "No completed transaction found for this contract. A receipt can only be created once escrow payment is released.",
          400,
        );
      }
      transactionId = tx.id;
    }

    if (!transactionId) {
      return apiError(
        "Valid transaction ID is required to generate receipt",
        400,
      );
    }

    // 3. Create the cryptographic receipt
    const receipt = await createReceipt({
      transactionId,
      businessId,
      createdBy: "owner",
      showBusinessName,
      showVendorName,
    });

    return apiSuccess(
      {
        message: `Public verified receipt generated for ${contract.service}.`,
        token: receipt.token,
        receiptUrl: receipt.receiptUrl,
      },
      201,
    );
  } catch (err) {
    return handleApiError(err);
  }
}

import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireContractAccess } from "@/lib/auth-guard";
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

    const authCheck = await requireContractAccess(req, contractId);
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
    }

    const businessId = authCheck.businessId;
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

    const authCheck = await requireContractAccess(req, contractId);
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
    }

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
      showBusinessName,
      showVendorName,
    } = parseResult.data;

    const businessId = authCheck.businessId;

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

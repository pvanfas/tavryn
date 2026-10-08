import { NextRequest } from "next/server";
import { z } from "zod";

import {
  ExpectedTerms,
  extractVendorConfirmation,
  VerificationResult,
  verifyConfirmationTerms,
} from "@/lib/agent/verification";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireContractAccess } from "@/lib/auth-guard";
import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";
import { dispute_escrow, release_escrow } from "@/lib/tools";

interface RouteProps {
  params: Promise<{ contractId: string }>;
}

const paramSchema = z.object({
  contractId: z.string().uuid({ message: "Invalid contract UUID parameter" }),
});

const verifyBodySchema = z.object({
  tamper: z.enum(["price", "seats"]).nullable().optional(),
  action: z.enum(["verify", "release"]).optional(),
});

export async function GET(req: NextRequest, { params }: RouteProps) {
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

    const authCheck = await requireContractAccess(req, contractId);
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
    }

    const contract = authCheck.contract;
    const supabase = getServiceSupabase();

    const { data: negotiation } = await supabase
      .from("negotiations")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Fetch existing transaction & approval
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let approval = null;
    if (negotiation?.id) {
      const { data: appRow } = await supabase
        .from("approvals")
        .select("*")
        .eq("negotiation_id", negotiation.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      approval = appRow;
    }

    const expected: ExpectedTerms = {
      finalPrice: Number(
        negotiation?.final_price ||
          negotiation?.target_price ||
          contract.current_price * 0.8,
      ),
      seats: contract.seat_count || 18,
      termMonths: 12,
      renewalDate: contract.renewal_date
        ? new Date(contract.renewal_date).toISOString().split("T")[0]
        : "2026-10-15",
    };

    return apiSuccess({
      contract: {
        id: contract.id,
        service: contract.service,
        vendor: contract.vendors,
      },
      negotiation: negotiation || null,
      transaction: tx || null,
      approval: approval || null,
      expected,
    });
  } catch (err: unknown) {
    logger.error("GET verify error", err);
    return handleApiError(err, "Failed to load verification status");
  }
}

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

    let rawBody = {};
    const text = await req.text();
    if (text && text.trim() !== "") {
      try {
        rawBody = JSON.parse(text);
      } catch {
        return apiError("Malformed JSON body in request", 400);
      }
    }

    const parsedBody = verifyBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return apiError("Invalid request body", 400, parsedBody.error.issues);
    }

    const body = parsedBody.data;

    const authCheck = await requireContractAccess(req, contractId);
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
    }

    const contract = authCheck.contract;
    const supabase = getServiceSupabase();

    const { data: negotiation } = await supabase
      .from("negotiations")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const expected: ExpectedTerms = {
      finalPrice: Number(
        negotiation?.final_price ||
          negotiation?.target_price ||
          contract.current_price * 0.8,
      ),
      seats: contract.seat_count || 18,
      termMonths: 12,
      renewalDate: contract.renewal_date
        ? new Date(contract.renewal_date).toISOString().split("T")[0]
        : "2026-10-15",
    };

    // 2. Fetch vendor confirmation from simulator
    const vendorId =
      contract.vendor_id || contract.vendors?.id || "mock-vendor";
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const confirmUrl = `${protocol}://${host}/api/vendors/${vendorId}/confirm${body.tamper ? `?tamper=${body.tamper}` : ""}`;

    const confirmRes = await fetch(confirmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId }),
    });

    if (!confirmRes.ok) {
      throw new Error(
        `Failed to simulate vendor confirmation: ${confirmRes.statusText}`,
      );
    }

    const confirmData = await confirmRes.json();
    const documentText =
      confirmData.data?.document || confirmData.document || "";

    // 3. LLM Extraction (Strict Schema)
    const extracted = await extractVendorConfirmation(documentText);

    // 4. Deterministic Verification Comparison
    const verification: VerificationResult = verifyConfirmationTerms(
      extracted,
      expected,
    );

    let releaseResult = null;
    let disputeResult = null;

    // 5. Handle Pass or Fail
    if (!verification.allPassed) {
      disputeResult = await (
        dispute_escrow.execute as (...args: any[]) => Promise<any>
      )(
        {
          contractId,
          negotiationId: negotiation?.id,
          reason: `Vendor confirmation verification failed with ${verification.discrepancies.length} discrepancy(ies)`,
          discrepancies: verification.discrepancies,
        },
        { toolCallId: "dispute-tool-call", messages: [] },
      );
    } else if (body.action === "release") {
      releaseResult = await (
        release_escrow.execute as (...args: any[]) => Promise<any>
      )(
        {
          contractId,
          negotiationId: negotiation?.id,
          verificationPassed: true,
        },
        { toolCallId: "release-tool-call", messages: [] },
      );
    }

    // 6. Fetch updated transaction & approval state
    const { data: updatedTx } = await supabase
      .from("transactions")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: updatedApproval } = await supabase
      .from("approvals")
      .select("*")
      .eq("negotiation_id", negotiation?.id || "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return apiSuccess({
      verified: true,
      allPassed: verification.allPassed,
      checks: verification.checks,
      discrepancies: verification.discrepancies,
      extracted: verification.extracted,
      expected: verification.expected,
      confirmationDocument: documentText,
      confirmationData:
        confirmData.data?.confirmation || confirmData.confirmation,
      transaction: updatedTx || null,
      approval: updatedApproval || null,
      releaseResult,
      disputeResult,
    });
  } catch (err: unknown) {
    logger.error("POST verify error", err);
    return handleApiError(err, "Verification execution failed");
  }
}

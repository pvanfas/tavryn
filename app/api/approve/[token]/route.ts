import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import {
  consumeApprovalToken,
  verifyApprovalToken,
} from "@/lib/approval-tokens";
import { logger } from "@/lib/logger";
import { recordOverrideMemory } from "@/lib/override-memory";

interface RouteProps {
  params: Promise<{ token: string }>;
}

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
  reasonCode: z.string().max(100).optional(),
});

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const rawParams = await params;
    const token = rawParams.token;
    if (!token || typeof token !== "string") {
      return apiError("Missing token parameter", 400);
    }

    const verification = await verifyApprovalToken(token);
    if (!verification.valid || !verification.record) {
      return apiError(verification.error || "Token invalid", 400, {
        used: Boolean(verification.record?.used_at),
        expired:
          verification.record?.expires_at &&
          new Date(verification.record.expires_at).getTime() < Date.now(),
      });
    }

    const record = verification.record;
    const contract = record.contracts;
    const negotiation = record.negotiations;

    const baselinePrice = Number(contract?.current_price || 0);
    const proposedPrice = negotiation?.final_price
      ? Number(negotiation.final_price)
      : negotiation?.current_offer
        ? Number(negotiation.current_offer)
        : baselinePrice;
    const annualSavings = Math.max(0, baselinePrice - proposedPrice);
    const savingsPct =
      baselinePrice > 0 ? Math.round((annualSavings / baselinePrice) * 100) : 0;

    return apiSuccess({
      token: record.id,
      expiresAt: record.expires_at,
      action: record.action,
      contract: {
        id: contract?.id,
        service: contract?.service,
        category: contract?.category,
        baselinePrice,
        proposedPrice,
        annualSavings,
        savingsPct,
        vendor: contract?.vendors,
        business: contract?.businesses,
      },
    });
  } catch (err) {
    logger.error("GET approve token error", err);
    return handleApiError(err, "Failed to verify approval link");
  }
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const rawParams = await params;
    const token = rawParams.token;
    if (!token) {
      return apiError("Missing token parameter", 400);
    }

    let rawBody = {};
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body", 400);
    }

    const parsedBody = actionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return apiError("Invalid decision payload", 400, parsedBody.error.issues);
    }

    const { action, reason, reasonCode } = parsedBody.data;

    // Verify token first to get context
    const verification = await verifyApprovalToken(token);
    if (!verification.valid || !verification.record) {
      return apiError(verification.error || "Invalid or expired token", 400);
    }

    const record = verification.record;
    const contract = record.contracts;

    // Consume token and execute policy-gated state transition
    const outcome = await consumeApprovalToken(token, action, reason);

    // If supervisor rejected, record feedback in override memory
    if (action === "reject" && contract) {
      await recordOverrideMemory({
        businessId: record.business_id,
        vendorId: contract.vendor_id,
        contractId: contract.id,
        category: contract.category || "software",
        reasonCode: reasonCode || "rate_too_high",
        notes: reason,
      });
    }

    return apiSuccess({
      status: outcome.status,
      decidedAt: outcome.decidedAt,
      message:
        action === "approve"
          ? "Contract successfully approved and authorized for escrow funding."
          : "Contract rejected. Decision feedback recorded in agent memory.",
    });
  } catch (err) {
    logger.error("POST approve token error", err);
    return handleApiError(err, "Failed to process one-tap decision");
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";

import { runReviewerAgent } from "@/lib/agent/reviewer";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireContractAccess } from "@/lib/auth-guard";
import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";

interface RouteProps {
  params: Promise<{ contractId: string }>;
}

const paramSchema = z.object({
  contractId: z.string().uuid({ message: "Invalid contract UUID parameter" }),
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

    const supabase = getServiceSupabase();

    const { data: review, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return apiSuccess({ review });
  } catch (err) {
    logger.error("GET review error", err);
    return handleApiError(err, "Failed to load review");
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

    const authCheck = await requireContractAccess(req, contractId);
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status);
    }

    const contract = authCheck.contract;
    const supabase = getServiceSupabase();

    const businessId = contract.business_id;

    // 2. Fetch negotiation
    const { data: negotiation } = await supabase
      .from("negotiations")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Fetch policy
    const { data: policy } = await supabase
      .from("policies")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    const originalPrice = Number(contract.current_price);
    const proposedPrice = negotiation?.final_price
      ? Number(negotiation.final_price)
      : negotiation?.current_offer
        ? Number(negotiation.current_offer)
        : Math.round(originalPrice * 0.8);
    const savings = Math.max(0, originalPrice - proposedPrice);

    // 4. Run Reviewer Agent
    const review = await runReviewerAgent(businessId, {
      negotiation: {
        id: negotiation?.id || contractId,
        contract_id: contractId,
        original_price: originalPrice,
        final_price: negotiation?.final_price
          ? Number(negotiation.final_price)
          : null,
        current_offer: proposedPrice,
        rounds: negotiation?.rounds || 1,
        savings,
        conversation: negotiation?.conversation || [],
      },
      contract: {
        id: contract.id,
        service: contract.service,
        current_price: originalPrice,
        category: contract.category,
        seat_count: contract.seat_count,
        active_seats: contract.active_seats,
      },
      usageData: {
        seatCount: contract.seat_count,
        activeSeats: contract.active_seats,
        utilizationPct:
          contract.seat_count && contract.active_seats
            ? Math.round((contract.active_seats / contract.seat_count) * 100)
            : null,
      },
      policySummary: policy
        ? {
            maxAutoTransaction: Number(policy.max_auto_transaction),
            minSavings: Number(policy.min_savings),
          }
        : undefined,
    });

    return apiSuccess({ review });
  } catch (err) {
    logger.error("POST review error", err);
    return handleApiError(err, "Failed to execute reviewer agent");
  }
}

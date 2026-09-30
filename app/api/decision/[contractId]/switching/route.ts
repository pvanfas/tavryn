import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";
import { evaluateSwitchingMatrix } from "@/lib/switching";
import { logAgentAction } from "@/lib/tools/audit";

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
    const supabase = getServiceSupabase();

    // 1. Fetch contract
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*, vendors(*), businesses(*)")
      .eq("id", contractId)
      .maybeSingle();

    if (cErr || !contract) {
      return apiError("Contract not found", 404);
    }

    const businessId = contract.business_id;

    // 2. Fetch negotiation
    const { data: negotiation } = await supabase
      .from("negotiations")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const baselinePrice = Number(contract.current_price);
    const renegotiatedPrice = negotiation?.final_price
      ? Number(negotiation.final_price)
      : negotiation?.current_offer
        ? Number(negotiation.current_offer)
        : Math.round(baselinePrice * 0.8);

    // 3. Fetch competitor vendor options in the same category
    let vQuery = supabase
      .from("vendors")
      .select("id, name, category, reputation_score, is_simulated")
      .eq("category", contract.category);

    if (contract.vendor_id) {
      vQuery = vQuery.neq("id", contract.vendor_id);
    }

    const { data: rawCompetitors } = await vQuery
      .order("reputation_score", { ascending: false })
      .limit(4);

    const competitorList = (rawCompetitors || []).map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      reputationScore: Number(v.reputation_score) || 4.5,
    }));

    // If fewer than 2 competitors found in db, seed standard marketplace alternatives for this category
    if (competitorList.length < 2) {
      if (contract.category === "cloud") {
        competitorList.push(
          {
            id: "alt-gcp",
            name: "Google Cloud Platform",
            category: "cloud",
            reputationScore: 4.8,
          },
          {
            id: "alt-azure",
            name: "Microsoft Azure",
            category: "cloud",
            reputationScore: 4.7,
          },
        );
      } else if (contract.category === "software") {
        competitorList.push(
          {
            id: "alt-linear",
            name: "Linear App",
            category: "software",
            reputationScore: 4.9,
          },
          {
            id: "alt-notion",
            name: "Notion Workspace",
            category: "software",
            reputationScore: 4.7,
          },
        );
      } else {
        competitorList.push(
          {
            id: "alt-toptal",
            name: "Toptal Elite",
            category: "contractors",
            reputationScore: 4.8,
          },
          {
            id: "alt-gunio",
            name: "Gun.io Devs",
            category: "contractors",
            reputationScore: 4.6,
          },
        );
      }
    }

    // 4. Calculate switching decision matrix
    const matrix = evaluateSwitchingMatrix({
      contractId: contract.id,
      service: contract.service,
      category: contract.category,
      currentBaseline: baselinePrice,
      renegotiatedPrice,
      seatCount: contract.seat_count,
      competitors: competitorList,
    });

    // 5. Audit log
    await logAgentAction({
      businessId,
      action: "evaluate_switching_matrix",
      reason: `Evaluated ${competitorList.length} migration alternatives vs incumbent renegotiation`,
      confidence: 1.0,
      input: { contractId, competitorsCount: competitorList.length },
      result: {
        recommendation: matrix.recommendation.action,
        netAdvantage: matrix.recommendation.netAdvantage,
      },
    });

    return apiSuccess({ matrix });
  } catch (err) {
    logger.error("GET switching matrix error", err);
    return handleApiError(err, "Failed to evaluate switching decision matrix");
  }
}

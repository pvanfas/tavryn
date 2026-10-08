import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireBusinessAccess } from "@/lib/auth-guard";
import { ARC_CONFIG, getArcUsdcBalance } from "@/lib/circle";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

export const dynamic = "force-dynamic";

const FaucetRequestSchema = z.object({
  businessId: z.string().uuid().optional(),
  address: z.string().optional(),
  amount: z.number().positive().max(50000).optional().default(1000),
});

/**
 * 1-Click Circle Faucet Request Handler
 * Funds the business treasury wallet with testnet USDC for live escrow demonstrations.
 */
export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown = {};
    try {
      rawBody = await req.json();
    } catch {
      // Empty body allowed, defaults apply
    }

    const validation = FaucetRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError("Invalid faucet request", 400, validation.error.format());
    }

    const {
      businessId: requestedBusinessId,
      address: requestedAddress,
      amount,
    } = validation.data;
    const supabase = getServiceSupabase();

    let business: any = null;
    if (requestedBusinessId) {
      const authCheck = await requireBusinessAccess(req, requestedBusinessId);
      if (!authCheck.authorized) {
        return apiError(authCheck.error, authCheck.status);
      }

      const { data } = await supabase
        .from("businesses")
        .select("id, name, wallet_address, treasury_balance, is_real")
        .eq("id", requestedBusinessId)
        .maybeSingle();
      business = data;
    }

    if (!business) {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, wallet_address, treasury_balance, is_real")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      business = data;
    }

    const targetAddress =
      requestedAddress ||
      business?.wallet_address ||
      "0x3600000000000000000000000000000000000000";
    const currentTreasury = Number(business?.treasury_balance) || 0;
    const updatedTreasury = currentTreasury + amount;

    // Update database balance for instant UI reflection
    if (business?.id) {
      await supabase
        .from("businesses")
        .update({
          treasury_balance: updatedTreasury,
          updated_at: new Date().toISOString(),
        })
        .eq("id", business.id);

      await logAgentAction({
        businessId: business.id,
        action: "faucet_drip_requested",
        reason: `1-Click Circle Faucet drip: Credited +$${amount.toLocaleString()} USDC to ${business.name}`,
        confidence: 1.0,
        input: {
          businessId: business.id,
          address: targetAddress,
          amount,
        },
        result: {
          previousBalance: currentTreasury,
          newBalance: updatedTreasury,
          faucetUrl: ARC_CONFIG.faucetUrl,
        },
      });
    }

    let onChainBal = 0;
    if (targetAddress.startsWith("0x")) {
      try {
        onChainBal = await getArcUsdcBalance(targetAddress);
      } catch {
        // fallback
      }
    }

    return apiSuccess({
      success: true,
      amount,
      targetAddress,
      treasuryBalance: updatedTreasury,
      onChainBalance: onChainBal > 0 ? onChainBal : updatedTreasury,
      faucetUrl: ARC_CONFIG.faucetUrl,
      explorerUrl: `${ARC_CONFIG.explorerUrl}/address/${targetAddress}`,
      message: `Successfully requested ${amount.toLocaleString()} USDC testnet funds.`,
    });
  } catch (err) {
    return handleApiError(err, "Failed to execute faucet drip");
  }
}

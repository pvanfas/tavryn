import { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ARC_CONFIG, getArcUsdcBalance } from "@/lib/circle";
import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");

    const supabase = getServiceSupabase();
    let walletAddress: string | null = null;
    let treasuryBalance = 0;

    if (businessId) {
      const { data: business } = await supabase
        .from("businesses")
        .select("id, name, wallet_address, treasury_balance, is_real")
        .eq("id", businessId)
        .maybeSingle();

      if (business) {
        walletAddress = business.wallet_address;
        treasuryBalance = Number(business.treasury_balance) || 0;
      }
    }

    let liveBalance = treasuryBalance;
    if (walletAddress && walletAddress.startsWith("0x")) {
      const arcBal = await getArcUsdcBalance(walletAddress);
      if (arcBal > 0) {
        liveBalance = arcBal;
      }
    }

    const isLow = liveBalance < 100;

    return apiSuccess({
      address: walletAddress,
      balance: liveBalance,
      isLow,
      faucetUrl: ARC_CONFIG.faucetUrl,
      explorerUrl: ARC_CONFIG.explorerUrl,
    });
  } catch (err) {
    logger.error("GET wallet balance error", err);
    return handleApiError(err, "Failed to retrieve wallet balance");
  }
}

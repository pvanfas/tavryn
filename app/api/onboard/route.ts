import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { ARC_CONFIG, createTreasuryWallet } from "@/lib/circle";
import { DEV_TREASURY_ADDRESS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { OnboardBusinessPayloadSchema } from "@/lib/schemas";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

export async function POST(req: Request) {
  try {
    let rawBody = {};
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body in request", 400);
    }

    const validation = OnboardBusinessPayloadSchema.safeParse(rawBody);

    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.format());
    }

    const payload = validation.data;
    const supabase = getServiceSupabase();

    // Resolve authenticated user ID if provided or from header
    let resolvedUserId = payload.userId;
    const authHeader = req.headers.get("authorization");
    if (!resolvedUserId && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user?.id) {
          resolvedUserId = userData.user.id;
        }
      } catch {}
    }

    // 1. Create Real Business (is_real = true)
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .insert({
        name: payload.name,
        is_real: true,
        default_currency: payload.default_currency || "USDC",
        treasury_balance: payload.treasury_balance,
        webhook_url: payload.webhook_url || null,
      })
      .select("id, name")
      .single();

    if (businessError || !business) {
      logger.error("Failed to insert business", businessError);
      return apiError(
        `Database error: ${businessError?.message || "Failed to create business"}`,
        500,
      );
    }

    // 1b. Associate User with Business as Owner
    if (resolvedUserId) {
      const { error: memberError } = await supabase
        .from("business_members")
        .insert({
          business_id: business.id,
          user_id: resolvedUserId,
          role: "owner",
        });
      if (memberError) {
        logger.warn("Failed to map business member", memberError);
      }
    }

    // 1c. Create Arc Treasury Wallet (Circle SCA or deterministic Arc address)
    let treasuryAddress = DEV_TREASURY_ADDRESS;
    try {
      const walletResult = await createTreasuryWallet({
        businessId: business.id,
        businessName: business.name,
      });
      treasuryAddress = walletResult.address;
      await supabase
        .from("businesses")
        .update({ wallet_address: treasuryAddress })
        .eq("id", business.id);
    } catch (walletErr) {
      logger.warn("Treasury wallet creation fallback applied", walletErr);
    }

    // 2. Resolve Vendors (is_simulated = false for real onboarding)
    const vendorMap = new Map<string, string>();
    const uniqueVendors = Array.from(
      new Set(payload.subscriptions.map((s) => s.vendor.trim())),
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
        const sampleSub = payload.subscriptions.find(
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

    // 3. Create Contracts
    let totalSpend = 0;
    const contractsPayload = payload.subscriptions.map((sub) => {
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

    // 4. Create Policy
    const { error: policyError } = await supabase.from("policies").insert({
      business_id: business.id,
      max_auto_transaction: payload.policy.max_auto_transaction,
      min_savings: payload.policy.min_savings,
      human_approval_required_above:
        payload.policy.human_approval_required_above,
      allowed_categories: payload.policy.allowed_categories,
      category_budgets: {
        software: 25000,
        cloud: 50000,
        contractors: 25000,
      },
    });

    if (policyError) {
      logger.error("Failed to insert policy", policyError);
      return apiError(`Database error: ${policyError.message}`, 500);
    }

    // 5. Append-only Agent Action Log with SHA-256 chain
    await logAgentAction({
      businessId: business.id,
      action: "business_onboarded",
      reason: `Automated onboarding completed for real business '${business.name}' with ${payload.subscriptions.length} active subscriptions and deterministic policy constraints`,
      confidence: 1.0,
      input: {
        business_name: business.name,
        is_real: true,
        treasury_balance: payload.treasury_balance,
        contracts_count: payload.subscriptions.length,
        total_annual_spend: totalSpend,
        policy: payload.policy,
      },
      result: {
        success: true,
        business_id: business.id,
        contracts_created: payload.subscriptions.length,
        vendors_count: vendorMap.size,
        wallet_address: treasuryAddress,
      },
    });

    // 6. Record Onboarding Event for Audit and Reporting
    try {
      await supabase.from("onboarding_events").insert({
        business_id: business.id,
        user_id: resolvedUserId || null,
        event_type: "business_onboarded",
        step: "completed",
        metadata: {
          business_name: business.name,
          contracts_count: payload.subscriptions.length,
          total_annual_spend: totalSpend,
          wallet_address: treasuryAddress,
          currency: payload.default_currency || "USDC",
          policy: payload.policy,
        },
      });
    } catch (eventErr) {
      logger.warn("Failed to record onboarding event", eventErr);
    }

    return apiSuccess({
      businessId: business.id,
      businessName: business.name,
      contractsCount: payload.subscriptions.length,
      walletAddress: treasuryAddress,
      fundingInstructions: {
        network: "Arc Testnet",
        chainId: ARC_CONFIG.chainId,
        rpcUrl: ARC_CONFIG.rpcUrl,
        token: "Testnet USDC",
        tokenAddress: ARC_CONFIG.usdcContractAddress,
        faucetUrl: ARC_CONFIG.faucetUrl,
        explorerUrl: `${ARC_CONFIG.explorerUrl}/address/${treasuryAddress}`,
      },
    });
  } catch (err) {
    logger.error("Onboarding server error", err);
    return handleApiError(err, "Internal server error during onboarding");
  }
}

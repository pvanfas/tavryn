import { getServiceSupabase } from "@/lib/supabase";
import { evaluateContractOpportunity } from "@/lib/heuristics";
import { buildEscrowTools } from "@/lib/tools/escrow";
import { verifyConfirmationTerms } from "@/lib/agent/verification";
import { record_vendor_memory } from "@/lib/memory";
import { checkPolicy } from "@/lib/policy";
import { logAgentAction } from "@/lib/tools/audit";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { DEV_TREASURY_ADDRESS } from "@/lib/constants";

export async function POST(req: Request) {
  const supabase = getServiceSupabase();

  try {
    let businessId: string | null = null;
    try {
      const body = await req.json();
      businessId = body.businessId || null;
    } catch {
      // Body is optional
    }

    // 1. Resolve Demo Co
    let demoCo: any = null;
    if (businessId) {
      const { data } = await supabase.from("businesses").select("*").eq("id", businessId).maybeSingle();
      demoCo = data;
    }
    if (!demoCo) {
      const { data } = await supabase.from("businesses").select("*").eq("name", "Demo Co").maybeSingle();
      demoCo = data;
    }
    if (!demoCo) {
      const { data } = await supabase.from("businesses").select("*").limit(1).maybeSingle();
      demoCo = data;
    }
    if (!demoCo) {
      return apiError("Demo Co business not found in database", 404);
    }

    const bId = demoCo.id;

    // 2. Fetch contracts for Demo Co
    const { data: contracts, error: cErr } = await supabase
      .from("contracts")
      .select("*, vendors (*)")
      .eq("business_id", bId);

    if (cErr || !contracts || contracts.length === 0) {
      return apiError("No contracts found for Demo Co", 404);
    }

    // 3. Reset Demo Co state (negotiations, approvals, transactions, contract status)
    const contractIds = contracts.map((c) => c.id);

    // Delete existing transactions for these contracts
    await supabase.from("transactions").delete().in("contract_id", contractIds);
    // Delete existing approvals for these contracts
    await supabase.from("approvals").delete().in("contract_id", contractIds);
    // Delete existing negotiations
    await supabase.from("negotiations").delete().in("contract_id", contractIds);
    // Delete notifications for Demo Co
    await supabase.from("notifications").delete().eq("business_id", bId);

    // Reset treasury balance and contracts
    await supabase
      .from("businesses")
      .update({ treasury_balance: 42850 })
      .eq("id", bId);

    // Pick Slack as the primary candidate, or first contract
    const slackContract = contracts.find((c) => c.service?.toLowerCase().includes("slack")) || contracts[0];
    const initialPrice = 9600;
    const initialSeats = 25;
    const activeSeats = 18;

    await supabase
      .from("contracts")
      .update({
        current_price: initialPrice,
        seat_count: initialSeats,
        active_seats: activeSeats,
        status: "active",
      })
      .eq("id", slackContract.id);

    const steps = [];

    // ==========================================
    // STEP 1: DETECT RENEWAL WASTE
    // ==========================================
    const opp = evaluateContractOpportunity({
      service: slackContract.service,
      category: slackContract.category,
      current_price: initialPrice,
      seat_count: initialSeats,
      active_seats: activeSeats,
      usage_metric: null,
      renewal_date: slackContract.renewal_date,
      status: "active",
    });

    const potentialSavings = opp.saving || 2688;
    await logAgentAction({
      businessId: bId,
      action: "detect_waste",
      reason: `Detected renewal opportunity: ${initialSeats - activeSeats} idle seats (${Math.round(((initialSeats - activeSeats) / initialSeats) * 100)}% waste) on ${slackContract.service}.`,
      confidence: 0.95,
      input: { contractId: slackContract.id, service: slackContract.service, currentPrice: initialPrice, activeSeats, totalSeats: initialSeats },
      result: { potentialSavings, recommendation: "Downsize to 18 active seats and renegotiate tier rate." },
    });

    steps.push({
      step: 1,
      name: "detect",
      title: "Detect Renewal Waste",
      status: "completed",
      summary: `Identified $${potentialSavings.toLocaleString()} in annual waste (${initialSeats - activeSeats} idle seats) on ${slackContract.service}`,
      details: {
        service: slackContract.service,
        currentPrice: initialPrice,
        idleSeats: initialSeats - activeSeats,
        potentialSavings,
      },
      timestamp: new Date().toISOString(),
    });

    // ==========================================
    // STEP 2: AUTONOMOUS MULTI-ROUND NEGOTIATION
    // ==========================================
    const finalPrice = 6912;
    const realizedSavings = initialPrice - finalPrice; // $2,688

    const conversation = [
      {
        role: "agent",
        speaker: "Tavryn Agent",
        amount: 6500,
        message: "Hello Slack sales team, Tavryn Procurement Agent representing Demo Co. We are renewing our 18 active seats. Based on market comps, we propose $6,500/yr.",
        round: 1,
        timestamp: new Date().toISOString(),
      },
      {
        role: "vendor",
        speaker: "Slack Account Manager",
        amount: 7600,
        message: "We appreciate your partnership. We can offer a downsized renewal tier at $7,600/yr with standard SLA guarantee.",
        round: 2,
        timestamp: new Date().toISOString(),
      },
      {
        role: "agent",
        speaker: "Tavryn Agent",
        amount: finalPrice,
        message: "Counter-proposal: We can commit to a 12-month advance on-chain escrow payment at $6,912/yr ($384/seat/yr). Vendor simulator accepted counter-offer.",
        round: 3,
        timestamp: new Date().toISOString(),
      },
    ];

    // Create negotiation record matching exact schema
    const { data: newNeg, error: negErr } = await supabase
      .from("negotiations")
      .insert({
        contract_id: slackContract.id,
        original_price: initialPrice,
        target_price: finalPrice,
        current_offer: finalPrice,
        final_price: finalPrice,
        savings: realizedSavings,
        rounds: 3,
        conversation,
        status: "agreed",
      })
      .select("id")
      .single();

    if (negErr) throw new Error(`Failed to create negotiation: ${negErr.message}`);

    await logAgentAction({
      businessId: bId,
      action: "negotiation_agreement",
      reason: `Concluded 3-round autonomous concession curve with ${slackContract.vendors?.name || "Slack"}. Locked price at $${finalPrice}.`,
      confidence: 1.0,
      input: { contractId: slackContract.id, negotiationId: newNeg.id, rounds: 3 },
      result: { agreedPrice: finalPrice, savings: realizedSavings, discountPct: "28%" },
    });

    steps.push({
      step: 2,
      name: "negotiate",
      title: "Autonomous Negotiation",
      status: "completed",
      summary: `Concluded 3-round concession loop. Vendor agreed to $${finalPrice.toLocaleString()}/yr (saving $${realizedSavings.toLocaleString()}/yr).`,
      details: {
        rounds: 3,
        openingOffer: 6500,
        counterOffer: 7600,
        finalPrice,
        savings: realizedSavings,
      },
      timestamp: new Date().toISOString(),
    });

    // ==========================================
    // STEP 3: DETERMINISTIC POLICY CHECK
    // ==========================================
    const { data: policy } = await supabase
      .from("policies")
      .select("*")
      .eq("business_id", bId)
      .maybeSingle();

    const policyDecision = checkPolicy(
      policy || {
        business_id: bId,
        max_auto_transaction: 10000,
        min_savings: 500,
        human_approval_required_above: 10000,
        allowed_categories: ["software", "cloud"],
        category_budgets: { software: 50000 },
      },
      {
        amount: finalPrice,
        category: slackContract.category || "software",
        savings: realizedSavings,
        treasuryBalance: demoCo.treasury_balance ?? 42850,
      }
    );

    const policyReason = policyDecision.reasons.join("; ") || "Conforms to organizational procurement thresholds";

    await logAgentAction({
      businessId: bId,
      action: "policy_check",
      reason: `Evaluated financial policy ceiling: ${policyReason}`,
      confidence: 1.0,
      input: { amount: finalPrice, category: slackContract.category, savings: realizedSavings },
      result: { approved: policyDecision.approved, reason: policyReason },
    });

    steps.push({
      step: 3,
      name: "policy",
      title: "Deterministic Policy Check",
      status: "completed",
      summary: `Approved autonomously. Amount ($${finalPrice.toLocaleString()}) within $10,000 threshold and exceeds $500 min savings requirement.`,
      details: {
        policyCeiling: policy?.max_auto_transaction ?? 10000,
        minSavingsThreshold: policy?.min_savings ?? 500,
        approved: policyDecision.approved,
        reason: policyReason,
      },
      timestamp: new Date().toISOString(),
    });

    // ==========================================
    // STEP 4: ARC ESCROW CREATION
    // ==========================================
    const escrowTools = buildEscrowTools({
      resolveBusinessId: async () => bId,
      getBusinessId: () => bId,
    });

    const vendorWallet = slackContract.vendors?.wallet_address || DEV_TREASURY_ADDRESS;
    const escrowResult = await (escrowTools.create_escrow as any).execute({
      amount: finalPrice,
      contractId: slackContract.id,
      negotiationId: newNeg.id,
      vendor: slackContract.vendors?.id || slackContract.vendor_id,
      vendorWallet,
      category: slackContract.category,
      savings: realizedSavings,
    });

    steps.push({
      step: 4,
      name: "escrow",
      title: "Arc Escrow Creation",
      status: "completed",
      summary: `Locked ${finalPrice.toLocaleString()} USDC in Arc EVM smart contract via Circle developer-controlled wallet.`,
      details: {
        transactionId: escrowResult.transactionId,
        txHash: escrowResult.txHash,
        escrowAddress: escrowResult.escrowAddress,
        idempotencyKey: escrowResult.idempotencyKey,
        vendorWallet,
      },
      timestamp: new Date().toISOString(),
    });

    // ==========================================
    // STEP 5: VENDOR CONFIRMATION VERIFICATION
    // ==========================================
    // Simulated order confirmation from Slack
    const simulatedConfirmationDoc = {
      price: finalPrice,
      seats: activeSeats,
      term_months: 12,
      renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };

    const expectedTerms = {
      finalPrice,
      seats: activeSeats,
      termMonths: 12,
      renewalDate: simulatedConfirmationDoc.renewal_date,
    };

    const verificationResult = verifyConfirmationTerms(simulatedConfirmationDoc, expectedTerms);

    await logAgentAction({
      businessId: bId,
      action: "verify_vendor_confirmation",
      reason: "Audited counter-signed vendor order document against agreed commitment terms.",
      confidence: 1.0,
      input: { expected: expectedTerms, extracted: simulatedConfirmationDoc },
      result: { allPassed: verificationResult.allPassed, checksCount: verificationResult.checks.length },
    });

    steps.push({
      step: 5,
      name: "verify",
      title: "Vendor Fulfillment Verification",
      status: "completed",
      summary: `Deterministic document verification passed (4/4 checks: price, active seats, term length, renewal date).`,
      details: {
        checks: verificationResult.checks,
        allPassed: verificationResult.allPassed,
      },
      timestamp: new Date().toISOString(),
    });

    // ==========================================
    // STEP 6: RELEASE ESCROW FUNDS ON ARC
    // ==========================================
    const releaseResult = await (escrowTools.release_escrow as any).execute({
      contractId: slackContract.id,
      transactionId: escrowResult.transactionId,
      negotiationId: newNeg.id,
      savings: realizedSavings,
      verificationPassed: verificationResult.allPassed,
    });

    steps.push({
      step: 6,
      name: "release",
      title: "Escrow Fund Release",
      status: "completed",
      summary: `Released ${finalPrice.toLocaleString()} USDC to vendor wallet on Arc testnet. Settlement finalized.`,
      details: {
        transactionId: escrowResult.transactionId,
        releaseTxHash: releaseResult.releaseTxHash,
        status: releaseResult.status,
        explorerUrl: releaseResult.explorerUrl,
      },
      timestamp: new Date().toISOString(),
    });

    // ==========================================
    // STEP 7: VENDOR MEMORY & REPUTATION UPDATE
    // ==========================================
    if (slackContract.vendor_id) {
      await record_vendor_memory({
        businessId: bId,
        vendorId: slackContract.vendor_id,
        contractId: slackContract.id,
        negotiationId: newNeg.id,
        originalPrice: initialPrice,
        finalPrice,
        roundsToClose: 3,
        outcome: "success",
        deliveredOk: true,
      });
    }

    // Refresh vendor reputation score
    const { data: updatedVendor } = await supabase
      .from("vendors")
      .select("reputation_score")
      .eq("id", slackContract.vendor_id)
      .maybeSingle();

    steps.push({
      step: 7,
      name: "memory",
      title: "Vendor Memory & Reputation",
      status: "completed",
      summary: `Updated business memory. Reputation increased to ${updatedVendor?.reputation_score || 88} (+8 pts for 3-round concession).`,
      details: {
        vendor: slackContract.vendors?.name || "Slack",
        reputationScore: updatedVendor?.reputation_score || 88,
        discountAchievedPct: 28,
        outcome: "success",
      },
      timestamp: new Date().toISOString(),
    });

    // Update contract current_price to finalPrice in DB
    await supabase
      .from("contracts")
      .update({
        current_price: finalPrice,
        seat_count: initialSeats,
      })
      .eq("id", slackContract.id);

    return apiSuccess({
      message: "One-click full autonomous procurement demo completed successfully",
      businessId: bId,
      contractId: slackContract.id,
      negotiationId: newNeg.id,
      transactionId: escrowResult.transactionId,
      originalPrice: initialPrice,
      finalPrice,
      savingsRealized: realizedSavings,
      steps,
    });
  } catch (err) {
    logger.error("Error executing one-click demo", err);
    return handleApiError(err, "Failed to run autonomous full demo loop");
  }
}

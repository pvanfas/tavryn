import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  draftVendorOutreachEmail,
  extractTermsFromVendorReply,
  processVendorReply,
  recordSavingsWithoutPayment,
  VendorReplyExtractionSchema,
} from "../lib/agent/real-vendor";
import { calculateTractionMetrics } from "../lib/metrics";
import { getServiceSupabase } from "../lib/supabase";

describe("Real-Vendor Mode with Human in the Loop", () => {
  it("drafts outreach email citing usage telemetry and target price without auto-sending", async () => {
    const supabase = getServiceSupabase();
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, service, current_price, seat_count, active_seats")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    assert.ok(contract, "Contract must exist in database");

    const draft = await draftVendorOutreachEmail(contract.id);

    // 1. Verify recipient, subject, and body exist
    assert.ok(
      draft.to && draft.to.length > 3,
      "Email recipient should be specified",
    );
    assert.ok(
      draft.subject.includes(contract.service),
      "Subject should mention the service",
    );
    assert.ok(
      draft.body.includes(contract.service),
      "Body should mention the service",
    );

    // 2. Verify usage data and target pricing are cited
    assert.ok(
      draft.target_price < draft.baseline_price,
      "Target price should represent a discount",
    );
    assert.ok(
      draft.body.includes(draft.target_price.toLocaleString()) ||
        draft.body.includes(String(draft.target_price)),
      "Email body must cite target pricing",
    );

    // 3. Verify logging in agent_actions
    const { data: actions } = await supabase
      .from("agent_actions")
      .select("*")
      .eq("action", "real_vendor_email_drafted")
      .order("created_at", { ascending: false })
      .limit(10);

    const relevantAction = actions?.find(
      (a: any) => a.input?.contractId === contract.id,
    );
    assert.ok(relevantAction, "Action must be logged in agent_actions");
    assert.equal(relevantAction.input.contractId, contract.id);
    assert.equal(relevantAction.input.service, contract.service);
    assert.equal(relevantAction.confidence, 0.95);
  });

  it("extracts counter-offer, seats, term, and payment conditions into strict Zod schema", async () => {
    // Test Case 1: Standard counter-offer with seats and USDC acceptance
    const sampleReply1 = `Hi team,
Thanks for reaching out regarding the renewal. While we cannot meet your requested target of $7,400 for the full 50 seats, we can offer an annual agreement at $8,160 ($680/mo) if you commit to 45 seats on a 12-month term. Payment via wire or USDC invoice on Arc is accepted.
Best,
Sarah Chen`;

    const extracted1 = await extractTermsFromVendorReply(sampleReply1, 10000);
    const parsed1 = VendorReplyExtractionSchema.safeParse(extracted1);
    assert.ok(
      parsed1.success,
      "Extraction must conform to VendorReplyExtractionSchema",
    );
    assert.equal(extracted1.counter_offer, 8160);
    assert.equal(extracted1.seats, 45);
    assert.equal(extracted1.commitment_months, 12);
    assert.equal(extracted1.accepts_usdc, true);
    assert.equal(extracted1.accepted, false);

    // Test Case 2: Direct acceptance of proposed terms
    const sampleReply2 = `Hello Tavryn,
We reviewed your telemetry and agreed to accept your renewal proposal at $7,400 per year for 42 seats on a 12-month commitment. Arc escrow USDC is fine.`;

    const extracted2 = await extractTermsFromVendorReply(sampleReply2, 7400);
    assert.equal(extracted2.accepted, true);
    assert.equal(extracted2.counter_offer, 7400);
    assert.equal(extracted2.seats, 42);
    assert.equal(extracted2.accepts_usdc, true);

    // Test Case 3: Refusal of USDC / ACH only
    const sampleReply3 = `Hello,
We can agree to $7,800 annually for your team. However, please note our billing department only accepts ACH direct deposit or physical check. No crypto or USDC accepted under any circumstances.`;

    const extracted3 = await extractTermsFromVendorReply(sampleReply3, 7800);
    assert.equal(extracted3.accepts_usdc, false);
    assert.equal(extracted3.counter_offer, 7800);
  });

  it("processes real-vendor reply, logs raw reply in agent_actions, and manages negotiation state", async () => {
    const supabase = getServiceSupabase();
    // Create a dedicated contract for real-mode testing to avoid polluted negotiation state
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .single();
    assert.ok(business, "Business must exist");

    const { data: contract } = await supabase
      .from("contracts")
      .insert({
        business_id: business.id,
        service: `Real Vendor Test ${Date.now()}`,
        category: "software",
        current_price: 10000,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select("id, current_price, service")
      .single();

    assert.ok(contract, "Contract must exist");

    const rawReply = `Hi Alex,
Thanks for following up on the ${contract.service} renewal. We reviewed your usage drop and can agree to a revised rate of $7,450 for the year if paid in USDC or wire.
Cheers,
Vendor Team`;

    const result = await processVendorReply(contract.id, rawReply);

    // 1. Verify decision and extraction
    assert.ok(result.decision === "agreed" || result.decision === "counter");
    assert.ok(result.extraction.counter_offer !== null);
    assert.equal(result.extraction.accepts_usdc, true);

    // 2. Verify agent_actions has raw reply attached in input
    const { data: actions } = await supabase
      .from("agent_actions")
      .select("*")
      .eq("action", "real_vendor_reply_processed")
      .order("created_at", { ascending: false })
      .limit(10);

    const relevantAction = actions?.find(
      (a: any) => a.input?.contractId === contract.id,
    );
    assert.ok(
      relevantAction,
      "agent_actions must have logged real_vendor_reply_processed",
    );
    assert.equal(
      relevantAction.input.raw_reply,
      rawReply,
      "agent_actions must attach the raw vendor reply",
    );
    assert.ok(
      relevantAction.result.extraction,
      "agent_actions result must include schema extraction",
    );

    // 3. Verify conversation transcript in negotiations table
    const { data: neg } = await supabase
      .from("negotiations")
      .select("conversation, status")
      .eq("contract_id", contract.id)
      .single();

    assert.ok(neg, "Negotiation record must exist");
    assert.ok(
      Array.isArray(neg.conversation),
      "Conversation must be an array of turns",
    );
    const lastTurn = neg.conversation[neg.conversation.length - 1];
    assert.ok(lastTurn, "Last conversation turn must exist");
    assert.equal(lastTurn.role, "vendor");
    assert.ok(
      lastTurn.message.includes("revised rate of $7,450") ||
        lastTurn.amount === 7450,
    );
  });

  it("records savings without payment when vendor does not accept USDC and reflects in traction metrics", async () => {
    const supabase = getServiceSupabase();
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, current_price, business_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    assert.ok(contract, "Contract must exist");

    const baselinePrice = Number(contract.current_price);
    const agreedOffChainPrice = Math.round(baselinePrice * 0.85); // 15% discount
    const expectedSavings = baselinePrice - agreedOffChainPrice;

    const recordResult = await recordSavingsWithoutPayment(contract.id, {
      final_price: agreedOffChainPrice,
      notes: "ACH direct deposit agreement; vendor refused USDC on Arc.",
    });

    assert.equal(recordResult.success, true);
    assert.equal(recordResult.status, "savings_recorded_no_payment");
    assert.equal(recordResult.savings, expectedSavings);

    // 1. Verify agent_actions has audit row
    const { data: actions } = await supabase
      .from("agent_actions")
      .select("*")
      .eq("action", "savings_recorded_without_payment")
      .order("created_at", { ascending: false })
      .limit(10);

    const relevantAction = actions?.find(
      (a: any) => a.input?.contractId === contract.id,
    );
    assert.ok(
      relevantAction,
      "agent_actions must have logged savings_recorded_without_payment",
    );
    assert.equal(relevantAction.result.savings, expectedSavings);

    // 2. Verify metrics calculation includes off-chain savings
    const metrics = await calculateTractionMetrics(false);
    assert.ok(
      metrics.savings.realized >= metrics.savings.offChainSavings,
      "realized must include off-chain savings",
    );
  });
});

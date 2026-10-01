import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createApprovalRecord,
  verifyPolicyExecutionAuthorization,
} from "../lib/policy";
import { getServiceSupabase } from "../lib/supabase";
import { create_escrow } from "../lib/tools";

describe("Server-Side Policy Enforcement & Human Approval Boundary", () => {
  it("authorizes transaction when within autonomous policy threshold", async () => {
    const supabase = getServiceSupabase();
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("name", "Demo Co")
      .single();
    assert.ok(business, "Business must exist");

    const auth = await verifyPolicyExecutionAuthorization(business.id, {
      amount: 1500, // <= 10,000 ceiling
      savings: 600, // >= 500 min_savings
      category: "software",
    });

    assert.equal(auth.authorized, true);
    assert.equal(auth.decision, "approved");
    assert.ok(auth.reason.includes("automatically authorized"));
  });

  it("refuses execution when transaction exceeds autonomous ceiling without human approval", async () => {
    const supabase = getServiceSupabase();
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("name", "Demo Co")
      .single();
    assert.ok(business, "Business must exist");

    // Clean any prior approvals for clean test
    await supabase.from("approvals").delete().eq("business_id", business.id);

    const auth = await verifyPolicyExecutionAuthorization(business.id, {
      amount: 28800, // Datadog $28,800 exceeds $10,000 ceiling
      savings: 7200,
      category: "cloud",
    });

    assert.equal(auth.authorized, false);
    assert.equal(auth.decision, "needs_human");
    assert.ok(auth.reason.includes("requires explicit human approval"));
  });

  it("authorizes execution after human approval row is inserted into approvals table", async () => {
    const supabase = getServiceSupabase();
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("name", "Demo Co")
      .single();
    assert.ok(business, "Business must exist");

    const { data: contract } = await supabase
      .from("contracts")
      .select("id")
      .eq("business_id", business.id)
      .limit(1)
      .single();
    assert.ok(contract, "Contract must exist");

    // Insert a valid test negotiation row
    const { data: testNeg, error: negErr } = await supabase
      .from("negotiations")
      .insert({
        contract_id: contract.id,
        original_price: 36000,
        target_price: 28800,
        current_offer: 28800,
        status: "pending_approval",
      })
      .select("id")
      .single();
    assert.ifError(negErr);
    assert.ok(testNeg);

    // Insert an approved row
    const created = await createApprovalRecord(supabase, {
      businessId: business.id,
      negotiationId: testNeg.id,
      status: "approved",
      reason: "Manually approved by test administrator",
      decidedAt: new Date().toISOString(),
      amount: 28800,
    });

    assert.ifError(created.error);
    assert.ok(created.id);

    const auth = await verifyPolicyExecutionAuthorization(business.id, {
      amount: 28800,
      savings: 7200,
      category: "cloud",
      negotiationId: testNeg.id,
    });

    assert.equal(auth.authorized, true);
    assert.equal(auth.decision, "approved");
    assert.ok(auth.reason.includes("verified"));

    // Cleanup
    await supabase.from("approvals").delete().eq("id", created.id);
    await supabase.from("negotiations").delete().eq("id", testNeg.id);
  });

  it("create_escrow tool refuses unauthorized transaction exceeding policy boundary", async () => {
    const supabase = getServiceSupabase();
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, business_id")
      .eq("service", "Datadog")
      .single();

    assert.ok(contract, "Datadog contract must exist");

    // Clean prior approvals for this business
    await supabase
      .from("approvals")
      .delete()
      .eq("business_id", contract.business_id);

    // Attempt to invoke create_escrow for $28,800 without approval
    await assert.rejects(async () => {
      await (create_escrow as any).execute(
        {
          amount: 28800,
          vendorWallet: "0x1234567890123456789012345678901234567890",
          idempotencyKey: `test-refusal-${Date.now()}`,
          contractId: contract.id,
          category: "cloud",
          savings: 7200,
        },
        { messages: [], toolCallId: "t-refusal" },
      );
    }, /Policy refusal: Transaction exceeds autonomous ceiling/);
  });
});

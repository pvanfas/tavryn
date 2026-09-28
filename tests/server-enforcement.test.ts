import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getServiceSupabase } from "../lib/supabase";
import { verifyPolicyExecutionAuthorization } from "../lib/policy";
import { create_escrow } from "../lib/tools";

describe("Server-Side Policy Enforcement & Human Approval Boundary", () => {
  it("authorizes transaction when within autonomous policy threshold", async () => {
    const supabase = getServiceSupabase();
    const { data: business } = await supabase.from("businesses").select("id").limit(1).single();
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
    const { data: business } = await supabase.from("businesses").select("id").limit(1).single();
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
    const { data: business } = await supabase.from("businesses").select("id").limit(1).single();
    assert.ok(business, "Business must exist");

    // Insert an approved row
    const { data: approvedRow, error } = await supabase
      .from("approvals")
      .insert({
        business_id: business.id,
        status: "approved",
        reason: "Manually approved by test administrator",
        decided_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    assert.ifError(error);
    assert.ok(approvedRow);

    const auth = await verifyPolicyExecutionAuthorization(business.id, {
      amount: 28800,
      savings: 7200,
      category: "cloud",
    });

    assert.equal(auth.authorized, true);
    assert.equal(auth.decision, "approved");
    assert.ok(auth.reason.includes("verified human approval record"));

    // Cleanup
    await supabase.from("approvals").delete().eq("id", approvedRow.id);
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
    await supabase.from("approvals").delete().eq("business_id", contract.business_id);

    // Attempt to invoke create_escrow for $28,800 without approval
    await assert.rejects(
      async () => {
        await (create_escrow as any).execute(
          {
            amount: 28800,
            vendorWallet: "0x1234567890123456789012345678901234567890",
            idempotencyKey: `test-refusal-${Date.now()}`,
            contractId: contract.id,
            category: "cloud",
            savings: 7200,
          },
          { messages: [], toolCallId: "t-refusal" }
        );
      },
      /Policy refusal: Transaction exceeds autonomous ceiling/
    );
  });
});

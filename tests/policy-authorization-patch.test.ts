import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createApprovalRecord,
  verifyPolicyExecutionAuthorization,
} from "../lib/policy";
import { getServiceSupabase } from "../lib/supabase";
import { createAgentTools } from "../lib/tools";

describe("Policy Authorization Hardening Integration Tests", () => {
  const supabase = getServiceSupabase();

  interface TestFixture {
    business: { id: string; name: string };
    policy: { id: string; max_auto_transaction: number };
    contract: { id: string };
  }

  // Helper to create an isolated business record with an explicit, sufficient treasury balance
  // decoupled from whatever shared state exists in the dev/test database.
  async function setupIsolatedTestFixture(
    treasuryBalance = 1000000,
  ): Promise<TestFixture> {
    const { data: business, error: bErr } = await supabase
      .from("businesses")
      .insert({
        name: `Policy Test Biz ${Date.now()}_${Math.random().toString(36).substring(7)}`,
        treasury_balance: treasuryBalance,
        wallet_address: null, // explicit null so on-chain balance lookup is not triggered
        is_real: false,
      })
      .select("id, name")
      .single();
    assert.ok(
      business && !bErr,
      `Failed to setup isolated test business: ${bErr?.message}`,
    );

    const { data: policy, error: pErr } = await supabase
      .from("policies")
      .insert({
        business_id: business.id,
        max_auto_transaction: 2000,
        min_savings: 200,
        human_approval_required_above: 2000,
        allowed_categories: [
          "software",
          "cloud",
          "contractors",
          "infrastructure",
        ],
      })
      .select("id, max_auto_transaction")
      .single();
    assert.ok(policy && !pErr, `Failed to setup test policy: ${pErr?.message}`);

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        business_id: business.id,
        service: `Fixture Contract ${Date.now()}`,
        category: "software",
        current_price: 100000,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select("id")
      .single();
    assert.ok(
      contract && !cErr,
      `Failed to setup test contract: ${cErr?.message}`,
    );

    return { business, policy, contract };
  }

  async function cleanupFixture(fixture: TestFixture) {
    const businessId = fixture.business.id;
    try {
      await supabase.from("approvals").delete().eq("business_id", businessId);
    } catch {}
    try {
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id")
        .eq("business_id", businessId);
      if (contracts && contracts.length > 0) {
        const contractIds = contracts.map((c) => c.id);
        await supabase
          .from("negotiations")
          .delete()
          .in("contract_id", contractIds);
      }
    } catch {}
    try {
      await supabase.from("contracts").delete().eq("business_id", businessId);
    } catch {}
    try {
      await supabase.from("policies").delete().eq("business_id", businessId);
    } catch {}
    try {
      await supabase
        .from("transactions")
        .delete()
        .eq("business_id", businessId);
    } catch {}
    try {
      await supabase.from("businesses").delete().eq("id", businessId);
    } catch {}
  }

  // Helper to create a negotiation row satisfying foreign key constraints
  async function createTestNegotiation(
    businessId: string,
    originalPrice: number,
    targetPrice: number,
    contractId?: string,
  ) {
    let targetContractId = contractId;
    if (!targetContractId) {
      const { data: contract } = await supabase
        .from("contracts")
        .select("id")
        .eq("business_id", businessId)
        .limit(1)
        .single();
      assert.ok(contract, "Contract must exist for business");
      targetContractId = contract.id;
    }

    const { data: neg, error } = await supabase
      .from("negotiations")
      .insert({
        contract_id: targetContractId,
        original_price: originalPrice,
        target_price: targetPrice,
        current_offer: targetPrice,
        status: "pending_approval",
      })
      .select("id")
      .single();
    assert.ifError(error);
    assert.ok(neg, "Negotiation record must be created");
    return neg.id as string;
  }

  it("1. An approval for negotiation A cannot authorize a payment for negotiation B", async () => {
    const fixture = await setupIsolatedTestFixture(1000000);
    try {
      const { business, policy, contract } = fixture;
      const testAmount = Math.max(
        60000,
        Number(policy?.max_auto_transaction || 2000) + 5000,
      );

      const negAId = await createTestNegotiation(
        business.id,
        testAmount + 1000,
        testAmount,
        contract.id,
      );
      const negBId = await createTestNegotiation(
        business.id,
        testAmount + 1000,
        testAmount,
        contract.id,
      );

      // Create valid human approval specifically for negotiation A
      const created = await createApprovalRecord(supabase, {
        businessId: business.id,
        negotiationId: negAId,
        status: "approved",
        reason: "Approved specifically for negotiation A",
        decidedAt: new Date().toISOString(),
        amount: testAmount,
      });
      assert.ifError(created.error);
      assert.ok(created.id, "Approval record created");

      // Attempt to authorize payment for negotiation B against negotiation A's approval
      const auth = await verifyPolicyExecutionAuthorization(business.id, {
        amount: testAmount,
        savings: 1000,
        category: "software",
        negotiationId: negBId,
      });

      assert.equal(
        auth.authorized,
        false,
        "Negotiation B must NOT be authorized by negotiation A's approval",
      );
      assert.equal(auth.decision, "needs_human");
      assert.match(
        auth.reason,
        /lacks an unused, valid human approval record/i,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("2. An approval for $2,500 cannot authorize a $250,000 payment", async () => {
    const fixture = await setupIsolatedTestFixture(1000000);
    try {
      const { business, contract } = fixture;
      const negId = await createTestNegotiation(
        business.id,
        3000,
        2500,
        contract.id,
      );

      // Create approval specifically for $2,500
      const created = await createApprovalRecord(supabase, {
        businessId: business.id,
        negotiationId: negId,
        status: "approved",
        reason: "Approved only for $2,500 renewal tier",
        decidedAt: new Date().toISOString(),
        amount: 2500,
      });
      assert.ifError(created.error);
      assert.ok(created.id);

      // 1. Exact case from requirements: approval for $2,500 cannot authorize a $250,000 payment
      const auth250k = await verifyPolicyExecutionAuthorization(business.id, {
        amount: 250000,
        savings: 5000,
        category: "software",
        negotiationId: negId,
      });

      assert.equal(
        auth250k.authorized,
        false,
        "$2,500 approval must NOT authorize a $250,000 payment",
      );

      // 2. Also test an amount exceeding $2,500 approval that is within treasury balance (e.g. $15,000)
      // to specifically verify the approval amount threshold logic in verifyPolicyExecutionAuthorization
      const auth15k = await verifyPolicyExecutionAuthorization(business.id, {
        amount: 15000,
        savings: 2500,
        category: "software",
        negotiationId: negId,
      });

      assert.equal(
        auth15k.authorized,
        false,
        "$2,500 approval must NOT authorize a $15,000 payment",
      );
      assert.equal(auth15k.decision, "needs_human");
      assert.match(auth15k.reason, /approved amount >= transaction amount/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("3. A used approval cannot be reused (single-use enforcement via used_at)", async () => {
    const fixture = await setupIsolatedTestFixture(1000000);
    try {
      const { business, contract } = fixture;
      const negId = await createTestNegotiation(
        business.id,
        5000,
        4000,
        contract.id,
      );

      const created = await createApprovalRecord(supabase, {
        businessId: business.id,
        negotiationId: negId,
        status: "approved",
        reason: "Single-use approval for contract payment",
        decidedAt: new Date().toISOString(),
        amount: 4000,
      });
      assert.ifError(created.error);
      assert.ok(created.id);

      // First verification: should succeed and atomically stamp used_at
      const firstAuth = await verifyPolicyExecutionAuthorization(business.id, {
        amount: 4000,
        savings: 800,
        category: "cloud",
        negotiationId: negId,
      });

      assert.equal(
        firstAuth.authorized,
        true,
        "First authorization attempt should succeed",
      );
      assert.equal(firstAuth.decision, "approved");

      // Verify the row was stamped with used_at
      const { data: updatedRow } = await supabase
        .from("approvals")
        .select("used_at, reason")
        .eq("id", created.id)
        .single();
      assert.ok(
        updatedRow?.used_at !== null || updatedRow?.reason?.includes("[USED"),
        "Approval must be marked as used in DB",
      );

      // Second verification: must fail because approval is single-use
      const secondAuth = await verifyPolicyExecutionAuthorization(business.id, {
        amount: 4000,
        savings: 800,
        category: "cloud",
        negotiationId: negId,
      });

      assert.equal(
        secondAuth.authorized,
        false,
        "Reusing a used approval must be rejected",
      );
      assert.equal(secondAuth.decision, "needs_human");
      assert.match(
        secondAuth.reason,
        /lacks an unused, valid human approval record/i,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("4. create_escrow with neither contractId nor negotiationId is rejected outright", async () => {
    const fixture = await setupIsolatedTestFixture(1000000);
    try {
      const { business } = fixture;
      const tools = createAgentTools({ businessId: business.id });

      // Call create_escrow without contractId and without negotiationId.
      // Invariant: Payments with neither contractId nor negotiationId are rejected outright.
      await assert.rejects(async () => {
        await (tools.create_escrow as any).execute(
          {
            amount: 1200,
            vendorWallet: "0x000000000000000000000000000000000000dEaD",
            idempotencyKey: `test-no-contract-${Date.now()}`,
            category: "software",
            // contractId omitted!
            // negotiationId omitted!
          },
          { messages: [], toolCallId: "t-no-contract" },
        );
      }, /Policy refusal: Transaction rejected: create_escrow requires a contractId or negotiationId/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("5. Exploit test: approve $500 once, then successfully pay $50,000 against it now FAILS", async () => {
    const fixture = await setupIsolatedTestFixture(1000000);
    try {
      const { business, contract } = fixture;
      const exploitNegId = await createTestNegotiation(
        business.id,
        600,
        500,
        contract.id,
      );

      // Attacker gets a low $500 approval approved
      const created = await createApprovalRecord(supabase, {
        businessId: business.id,
        negotiationId: exploitNegId,
        status: "approved",
        reason: "Small $500 pilot approval",
        decidedAt: new Date().toISOString(),
        amount: 500,
      });
      assert.ifError(created.error);
      assert.ok(created.id);

      // Exploit Attempt A: Attacker attempts to withdraw $50,000 referencing the $500 approval's negotiationId
      const authTargeted = await verifyPolicyExecutionAuthorization(
        business.id,
        {
          amount: 50000,
          savings: 5000,
          category: "cloud",
          negotiationId: exploitNegId,
        },
      );

      assert.equal(
        authTargeted.authorized,
        false,
        "Exploit with $500 approval targeting $50,000 must fail",
      );
      assert.equal(authTargeted.decision, "needs_human");
      assert.match(
        authTargeted.reason,
        /approved amount >= transaction amount/i,
      );

      // Exploit Attempt B: Attacker omits negotiationId entirely hoping for a business-wide fallback
      const authOmitted = await verifyPolicyExecutionAuthorization(
        business.id,
        {
          amount: 50000,
          savings: 5000,
          category: "cloud",
          // negotiationId omitted!
        },
      );

      assert.equal(
        authOmitted.authorized,
        false,
        "Omitted negotiationId must immediately be refused",
      );
      assert.equal(authOmitted.decision, "needs_human");
      assert.match(authOmitted.reason, /lacks a linked negotiationId/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("6. calling create_escrow with savings: 1,000,000 fails min_savings because effectiveSavings is strictly derived server-side", async () => {
    const fixture = await setupIsolatedTestFixture(1000000);
    try {
      const { business } = fixture;

      // Create a real contract where current_price equals transaction amount ($1,000), meaning real savings = $0.
      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .insert({
          business_id: business.id,
          service: `Zero Margin Test ${Date.now()}`,
          category: "software",
          current_price: 1000,
          renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          status: "active",
        })
        .select()
        .single();
      assert.ok(contract && !cErr);

      const tools = createAgentTools({ businessId: business.id });

      // Attacker attempts to bypass min_savings ($200 threshold) by injecting `savings: 1000000`.
      await assert.rejects(async () => {
        await (tools.create_escrow as any).execute(
          {
            contractId: contract.id,
            amount: 1000,
            vendorWallet: "0x000000000000000000000000000000000000dEaD",
            category: "software",
            savings: 1000000, // <--- ATTACK VECTOR: Caller attempts to inject massive savings
          },
          { messages: [], toolCallId: "t-caller-savings-exploit" },
        );
      }, /Policy refusal: Transaction rejected by policy: .*savings \(\$0\) does not meet minimum policy threshold/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("7. calling create_escrow with a contract derives effectiveSavings strictly server-side, ignoring caller-supplied savings", async () => {
    const fixture = await setupIsolatedTestFixture(1000000);
    try {
      const { business } = fixture;

      // Create contract with current_price $2,500
      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .insert({
          business_id: business.id,
          service: `Savings Tamper Test ${Date.now()}`,
          category: "software",
          current_price: 2500,
          renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          status: "active",
        })
        .select()
        .single();
      assert.ok(contract && !cErr);

      const negId = await createTestNegotiation(
        business.id,
        2500,
        1500,
        contract.id,
      );

      const tools = createAgentTools({ businessId: business.id });

      // Execute create_escrow for amount $1,500 (real savings = $2,500 - $1,500 = $1,000 >= $200 min_savings).
      // Caller maliciously tries to pass `savings: 50` (which would fail min_savings if caller input were respected).
      const result = await (tools.create_escrow as any).execute(
        {
          contractId: contract.id,
          negotiationId: negId,
          amount: 1500,
          vendorWallet: "0x1111111111111111111111111111111111111111",
          savings: 50, // <--- Tampered value (fails min_savings $200), must be completely ignored!
        },
        { messages: [], toolCallId: "t-tamper-check" },
      );

      assert.equal(result.success, true);
      assert.equal(
        result.savings,
        1000,
        "create_escrow result must report 1000 savings derived from contract price delta, ignoring 50",
      );

      // Verify in agent_actions table: logged input must have savings: 1000
      const { data: actions } = await supabase
        .from("agent_actions")
        .select("input")
        .eq("business_id", business.id)
        .eq("action", "create_escrow")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      assert.ok(actions);
      assert.equal(
        (actions.input as any)?.savings,
        1000,
        "Agent action audit trail must record 1000 savings, NOT the tampered 50",
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("8. A payment request exceeding available treasury balance is strictly rejected by deterministic policy even with valid approval", async () => {
    // Set up an isolated business with a known, modest treasury balance of $5,000
    const fixture = await setupIsolatedTestFixture(5000);
    const { business, contract } = fixture;

    // Create a negotiation and an explicit approval for $7,500
    const negId = await createTestNegotiation(
      business.id,
      9000,
      7500,
      contract.id,
    );
    const created = await createApprovalRecord(supabase, {
      businessId: business.id,
      negotiationId: negId,
      status: "approved",
      reason: "Manager approved $7,500 spend",
      decidedAt: new Date().toISOString(),
      amount: 7500,
    });
    assert.ifError(created.error);
    assert.ok(created.id);

    try {
      // Direct policy authorization verification: $7,500 requested > $5,000 treasury
      const auth = await verifyPolicyExecutionAuthorization(business.id, {
        amount: 7500,
        savings: 1500,
        category: "software",
        negotiationId: negId,
      });

      assert.equal(
        auth.authorized,
        false,
        "Transaction exceeding treasury balance must never be authorized",
      );
      assert.equal(auth.decision, "rejected");
      assert.match(auth.reason, /insufficient treasury balance/i);

      // Also verify via create_escrow tool execution: must throw policy refusal
      const tools = createAgentTools({ businessId: business.id });
      await assert.rejects(async () => {
        await (tools.create_escrow as any).execute({
          contractId: contract.id,
          negotiationId: negId,
          amount: 7500,
          vendorWallet: "0x1111111111111111111111111111111111111111",
          category: "software",
          savings: 1500,
          idempotencyKey: `treasury-check-test-${Date.now()}`,
        });
      }, /Policy refusal: Transaction rejected by policy: .*insufficient treasury balance/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});

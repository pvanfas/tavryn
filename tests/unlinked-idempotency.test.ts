import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getServiceSupabase } from "@/lib/supabase";
import { create_escrow } from "@/lib/tools";

describe("Unlinked Transaction Idempotency Tests", () => {
  const supabase = getServiceSupabase();

  it("1. create_escrow rejects outright when neither contractId nor negotiationId is provided", async () => {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .single();
    assert.ok(business, "Business must exist");

    await assert.rejects(async () => {
      await (create_escrow as any).execute(
        {
          amount: 1000,
          vendorWallet: "0x000000000000000000000000000000000000dEaD",
          category: "software",
          businessId: business.id,
          // Both contractId and negotiationId omitted!
        },
        { messages: [], toolCallId: "t-reject-unlinked" },
      );
    }, /Policy refusal: Transaction rejected: create_escrow requires a contractId or negotiationId/i);
  });

  it("2. Two sequential create_escrow calls for the same contract with no negotiation_id, amounts differing by $0.01, result in exactly one non-failed transaction", async () => {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .single();
    assert.ok(business, "Business must exist");

    // Create a contract with enough savings to pass min_savings ($2,000 current price vs $1,000 tx = $1,000 savings)
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        business_id: business.id,
        service: `Unlinked Contract Idempotency Test ${Date.now()}`,
        category: "software",
        current_price: 2000,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select()
      .single();
    assert.ok(contract && !cErr, "Contract created");

    try {
      // Call 1: amount = 1000.00
      const res1 = await (create_escrow as any).execute(
        {
          contractId: contract.id,
          amount: 1000,
          vendorWallet: "0x1234567890123456789012345678901234567890",
          category: "software",
          businessId: business.id,
          // negotiationId explicitly omitted
        },
        { messages: [], toolCallId: "t-unlinked-1" },
      );

      assert.equal(res1.success, true);
      assert.ok(res1.transactionId);
      assert.equal(res1.idempotentHit, false);

      // Call 2: amount = 1000.01 (differs by $0.01, producing a distinct SHA-256 idempotency key)
      const res2 = await (create_escrow as any).execute(
        {
          contractId: contract.id,
          amount: 1000.01,
          vendorWallet: "0x1234567890123456789012345678901234567890",
          category: "software",
          businessId: business.id,
          // negotiationId explicitly omitted
        },
        { messages: [], toolCallId: "t-unlinked-2" },
      );

      assert.equal(res2.success, true);
      assert.equal(
        res2.idempotentHit,
        true,
        "Second call differing by $0.01 must be recognized as an idempotent hit",
      );
      assert.equal(
        res2.transactionId,
        res1.transactionId,
        "Second call must return the existing transaction ID",
      );

      // Query database directly to confirm exactly one non-failed transaction exists
      const { data: dbTxs } = await supabase
        .from("transactions")
        .select("id, amount, status, negotiation_id")
        .eq("contract_id", contract.id)
        .is("negotiation_id", null)
        .not("status", "eq", "failed");

      assert.ok(dbTxs);
      assert.equal(
        dbTxs.length,
        1,
        "Database must contain exactly 1 non-failed transaction for the contract",
      );
      assert.equal(dbTxs[0].id, res1.transactionId);
      assert.equal(dbTxs[0].negotiation_id, null);
    } finally {
      await supabase
        .from("transactions")
        .delete()
        .eq("contract_id", contract.id);
      await supabase.from("contracts").delete().eq("id", contract.id);
    }
  });

  it("3. Concurrent create_escrow calls differing by $0.01 for the same contract resolve to exactly one non-failed transaction via database partial unique index", async () => {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .single();
    assert.ok(business, "Business must exist");

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        business_id: business.id,
        service: `Concurrent Unlinked Test ${Date.now()}`,
        category: "software",
        current_price: 2500,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select()
      .single();
    assert.ok(contract && !cErr, "Contract created");

    try {
      // Fire two concurrent calls differing by $0.01 simultaneously
      const [resA, resB] = await Promise.all([
        (create_escrow as any).execute(
          {
            contractId: contract.id,
            amount: 1200.0,
            vendorWallet: "0x2222222222222222222222222222222222222222",
            category: "software",
            businessId: business.id,
          },
          { messages: [], toolCallId: "t-race-a" },
        ),
        (create_escrow as any).execute(
          {
            contractId: contract.id,
            amount: 1200.01,
            vendorWallet: "0x2222222222222222222222222222222222222222",
            category: "software",
            businessId: business.id,
          },
          { messages: [], toolCallId: "t-race-b" },
        ),
      ]);

      assert.equal(resA.success, true);
      assert.equal(resB.success, true);

      // One must be the original winner and the other must be an idempotent hit referencing the winner
      const winnerId = resA.transactionId;
      assert.equal(
        resB.transactionId,
        winnerId,
        "Both concurrent calls must resolve to the identical transaction ID",
      );

      // Verify in PostgreSQL table: strictly 1 non-failed row exists
      const { data: dbTxs } = await supabase
        .from("transactions")
        .select("id, status, negotiation_id")
        .eq("contract_id", contract.id)
        .is("negotiation_id", null)
        .not("status", "eq", "failed");

      assert.ok(dbTxs);
      assert.equal(
        dbTxs.length,
        1,
        "Postgres partial unique index must enforce exactly 1 non-failed transaction row in DB",
      );
      assert.equal(dbTxs[0].id, winnerId);
    } finally {
      await supabase
        .from("transactions")
        .delete()
        .eq("contract_id", contract.id);
      await supabase.from("contracts").delete().eq("id", contract.id);
    }
  });
});

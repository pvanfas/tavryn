import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { getServiceSupabase } from "../lib/supabase";
import { create_escrow } from "../lib/tools";

describe("Double-Payment Defense & Concurrency Hardening", () => {
  let businessId: string;
  let contractId: string;
  let testNegotiationId: string;

  before(async () => {
    const supabase = getServiceSupabase();

    // 1. Get or create a test business
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("name", "Demo Co")
      .single();

    assert.ok(business, "Demo Co must exist");
    businessId = business.id;

    // 2. Get a contract
    const { data: contract } = await supabase
      .from("contracts")
      .select("id")
      .eq("business_id", businessId)
      .limit(1)
      .single();

    assert.ok(contract, "Test contract must exist");
    contractId = contract.id;

    // 3. Create a unique test negotiation row
    const { data: neg, error } = await supabase
      .from("negotiations")
      .insert({
        contract_id: contractId,
        original_price: 5000,
        target_price: 4000,
        current_offer: 4000,
        final_price: 4000,
        savings: 1000,
        status: "agreed",
      })
      .select("id")
      .single();

    assert.ok(neg && !error, "Test negotiation record created");
    testNegotiationId = neg.id;
  });

  it("1. Retries with same negotiationId return the existing transaction as idempotent hit", async () => {
    const res1 = await (create_escrow as any).execute({
      amount: 4000,
      contractId,
      negotiationId: testNegotiationId,
    });

    assert.ok(res1.success);
    assert.ok(res1.transactionId);

    // Call again with retry
    const res2 = await (create_escrow as any).execute({
      amount: 4000,
      contractId,
      negotiationId: testNegotiationId,
    });

    assert.equal(res2.idempotentHit, true);
    assert.equal(res2.transactionId, res1.transactionId);

    // Call third time with slightly altered amount on same negotiation
    const res3 = await (create_escrow as any).execute({
      amount: 3950,
      contractId,
      negotiationId: testNegotiationId,
    });

    assert.equal(res3.idempotentHit, true);
    assert.equal(res3.transactionId, res1.transactionId);
  });

  it("2. Concurrent calls (Promise.all) resolve to exactly one transaction record in database", async () => {
    const supabase = getServiceSupabase();

    // Create another negotiation specifically for concurrency test
    const { data: concurrentNeg } = await supabase
      .from("negotiations")
      .insert({
        contract_id: contractId,
        original_price: 8000,
        target_price: 6500,
        current_offer: 6500,
        final_price: 6500,
        savings: 1500,
        status: "agreed",
      })
      .select("id")
      .single();

    assert.ok(concurrentNeg);

    // Fire 5 concurrent payment attempts simultaneously
    const results = await Promise.all([
      (create_escrow as any).execute({
        amount: 6500,
        contractId,
        negotiationId: concurrentNeg.id,
      }),
      (create_escrow as any).execute({
        amount: 6500,
        contractId,
        negotiationId: concurrentNeg.id,
      }),
      (create_escrow as any).execute({
        amount: 6500,
        contractId,
        negotiationId: concurrentNeg.id,
      }),
      (create_escrow as any).execute({
        amount: 6500,
        contractId,
        negotiationId: concurrentNeg.id,
      }),
      (create_escrow as any).execute({
        amount: 6500,
        contractId,
        negotiationId: concurrentNeg.id,
      }),
    ]);

    // All must succeed
    results.forEach((r) => assert.equal(r.success, true));

    // Every concurrent result must point to the identical transactionId
    const firstTxId = results[0].transactionId;
    results.forEach((r) => assert.equal(r.transactionId, firstTxId));

    // Verify database row count for this negotiation is strictly 1
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("negotiation_id", concurrentNeg.id)
      .not("status", "eq", "failed");

    assert.equal(
      count,
      1,
      "Exactly one active/funded transaction must exist in DB for this negotiation",
    );

    // Clean up concurrent test records
    await supabase
      .from("transactions")
      .delete()
      .eq("negotiation_id", concurrentNeg.id);
    await supabase.from("negotiations").delete().eq("id", concurrentNeg.id);
  });

  after(async () => {
    const supabase = getServiceSupabase();
    if (testNegotiationId) {
      await supabase
        .from("transactions")
        .delete()
        .eq("negotiation_id", testNegotiationId);
      await supabase.from("negotiations").delete().eq("id", testNegotiationId);
    }
  });
});

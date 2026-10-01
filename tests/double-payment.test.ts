import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  ARC_CONFIG,
  createArcEscrowAgreement,
  fundArcEscrowAgreement,
} from "../lib/circle";
import { SIMULATED_VENDOR_WALLET } from "../lib/constants";
import { getServiceSupabase } from "../lib/supabase";
import {
  computeEscrowIdempotencyKey,
  create_escrow,
  isDefinitiveOnChainFailure,
} from "../lib/tools";

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

  it("3. Caller-supplied idempotencyKey is completely ignored and overridden by server-derived SHA-256 key", async () => {
    const supabase = getServiceSupabase();

    const { data: clientNeg } = await supabase
      .from("negotiations")
      .insert({
        contract_id: contractId,
        original_price: 6000,
        target_price: 4500,
        current_offer: 4500,
        final_price: 4500,
        savings: 1500,
        status: "agreed",
      })
      .select("id")
      .single();

    assert.ok(clientNeg);

    const expectedServerKey = computeEscrowIdempotencyKey({
      businessId,
      contractId,
      negotiationId: clientNeg.id,
      amount: 4500,
    });

    const maliciousClientKey = "attacker-custom-client-key-1234567890";

    const res1 = await (create_escrow as any).execute({
      amount: 4500,
      contractId,
      negotiationId: clientNeg.id,
      idempotencyKey: maliciousClientKey, // Malicious / caller-supplied key
    });

    assert.equal(res1.success, true);
    assert.equal(res1.idempotencyKey, expectedServerKey);
    assert.notEqual(res1.idempotencyKey, maliciousClientKey);

    const { data: dbTx } = await supabase
      .from("transactions")
      .select("idempotency_key")
      .eq("id", res1.transactionId)
      .single();

    assert.equal(dbTx?.idempotency_key, expectedServerKey);
    assert.notEqual(dbTx?.idempotency_key, maliciousClientKey);

    // Call again with a completely different caller key -> still matches server key and returns idempotent hit
    const differentClientKey = "another-custom-key-999999999";
    const res2 = await (create_escrow as any).execute({
      amount: 4500,
      contractId,
      negotiationId: clientNeg.id,
      idempotencyKey: differentClientKey,
    });

    assert.equal(res2.idempotentHit, true);
    assert.equal(res2.transactionId, res1.transactionId);
    assert.equal(res2.idempotencyKey, expectedServerKey);

    // Cleanup
    await supabase
      .from("transactions")
      .delete()
      .eq("negotiation_id", clientNeg.id);
    await supabase.from("negotiations").delete().eq("id", clientNeg.id);
  });

  it("4. Crash simulation before DB write resolves: Call 1 leaves pending, Call 2 reconciles, at most one on-chain transfer happens", async () => {
    const supabase = getServiceSupabase();

    const { data: crashNeg } = await supabase
      .from("negotiations")
      .insert({
        contract_id: contractId,
        original_price: 7000,
        target_price: 5200,
        current_offer: 5200,
        final_price: 5200,
        savings: 1800,
        status: "agreed",
      })
      .select("id")
      .single();

    assert.ok(crashNeg);

    const idempotencyKey = computeEscrowIdempotencyKey({
      businessId,
      contractId,
      negotiationId: crashNeg.id,
      amount: 5200,
    });

    // Simulate Call 1: Process creates and funds agreement on ArcEscrow,
    // and inserts 'pending' row in DB, but the process dies BEFORE updating DB status to 'funded'
    // (simulating a network crash or server termination right after chain funding).
    const createRes = await createArcEscrowAgreement({
      vendorWallet: SIMULATED_VENDOR_WALLET,
      amount: 5200,
      category: "software",
      idempotencyKey,
    });

    const fundRes = await fundArcEscrowAgreement({
      agreementId: createRes.agreementId,
      amount: 5200,
    });

    // DB row is inserted as 'pending' (the state before the DB update to 'funded' resolved)
    const { data: pendingTx, error: insErr } = await supabase
      .from("transactions")
      .insert({
        business_id: businessId,
        contract_id: contractId,
        negotiation_id: crashNeg.id,
        amount: 5200,
        currency: "USDC",
        escrow_address: ARC_CONFIG.escrowContractAddress,
        status: "pending",
        idempotency_key: idempotencyKey,
        tx_hash: fundRes.txHash || null,
      })
      .select()
      .single();

    assert.ok(pendingTx && !insErr, "Pending transaction seeded");
    assert.equal(pendingTx.status, "pending");

    // Call 2: Client retries with identical inputs
    const res2 = await (create_escrow as any).execute({
      amount: 5200,
      contractId,
      negotiationId: crashNeg.id,
    });

    // Call 2 must NOT create a new agreement or double-send funds.
    // It must reconcile the existing pending transaction to 'funded'.
    assert.equal(res2.success, true);
    assert.equal(res2.idempotentHit, true);
    assert.equal(res2.transactionId, pendingTx.id);

    // Verify DB row was reconciled to funded (or simulation-only)
    const { data: reconciledTx } = await supabase
      .from("transactions")
      .select("status, idempotency_key")
      .eq("id", pendingTx.id)
      .single();

    assert.ok(
      reconciledTx?.status === "funded" ||
        reconciledTx?.status === "simulation-only",
      `Transaction status should be funded or simulation-only, got: ${reconciledTx?.status}`,
    );

    // Verify database count for this negotiation is strictly 1
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("negotiation_id", crashNeg.id)
      .not("status", "eq", "failed");

    assert.equal(
      count,
      1,
      "Exactly ONE transaction must exist across both calls",
    );

    // Cleanup
    await supabase
      .from("transactions")
      .delete()
      .eq("negotiation_id", crashNeg.id);
    await supabase.from("negotiations").delete().eq("id", crashNeg.id);
  });

  it("5. Definitive failures transition to 'failed' while ambiguous timeouts preserve 'pending'", async () => {
    const supabase = getServiceSupabase();

    // 5a. Definitive failure check
    assert.equal(
      isDefinitiveOnChainFailure(
        new Error("execution reverted: AgentNotAuthorized"),
      ),
      true,
    );
    assert.equal(
      isDefinitiveOnChainFailure(
        new Error("insufficient funds for gas * price + value"),
      ),
      true,
    );
    assert.equal(
      isDefinitiveOnChainFailure(new Error("CategoryBudgetExceeded")),
      true,
    );

    // 5b. Ambiguous timeout check
    assert.equal(
      isDefinitiveOnChainFailure(new Error("ETIMEDOUT: 504 Gateway Timeout")),
      false,
    );
    assert.equal(
      isDefinitiveOnChainFailure(new Error("fetch failed: socket hang up")),
      false,
    );
    assert.equal(
      isDefinitiveOnChainFailure(new Error("Request timed out after 30000ms")),
      false,
    );

    // 5c. End-to-end: Seeding a pending transaction with ambiguous status blocks duplicate payment retry
    const { data: timeoutNeg } = await supabase
      .from("negotiations")
      .insert({
        contract_id: contractId,
        original_price: 9000,
        target_price: 7500,
        current_offer: 7500,
        final_price: 7500,
        savings: 1500,
        status: "agreed",
      })
      .select("id")
      .single();

    assert.ok(timeoutNeg);

    const timeoutKey = computeEscrowIdempotencyKey({
      businessId,
      contractId,
      negotiationId: timeoutNeg.id,
      amount: 7500,
    });

    // Insert pending transaction (left pending due to ambiguous timeout)
    const { data: pendingTx } = await supabase
      .from("transactions")
      .insert({
        business_id: businessId,
        contract_id: contractId,
        negotiation_id: timeoutNeg.id,
        amount: 7500,
        currency: "USDC",
        escrow_address: ARC_CONFIG.escrowContractAddress,
        status: "pending",
        idempotency_key: timeoutKey,
      })
      .select()
      .single();

    assert.ok(pendingTx);

    // If on-chain status is undetermined in live mode, retry must refuse duplicate execution
    // (In simulation mode, reconcilePendingEscrow reconciles cleanly)
    const retryRes = await (create_escrow as any).execute({
      amount: 7500,
      contractId,
      negotiationId: timeoutNeg.id,
    });

    assert.equal(retryRes.idempotentHit, true);
    assert.equal(retryRes.transactionId, pendingTx.id);

    // Verify database count for this negotiation is strictly 1
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("negotiation_id", timeoutNeg.id)
      .not("status", "eq", "failed");

    assert.equal(count, 1);

    // Cleanup
    await supabase
      .from("transactions")
      .delete()
      .eq("negotiation_id", timeoutNeg.id);
    await supabase.from("negotiations").delete().eq("id", timeoutNeg.id);
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

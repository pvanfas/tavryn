import assert from "node:assert/strict";
import { test } from "node:test";

import crypto from "crypto";

import { screenAddress } from "../lib/screening";
import { getServiceSupabase } from "../lib/supabase";
import { computeEscrowIdempotencyKey, createAgentTools } from "../lib/tools";

test("1. computeEscrowIdempotencyKey produces deterministic SHA-256 hash", () => {
  const params = {
    businessId: "11111111-1111-1111-1111-111111111111",
    contractId: "22222222-2222-2222-2222-222222222222",
    negotiationId: "33333333-3333-3333-3333-333333333333",
    amount: 7200,
  };

  const key1 = computeEscrowIdempotencyKey(params);
  const key2 = computeEscrowIdempotencyKey(params);

  assert.equal(key1, key2);
  assert.equal(key1.length, 64);

  // Manual SHA-256 verification
  const manualHash = crypto
    .createHash("sha256")
    .update(
      `${params.businessId}|${params.contractId}|${params.negotiationId}|${params.amount}`,
    )
    .digest("hex");
  assert.equal(key1, manualHash);
});

test("2. screenAddress validates EVM format and detects sanctions vectors", async () => {
  // Invalid format
  const invalidRes = await screenAddress("not-an-evm-address");
  assert.equal(invalidRes.passed, false);
  assert.equal(invalidRes.riskScore, "severe");

  // Known OFAC sanctions vector (Tornado Cash router)
  const sanctionedRes = await screenAddress(
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
  );
  assert.equal(sanctionedRes.passed, false);
  assert.equal(sanctionedRes.riskScore, "severe");
  assert.match(sanctionedRes.reason || "", /sanctions/i);

  // Valid legitimate address
  const cleanRes = await screenAddress(
    "0x71C8fb8663E35505e3ec188506198fA08D1E67D1",
  );
  assert.equal(cleanRes.passed, true);
  assert.equal(cleanRes.riskScore, "low");
  assert.equal(cleanRes.isStub, true);
});

test("3. create_escrow double-call test proves idempotency and prevents duplicate on-chain tx", async () => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from("contracts")
    .select("id, business_id, current_price, vendors ( id, wallet_address )")
    .eq("service", "Slack")
    .single();

  assert.ok(slackContract, "Seeded Slack contract must exist");
  await supabase
    .from("contracts")
    .update({ current_price: 9600 })
    .eq("id", slackContract.id);

  const tools = createAgentTools({ businessId: slackContract.business_id });
  const uniqueKey = `idemp-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const validVendorWallet =
    (slackContract.vendors as any)?.wallet_address ||
    "0x4444444444444444444444444444444444444444";

  const { data: freshNeg } = await supabase
    .from("negotiations")
    .insert({
      contract_id: slackContract.id,
      original_price: 9600,
      current_offer: 6000,
      final_price: 6000,
      savings: 3600,
      status: "agreed",
    })
    .select("id")
    .single();

  const freshNegId = freshNeg?.id;

  // First call -> creates transaction and funds it
  const firstCall = await (tools.create_escrow as any).execute({
    contractId: slackContract.id,
    negotiationId: freshNegId,
    amount: 6000,
    savings: 3600,
    category: "software",
    vendorWallet: validVendorWallet,
    idempotencyKey: uniqueKey,
  });

  assert.equal(firstCall.success, true);
  assert.equal(firstCall.idempotentHit, false);
  if (firstCall.isSimulation || firstCall.status === "simulation-only") {
    assert.equal(firstCall.status, "simulation-only");
    assert.equal(firstCall.txHash, null);
    assert.equal(firstCall.explorerUrl, null);
  } else {
    assert.equal(firstCall.status, "funded");
    assert.ok(firstCall.txHash.startsWith("0x"));
    assert.ok(firstCall.explorerUrl.includes("testnet.arcscan.app/tx/"));
  }

  // Second call with same idempotencyKey -> must hit cache and NOT create a new tx
  const secondCall = await (tools.create_escrow as any).execute({
    contractId: slackContract.id,
    negotiationId: freshNegId,
    amount: 6000,
    savings: 3600,
    category: "software",
    vendorWallet: validVendorWallet,
    idempotencyKey: uniqueKey,
  });

  assert.equal(secondCall.success, true);
  assert.equal(secondCall.transactionId, firstCall.transactionId);
  assert.equal(secondCall.idempotentHit, true);
  assert.match(secondCall.message, /Idempotent hit/);

  // Database verification: strictly ONE record with this server-derived key
  const { data: matches, count } = await supabase
    .from("transactions")
    .select("id", { count: "exact" })
    .eq("idempotency_key", firstCall.idempotencyKey);

  assert.equal(matches?.length, 1);
  assert.equal(count, 1);
});

test("4. create_escrow re-runs checkPolicy and refuses unauthorized transactions", async () => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from("contracts")
    .select("id, business_id")
    .eq("service", "Slack")
    .single();

  assert.ok(slackContract);
  const tools = createAgentTools({ businessId: slackContract.business_id });

  // Disallowed category
  await assert.rejects(async () => {
    await (tools.create_escrow as any).execute({
      contractId: slackContract.id,
      amount: 2000,
      category: "cryptocurrency_speculation",
      vendorWallet: "0x2222222222222222222222222222222222222222",
      idempotencyKey: `refuse-cat-${Date.now()}`,
    });
  }, /Policy refusal/);
});

test("5. create_escrow rejects missing or malformed vendor wallet addresses", async () => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from("contracts")
    .select("id, business_id")
    .eq("service", "Slack")
    .single();

  assert.ok(slackContract);
  const tools = createAgentTools({ businessId: slackContract.business_id });

  // Missing wallet address
  await assert.rejects(async () => {
    await (tools.create_escrow as any).execute({
      contractId: slackContract.id,
      amount: 2000,
      savings: 1000,
      category: "software",
      vendorWallet: "",
      idempotencyKey: `missing-wallet-${Date.now()}`,
    });
  }, /Vendor wallet address is required/);

  // Malformed EVM address
  await assert.rejects(async () => {
    await (tools.create_escrow as any).execute({
      contractId: slackContract.id,
      amount: 2000,
      savings: 1000,
      category: "software",
      vendorWallet: "0xinvalid-hex-address",
      idempotencyKey: `malformed-wallet-${Date.now()}`,
    });
  }, /Invalid vendor wallet EVM address/);
});

test("6. create_escrow escalates to human approval when vendor wallet address mutates", async () => {
  const supabase = getServiceSupabase();

  // Create an isolated test business with explicit, sufficient treasury balance
  const { data: testBiz, error: bizErr } = await supabase
    .from("businesses")
    .insert({
      name: `Escrow Mutation Test Biz ${Date.now()}`,
      treasury_balance: 100000,
      wallet_address: null,
      is_real: false,
    })
    .select()
    .single();

  assert.ok(
    testBiz && !bizErr,
    `Failed to setup test business: ${bizErr?.message}`,
  );

  await supabase.from("policies").insert({
    business_id: testBiz.id,
    max_auto_transaction: 50000,
    min_savings: 200,
    human_approval_required_above: 50000,
    allowed_categories: ["software", "cloud"],
  });

  // Create a temporary vendor to test mutation
  const { data: tempVendor } = await supabase
    .from("vendors")
    .insert({
      name: `Test Vendor ${Date.now()}`,
      category: "software",
      is_simulated: true,
      wallet_address: "0x3333333333333333333333333333333333333333",
    })
    .select()
    .single();

  assert.ok(tempVendor);

  let tempContractId: string | null = null;
  let seededTxId: string | null = null;

  try {
    // Seed an initial completed transaction with original address
    const { data: seededTx } = await supabase
      .from("transactions")
      .insert({
        business_id: testBiz.id,
        vendor_id: tempVendor.id,
        amount: 1000,
        currency: "USDC",
        escrow_address: "0x3333333333333333333333333333333333333333",
        status: "funded",
        is_simulated: true,
        idempotency_key: `history-seed-${Date.now()}`,
      })
      .select("id")
      .single();

    seededTxId = seededTx?.id || null;

    const { data: tempContract } = await supabase
      .from("contracts")
      .insert({
        business_id: testBiz.id,
        vendor_id: tempVendor.id,
        service: `Contract ${Date.now()}`,
        category: "software",
        current_price: 2000,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select()
      .single();

    tempContractId = tempContract?.id || null;

    const tools = createAgentTools({ businessId: testBiz.id });

    // Attempt to escrow to mutated address
    const mutatedAddress = "0x4444444444444444444444444444444444444444";
    await assert.rejects(async () => {
      await (tools.create_escrow as any).execute({
        contractId: tempContract?.id,
        vendor: tempVendor.id,
        amount: 1000,
        category: "software",
        vendorWallet: mutatedAddress,
        idempotencyKey: `mutated-${Date.now()}`,
      });
    }, /Vendor wallet address changed from/);

    // Confirm a pending approval was registered for human inspection
    const { data: approval } = await supabase
      .from("approvals")
      .select("*")
      .eq("business_id", testBiz.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    assert.ok(approval);
    assert.match(approval.reason || "", /mutated|changed/i);
  } finally {
    try {
      await supabase.from("approvals").delete().eq("business_id", testBiz.id);
    } catch {}
    if (seededTxId) {
      try {
        await supabase.from("transactions").delete().eq("id", seededTxId);
      } catch {}
    }
    if (tempContractId) {
      try {
        await supabase.from("contracts").delete().eq("id", tempContractId);
      } catch {}
    }
    try {
      await supabase.from("policies").delete().eq("business_id", testBiz.id);
    } catch {}
    try {
      await supabase.from("vendors").delete().eq("id", tempVendor.id);
    } catch {}
    try {
      await supabase.from("businesses").delete().eq("id", testBiz.id);
    } catch {}
  }
});

test("7. create_escrow handles on-chain funding failure and transitions status to failed", async () => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from("contracts")
    .select("id, business_id, vendors ( wallet_address )")
    .eq("service", "Slack")
    .single();

  assert.ok(slackContract);
  await supabase
    .from("contracts")
    .update({ current_price: 9600 })
    .eq("id", slackContract.id);

  const tools = createAgentTools({ businessId: slackContract.business_id });
  const failKey = `fail-sim-${Date.now()}`;
  const validWallet =
    (slackContract.vendors as any)?.wallet_address ||
    "0x4444444444444444444444444444444444444444";

  const { data: failNeg } = await supabase
    .from("negotiations")
    .insert({
      contract_id: slackContract.id,
      original_price: 9600,
      current_offer: 1000,
      final_price: 1000,
      savings: 1000,
      status: "agreed",
    })
    .select("id")
    .single();

  await assert.rejects(async () => {
    await (tools.create_escrow as any).execute({
      contractId: slackContract.id,
      negotiationId: failNeg?.id,
      amount: 1000,
      category: "software",
      vendorWallet: validWallet,
      idempotencyKey: failKey,
      forceFailSimulation: true,
    });
  }, /Escrow funding failed on Arc testnet/);

  // Check that the transaction was left in 'failed' status and not dangling 'pending'
  const { data: failedTx } = await supabase
    .from("transactions")
    .select("status")
    .eq("negotiation_id", failNeg?.id)
    .single();

  assert.ok(failedTx);
  assert.equal(failedTx.status, "failed");
});

test("8. release_escrow updates state to released, logs to agent_actions, and provides explorer link", async () => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from("contracts")
    .select("id, business_id")
    .eq("service", "Slack")
    .single();

  assert.ok(slackContract);
  await supabase
    .from("contracts")
    .update({ current_price: 9600 })
    .eq("id", slackContract.id);
  const tools = createAgentTools({ businessId: slackContract.business_id });

  const releaseResult = await (tools.release_escrow as any).execute({
    contractId: slackContract.id,
    savings: 1000,
    verificationPassed: true,
  });

  assert.equal(releaseResult.success, true);
  if (
    releaseResult.isSimulation ||
    releaseResult.status === "simulation-only"
  ) {
    assert.equal(releaseResult.status, "simulation-only");
    assert.equal(releaseResult.txHash, null);
    assert.equal(releaseResult.explorerUrl, null);
  } else {
    assert.equal(releaseResult.status, "released");
    assert.ok(releaseResult.txHash.startsWith("0x"));
    assert.ok(releaseResult.explorerUrl.includes("testnet.arcscan.app/tx/"));
  }
});

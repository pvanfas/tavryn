import assert from "node:assert/strict";
import test from "node:test";

import { ARC_CONFIG } from "../lib/circle";
import { createReceipt, getPublicReceipt } from "../lib/receipt";
import { getServiceSupabase } from "../lib/supabase";
import { buildEscrowTools } from "../lib/tools/escrow";

test("Stage 0036: Honest Transaction Labeling & Anti-404 Explorer Proofs", async (t) => {
  const supabase = getServiceSupabase();

  // Create isolated test business
  const { data: biz, error: bizErr } = await supabase
    .from("businesses")
    .insert({
      name: `Honest Label Test Biz ${Date.now()}`,
      treasury_balance: 50000,
      is_real: false,
    })
    .select()
    .single();

  assert.ok(biz && !bizErr, `Failed to setup test business: ${bizErr?.message}`);
  const businessId = biz.id;

  // Insert policy with high threshold and allowed categories
  await supabase.from("policies").insert({
    business_id: businessId,
    max_auto_transaction: 50000,
    min_savings: 500,
    human_approval_required_above: 50000,
    allowed_categories: ["software", "infrastructure"],
  });

  // Create isolated test vendor
  const { data: vendor } = await supabase
    .from("vendors")
    .insert({
      name: "Acme Cloud",
      category: "software",
      wallet_address: "0x1111111111111111111111111111111111111111",
      is_simulated: true,
    })
    .select()
    .single();

  assert.ok(vendor);

  // Create contract
  const { data: contract } = await supabase
    .from("contracts")
    .insert({
      business_id: businessId,
      vendor_id: vendor.id,
      service: "Acme Cloud Infrastructure",
      category: "software",
      current_price: 10000,
      seat_count: 50,
      active_seats: 50,
      status: "active",
      renewal_date: "2026-12-01",
    })
    .select()
    .single();

  assert.ok(contract);

  // Setup tools
  const tools = buildEscrowTools({
    resolveBusinessId: async () => businessId,
    getBusinessId: () => businessId,
  });

  await t.test(
    "1. create_escrow in simulation mode sets is_simulated = true and null explorerUrl",
    async () => {
      const key = `honest-sim-${Date.now()}`;
      const res = await (tools.create_escrow as any).execute({
        contractId: contract.id,
        amount: 8000,
        savings: 2000,
        category: "software",
        vendorWallet: vendor.wallet_address,
        idempotencyKey: key,
      });

      assert.equal(res.success, true);
      assert.equal(res.isSimulated, true);
      assert.equal(res.status, "simulation-only");
      assert.equal(res.explorerUrl, null);

      // Verify row in database carries explicit is_simulated = true
      const { data: txRow } = await supabase
        .from("transactions")
        .select("id, status, is_simulated, tx_hash")
        .eq("id", res.transactionId)
        .single();

      assert.ok(txRow);
      assert.equal(txRow.is_simulated, true);
      assert.equal(txRow.status, "simulation-only");
    },
  );

  await t.test(
    "2. release_escrow in simulation mode sets is_simulated = true and null explorerUrl",
    async () => {
      const { data: neg, error: negErr } = await supabase
        .from("negotiations")
        .insert({
          contract_id: contract.id,
          original_price: 10000,
          target_price: 8000,
          rounds: 1,
          final_price: 8000,
          savings: 2000,
          status: "agreed",
        })
        .select()
        .single();

      assert.ok(neg && !negErr, `Failed to create negotiation: ${negErr?.message}`);

      // Approve negotiation in policy table
      await supabase.from("approvals").insert({
        business_id: businessId,
        negotiation_id: neg.id,
        status: "approved",
        amount: 8000,
        reason: "Autonomous test approval",
      });

      // Create initial simulated escrow
      const escrowRes = await (tools.create_escrow as any).execute({
        contractId: contract.id,
        negotiationId: neg.id,
        amount: 8000,
        savings: 2000,
        category: "software",
        vendorWallet: vendor.wallet_address,
      });

      assert.equal(escrowRes.isSimulated, true);

      // Release escrow
      const releaseRes = await (tools.release_escrow as any).execute({
        contractId: contract.id,
        negotiationId: neg.id,
        transactionId: escrowRes.transactionId,
        savings: 2000,
        verificationPassed: true,
      });

      assert.equal(releaseRes.success, true);
      assert.equal(releaseRes.isSimulated, true);
      assert.equal(releaseRes.status, "simulation-only");
      assert.equal(releaseRes.explorerUrl, null);

      // Verify DB row
      const { data: txRow } = await supabase
        .from("transactions")
        .select("is_simulated, status, tx_hash")
        .eq("id", escrowRes.transactionId)
        .single();

      assert.ok(txRow);
      assert.equal(txRow.is_simulated, true);
      assert.equal(txRow.status, "simulation-only");
    },
  );

  await t.test(
    "3. refund_escrow in simulation mode sets is_simulated = true and null explorerUrl",
    async () => {
      const escrowRes = await (tools.create_escrow as any).execute({
        contractId: contract.id,
        amount: 7500,
        savings: 2500,
        category: "software",
        vendorWallet: vendor.wallet_address,
      });

      assert.ok(escrowRes.transactionId);

      const refundRes = await (tools.refund_escrow as any).execute({
        transactionId: escrowRes.transactionId,
        reason: "Simulated vendor cancellation",
      });

      assert.equal(refundRes.success, true);
      assert.equal(refundRes.isSimulated, true);
      assert.equal(refundRes.status, "refunded");
      assert.equal(refundRes.explorerUrl, null);

      const { data: txRow } = await supabase
        .from("transactions")
        .select("is_simulated, status")
        .eq("id", escrowRes.transactionId)
        .single();

      assert.ok(txRow);
      assert.equal(txRow.is_simulated, true);
      assert.equal(txRow.status, "refunded");
    },
  );

  await t.test(
    "4. Public Receipts strictly suppress dead ArcScan links when transaction is simulated",
    async () => {
      // Insert a simulated transaction that has a mock hash (e.g. from fixture or legacy mock)
      const mockHash = "0xsimulated_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const { data: simTx, error: simErr } = await supabase
        .from("transactions")
        .insert({
          business_id: businessId,
          vendor_id: vendor.id,
          contract_id: contract.id,
          amount: 8000,
          currency: "USDC",
          status: "completed",
          tx_hash: mockHash,
          is_simulated: true,
          idempotency_key: `sim-receipt-tx-${Date.now()}`,
        })
        .select()
        .single();

      assert.ok(simTx && !simErr, `Failed to create simTx: ${simErr?.message}`);

      // Create a receipt for this simulated transaction
      const receiptRow = await createReceipt({
        transactionId: simTx.id,
        businessId,
        createdBy: "system",
      });

      assert.ok(receiptRow);

      // Retrieve public receipt view model
      const receiptView = await getPublicReceipt(receiptRow.token);
      assert.ok(receiptView);

      // CRITICAL ASSERTIONS:
      // 1. isSimulated must be explicitly true
      assert.equal(receiptView.isSimulated, true);
      // 2. ArcScan releaseTxUrl must be strictly NULL — never link to testnet.arcscan.app for mock hash
      assert.equal(receiptView.arcExplorerUrls.releaseTxUrl, null);
      // 3. releaseTxHash is preserved so UI can display it as copyable text
      assert.equal(receiptView.releaseTxHash, mockHash);
      // 4. network label reflects simulated status
      assert.match(receiptView.arcExplorerUrls.network, /Simulated/);
    },
  );

  await t.test(
    "5. Public Receipts provide valid ArcScan link when transaction is real on-chain",
    async () => {
      // Real transaction with real confirmed hash
      const realHash = "0xda45a52663ed21a83ed69800770b826e9dd123f5e09c0783b189acc1907e375a";
      const { data: realTx, error: realErr } = await supabase
        .from("transactions")
        .insert({
          business_id: businessId,
          vendor_id: vendor.id,
          contract_id: contract.id,
          amount: 8500,
          currency: "USDC",
          status: "completed",
          tx_hash: realHash,
          is_simulated: false,
          idempotency_key: `real-receipt-tx-${Date.now()}`,
        })
        .select()
        .single();

      assert.ok(realTx && !realErr, `Failed to create realTx: ${realErr?.message}`);

      const receiptRow = await createReceipt({
        transactionId: realTx.id,
        businessId,
        createdBy: "system",
      });

      assert.ok(receiptRow);

      const receiptView = await getPublicReceipt(receiptRow.token);
      assert.ok(receiptView);

      // CRITICAL ASSERTIONS:
      // 1. isSimulated must be false
      assert.equal(receiptView.isSimulated, false);
      // 2. ArcScan link must be present and point to explorer
      assert.equal(
        receiptView.arcExplorerUrls.releaseTxUrl,
        `${ARC_CONFIG.explorerUrl}/tx/${realHash}`,
      );
      assert.equal(receiptView.releaseTxHash, realHash);
    },
  );

  await t.test(
    "6. Idempotent lookup of existing simulated transaction never yields an explorerUrl",
    async () => {
      const key = `idempotent-sim-check-${Date.now()}`;
      // Seed a simulated transaction with a mock hash
      const { data: seededTx, error: seedErr } = await supabase
        .from("transactions")
        .insert({
          business_id: businessId,
          vendor_id: vendor.id,
          contract_id: contract.id,
          amount: 7200,
          currency: "USDC",
          status: "funded",
          tx_hash: "0xsimulated_idempotent_hash",
          is_simulated: true,
          idempotency_key: key,
        })
        .select()
        .single();

      assert.ok(seededTx && !seedErr, `Failed to seed tx: ${seedErr?.message}`);

      const hit = await (tools.create_escrow as any).execute({
        contractId: contract.id,
        amount: 7200,
        savings: 2800,
        category: "software",
        vendorWallet: vendor.wallet_address,
        idempotencyKey: key,
      });

      assert.equal(hit.idempotentHit, true);
      assert.equal(hit.isSimulated, true);
      assert.equal(hit.explorerUrl, undefined);
    },
  );

  // Teardown
  await supabase.from("businesses").delete().eq("id", businessId);
});

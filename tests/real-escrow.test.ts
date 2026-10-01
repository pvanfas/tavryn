import assert from "node:assert/strict";
import { test } from "node:test";

import { parseUnits } from "viem";

import {
  approveArcEscrowMilestone,
  ARC_CONFIG,
  createArcEscrowAgreement,
  fundArcEscrowAgreement,
  getArcEscrowAgreement,
  getArcPublicClient,
  releaseArcEscrowPayment,
} from "../lib/circle";
import { USDC_ABI } from "../lib/contracts/arc-escrow";
import { getServiceSupabase } from "../lib/supabase";
import { createAgentTools } from "../lib/tools";

test("Real Escrow Execution & Arc Contract Verification", async (t) => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from("contracts")
    .select("id, business_id, current_price, vendors ( id, wallet_address )")
    .eq("service", "Slack")
    .single();

  assert.ok(slackContract, "Seeded Slack contract must exist");
  const businessId = slackContract.business_id;
  await supabase
    .from("contracts")
    .update({ current_price: 9600 })
    .eq("id", slackContract.id);
  slackContract.current_price = 9600;
  const tools = createAgentTools({ businessId });

  await t.test(
    "1. Fabricated hash defense: simulation mode returns simulation-only status with null txHash and null explorerUrl",
    async () => {
      const simKey = `sim-test-${Date.now()}`;
      const vendorWallet =
        (slackContract.vendors as any)?.wallet_address ||
        "0x4444444444444444444444444444444444444444";

      const { data: neg1 } = await supabase
        .from("negotiations")
        .insert({
          contract_id: slackContract.id,
          original_price: 9600,
          current_offer: 1200,
          final_price: 1200,
          savings: 800,
          status: "agreed",
        })
        .select("id")
        .single();

      const createRes = await (tools.create_escrow as any).execute({
        contractId: slackContract.id,
        negotiationId: neg1?.id,
        amount: 1200,
        savings: 800,
        category: "software",
        vendorWallet,
        idempotencyKey: simKey,
      });

      assert.equal(createRes.success, true);
      assert.equal(createRes.status, "simulation-only");
      assert.equal(
        createRes.txHash,
        null,
        "txHash must NEVER be fabricated with random bytes in simulation mode",
      );
      assert.ok(
        !createRes.explorerUrl,
        "No ArcScan link can be shown without a real on-chain transaction",
      );
      assert.equal(createRes.isSimulation, true);
      assert.equal(
        createRes.escrowAddress,
        ARC_CONFIG.escrowContractAddress,
        "Escrow address must point to contract, not vendor",
      );

      // Database verification: tx_hash is null
      const { data: txRow } = await supabase
        .from("transactions")
        .select("status, tx_hash, escrow_address")
        .eq("id", createRes.transactionId)
        .single();

      assert.ok(txRow);
      assert.equal(txRow.status, "simulation-only");
      assert.equal(txRow.tx_hash, null);
      assert.equal(txRow.escrow_address, ARC_CONFIG.escrowContractAddress);

      // Release in simulation mode also returns simulation-only with null txHash
      const releaseRes = await (tools.release_escrow as any).execute({
        transactionId: createRes.transactionId,
        contractId: slackContract.id,
        negotiationId: neg1?.id,
        verificationPassed: true,
        savings: 800,
      });

      assert.equal(releaseRes.success, true);
      assert.equal(releaseRes.status, "simulation-only");
      assert.equal(releaseRes.txHash, null);
      assert.ok(!releaseRes.explorerUrl);
    },
  );

  await t.test(
    "2. Refund path: refund_escrow handles simulation refund cleanly",
    async () => {
      const refundKey = `sim-refund-${Date.now()}`;
      const vendorWallet =
        (slackContract.vendors as any)?.wallet_address ||
        "0x4444444444444444444444444444444444444444";

      const { data: neg2 } = await supabase
        .from("negotiations")
        .insert({
          contract_id: slackContract.id,
          original_price: 9600,
          current_offer: 500,
          final_price: 500,
          savings: 500,
          status: "agreed",
        })
        .select("id")
        .single();

      const createRes = await (tools.create_escrow as any).execute({
        contractId: slackContract.id,
        negotiationId: neg2?.id,
        amount: 500,
        savings: 500,
        category: "software",
        vendorWallet,
        idempotencyKey: refundKey,
      });

      assert.equal(createRes.success, true);

      const refundRes = await (tools.refund_escrow as any).execute({
        transactionId: createRes.transactionId,
        contractId: slackContract.id,
        negotiationId: neg2?.id,
        reason:
          "Vendor failed to provide confirmation before agreement deadline",
      });

      assert.equal(refundRes.success, true);
      assert.equal(refundRes.status, "refunded");
      assert.equal(refundRes.txHash, null);
      assert.ok(!refundRes.explorerUrl);

      const { data: refundedTx } = await supabase
        .from("transactions")
        .select("status")
        .eq("id", createRes.transactionId)
        .single();

      assert.equal(refundedTx?.status, "refunded");
    },
  );

  await t.test(
    "3. Failure path: on-chain funding failure transitions status to failed and never returns fabricated success",
    async () => {
      const failKey = `fail-real-${Date.now()}`;
      const vendorWallet =
        (slackContract.vendors as any)?.wallet_address ||
        "0x4444444444444444444444444444444444444444";

      const { data: neg3 } = await supabase
        .from("negotiations")
        .insert({
          contract_id: slackContract.id,
          original_price: 9600,
          current_offer: 500,
          final_price: 500,
          savings: 500,
          status: "agreed",
        })
        .select("id")
        .single();

      await assert.rejects(async () => {
        await (tools.create_escrow as any).execute({
          contractId: slackContract.id,
          negotiationId: neg3?.id,
          amount: 500,
          savings: 500,
          category: "software",
          vendorWallet,
          idempotencyKey: failKey,
          forceFailSimulation: true,
        });
      }, /Escrow funding failed on Arc testnet/);

      const { data: failedRow } = await supabase
        .from("transactions")
        .select("status, tx_hash")
        .eq("negotiation_id", neg3?.id)
        .single();

      assert.ok(failedRow);
      assert.equal(failedRow.status, "failed");
      assert.equal(
        failedRow.tx_hash,
        null,
        "Failed transaction must never store a fabricated hash",
      );
    },
  );

  await t.test(
    "4. Live on-chain Arc testnet flow: treasury -> contract -> vendor with two ArcScan verifiable hashes",
    async () => {
      // Only run live on-chain test if ARC_PRIVATE_KEY is available and wallet has testnet USDC
      const privateKey = process.env.ARC_PRIVATE_KEY as `0x${string}`;
      if (!privateKey) {
        console.log("Skipping live chain test: ARC_PRIVATE_KEY not set");
        return;
      }

      const publicClient = getArcPublicClient();
      const escrowContract = ARC_CONFIG.escrowContractAddress as `0x${string}`;
      const usdcPrecompile = ARC_CONFIG.usdcContractAddress as `0x${string}`;
      const vendorRecipient =
        "0x000000000000000000000000000000000000dEaD" as `0x${string}`;

      // Read contract held balance before
      const contractBalanceBefore = await publicClient.readContract({
        address: usdcPrecompile,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [escrowContract],
      });

      const testAmount = 0.005; // 0.005 USDC micro-escrow for testnet proof
      const testKey = `live-escrow-${Date.now()}`;

      // 1. Create on-chain agreement
      const createRes = await createArcEscrowAgreement({
        vendorWallet: vendorRecipient,
        amount: testAmount,
        baselinePrice: testAmount,
        category: "software",
        durationSeconds: BigInt(86400),
        idempotencyKey: testKey,
        forceRealChain: true,
      });

      assert.equal(createRes.isSimulation, false);
      assert.ok(createRes.txHash?.startsWith("0x"));
      assert.ok(createRes.agreementId);

      // 2. Fund on-chain agreement: Funds move treasury -> ArcEscrow contract
      const fundRes = await fundArcEscrowAgreement({
        agreementId: createRes.agreementId,
        amount: testAmount,
        forceRealChain: true,
      });

      assert.equal(fundRes.isSimulation, false);
      assert.ok(
        fundRes.txHash?.startsWith("0x"),
        "Must return real funding tx hash",
      );

      // Verify funds entered the contract
      const contractBalanceAfterFund = await publicClient.readContract({
        address: usdcPrecompile,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [escrowContract],
      });

      const expectedUnits = parseUnits(testAmount.toFixed(6), 6);
      assert.equal(
        contractBalanceAfterFund - contractBalanceBefore,
        expectedUnits,
        "Contract held balance must increase by exact funded amount",
      );

      // Verify agreement state on-chain
      const agreementOnChain = await getArcEscrowAgreement(
        createRes.agreementId,
      );
      assert.equal(
        agreementOnChain.status,
        1,
        "Agreement status must be Funded (1)",
      );

      // 3. Approve milestone on-chain
      const approveRes = await approveArcEscrowMilestone({
        agreementId: createRes.agreementId,
        milestoneDescription: "Verified testnet delivery confirmation",
        forceRealChain: true,
      });
      assert.ok(approveRes.txHash?.startsWith("0x"));

      // 4. Release payment: Funds move contract -> vendor
      const releaseRes = await releaseArcEscrowPayment({
        agreementId: createRes.agreementId,
        forceRealChain: true,
      });

      assert.equal(releaseRes.isSimulation, false);
      assert.ok(
        releaseRes.txHash?.startsWith("0x"),
        "Must return real release tx hash",
      );

      // Verify contract held balance decreased back to original
      const contractBalanceAfterRelease = await publicClient.readContract({
        address: usdcPrecompile,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [escrowContract],
      });

      assert.equal(
        contractBalanceAfterRelease,
        contractBalanceBefore,
        "Contract balance must return to baseline after release",
      );

      // Log the real ArcScan verifiable links
      console.log(
        "=================================================================",
      );
      console.log("LIVE ARC TESTNET VERIFICATION CONFIRMED:");
      console.log(
        `ArcEscrow Contract:   ${ARC_CONFIG.explorerUrl}/address/${escrowContract}`,
      );
      console.log(
        `Funding Tx Hash:      ${ARC_CONFIG.explorerUrl}/tx/${fundRes.txHash}`,
      );
      console.log(
        `Release Tx Hash:      ${ARC_CONFIG.explorerUrl}/tx/${releaseRes.txHash}`,
      );
      console.log(`Agreement ID:         #${createRes.agreementId}`);
      console.log(
        "=================================================================",
      );
    },
  );
});

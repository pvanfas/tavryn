import { tool } from "ai";
import { z } from "zod";

import {
  approveArcEscrowMilestone,
  ARC_CONFIG,
  getAgreementIdForTransaction,
  isSimulationMode,
  releaseArcEscrowPayment,
} from "@/lib/circle";
import { record_vendor_memory } from "@/lib/memory";
import { verifyPolicyExecutionAuthorization } from "@/lib/policy";
import { getServiceSupabase } from "@/lib/supabase";

import { logAgentAction } from "../audit";
import { ToolContext } from "../types";

export function buildReleaseEscrowTool(ctx: ToolContext) {
  return tool({
    description:
      "Release funds from Arc escrow to vendor upon verified confirmation and policy clearance.",
    inputSchema: z.object({
      contractId: z.string().optional().describe("Associated contract UUID"),
      escrowId: z
        .string()
        .optional()
        .describe("Transaction UUID or escrow identifier"),
      transactionId: z.string().optional().describe("Transaction UUID"),
      idempotencyKey: z
        .string()
        .optional()
        .describe("Optional idempotency key"),
      negotiationId: z
        .string()
        .optional()
        .describe("Associated negotiation UUID"),
      verificationPassed: z
        .boolean()
        .optional()
        .describe("Vendor confirmation verification result"),
      forceRealChain: z
        .boolean()
        .optional()
        .describe("Force real on-chain contract execution"),
    }),
    execute: async (input: {
      contractId?: string;
      escrowId?: string;
      transactionId?: string;
      idempotencyKey?: string;
      negotiationId?: string;
      verificationPassed?: boolean;
      forceRealChain?: boolean;
    }) => {
      const targetContractId = input.contractId;
      const targetTxId = input.transactionId || input.escrowId;
      const supabase = getServiceSupabase();

      // 1. Mandatory verification check
      if (input.verificationPassed === false) {
        throw new Error(
          "Cannot release escrow: vendor confirmation verification has not passed.",
        );
      }

      // Resolve contract and business ID
      let contract: any = null;
      let businessId = "";

      if (targetContractId) {
        const { data: cData } = await supabase
          .from("contracts")
          .select("*, vendors ( id, name, wallet_address )")
          .eq("id", targetContractId)
          .maybeSingle();
        contract = cData;
        if (contract?.business_id) {
          businessId = contract.business_id;
        }
      } else if (targetTxId) {
        const { data: txData } = await supabase
          .from("transactions")
          .select("*, contracts (*, vendors ( id, name, wallet_address ))")
          .eq("id", targetTxId)
          .maybeSingle();

        if (txData) {
          businessId = txData.business_id;
          contract = txData.contracts;
        }
      }

      if (!businessId) {
        businessId = await ctx.resolveBusinessId(targetContractId);
      }

      // Resolve negotiation
      let neg: any = null;
      if (contract?.id) {
        const { data: negData } = await supabase
          .from("negotiations")
          .select("*")
          .eq("contract_id", contract.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        neg = negData;
      }

      const finalPrice = Number(
        neg?.final_price || neg?.current_offer || contract?.current_price || 0,
      );
      // Authoritative savings derivation: derived server-side from contract or negotiation records.
      const savings =
        contract?.current_price !== null &&
        contract?.current_price !== undefined
          ? Math.max(0, Number(contract.current_price) - finalPrice)
          : neg?.savings
            ? Math.max(0, Number(neg.savings))
            : 0;

      if (!contract?.category || contract.category.trim() === "") {
        throw new Error(
          "Policy refusal: Contract has no category set, cannot evaluate policy.",
        );
      }

      // 2. Mandatory server-side policy authorization
      const auth = await verifyPolicyExecutionAuthorization(businessId, {
        amount: finalPrice,
        savings,
        category: contract.category,
        contractId: contract?.id,
        negotiationId: neg?.id,
        action: "release_escrow",
      });

      if (!auth.authorized) {
        throw new Error(`Policy refusal: ${auth.reason}`);
      }

      // 3. Lookup existing transaction
      const txKey =
        input.idempotencyKey ||
        `escrow-release-${contract?.id || "cid"}-${neg?.id || "nid"}`;

      let query = supabase.from("transactions").select("*");
      if (targetTxId) {
        query = query.eq("id", targetTxId);
      } else if (contract?.id) {
        query = query
          .or(`contract_id.eq.${contract.id},idempotency_key.eq.${txKey}`)
          .order("created_at", { ascending: false });
      }

      const { data: existingTx } = await query.limit(1).maybeSingle();

      if (
        existingTx?.status === "released" ||
        existingTx?.status === "completed"
      ) {
        const isSimReleased =
          existingTx.is_simulated === true ||
          existingTx.status === "simulation-only";
        return {
          success: true,
          transactionId: existingTx.id,
          txHash: existingTx.tx_hash,
          status: existingTx.status,
          amount: Number(existingTx.amount),
          explorerUrl:
            !isSimReleased && existingTx.tx_hash
              ? `${ARC_CONFIG.explorerUrl}/tx/${existingTx.tx_hash}`
              : undefined,
          isSimulation: isSimReleased,
          isSimulated: isSimReleased,
          message: isSimReleased
            ? "Idempotent hit: escrow already released in simulation mode"
            : "Idempotent hit: escrow already released on Arc testnet",
        };
      }

      if (existingTx?.status === "disputed") {
        // Must check if human approval exists for this negotiation
        const { data: approval } = await supabase
          .from("approvals")
          .select("status")
          .eq("negotiation_id", neg?.id)
          .eq("status", "approved")
          .maybeSingle();

        if (!approval) {
          throw new Error(
            "Cannot release escrow: transaction is disputed and requires human supervisor approval.",
          );
        }
      }

      // 4. Simulation Mode: Never fabricate random bytes; return clean simulation-only status
      if (isSimulationMode(input.forceRealChain)) {
        let transactionId = existingTx?.id;

        if (existingTx) {
          await supabase
            .from("transactions")
            .update({
              status: "simulation-only",
              tx_hash: null,
              is_simulated: true,
            })
            .eq("id", existingTx.id);
        } else {
          const { data: createdTx, error: createTxErr } = await supabase
            .from("transactions")
            .insert({
              business_id: businessId,
              vendor_id: contract?.vendor_id || null,
              contract_id: contract?.id || null,
              negotiation_id: neg?.id || null,
              amount: finalPrice,
              currency: "USDC",
              status: "simulation-only",
              tx_hash: null,
              escrow_address: ARC_CONFIG.escrowContractAddress,
              idempotency_key: txKey,
              is_simulated: true,
            })
            .select()
            .maybeSingle();

          if (createTxErr || !createdTx) {
            const { data: winnerTx } = await supabase
              .from("transactions")
              .select("*")
              .eq("idempotency_key", txKey)
              .maybeSingle();
            transactionId = winnerTx?.id;
          } else {
            transactionId = createdTx.id;
          }
        }

        if (contract?.id) {
          await supabase
            .from("contracts")
            .update({
              status: "active",
              current_price: finalPrice,
            })
            .eq("id", contract.id);
        }

        await logAgentAction({
          businessId,
          action: "release_escrow",
          reason:
            "Simulation mode: vendor verified and escrow marked simulation-only without blockchain calls",
          confidence: 1.0,
          input: {
            contractId: contract?.id,
            finalPrice,
            transactionId,
          },
          result: {
            status: "simulation-only",
            txHash: null,
            explorerUrl: null,
            isSimulated: true,
          },
        });

        return {
          success: true,
          transactionId,
          txHash: null,
          status: "simulation-only",
          amount: finalPrice,
          explorerUrl: null,
          isSimulation: true,
          isSimulated: true,
          message:
            "Simulation mode: escrow released without live blockchain transaction (credentials absent or LLM_PROVIDER=mock)",
        };
      }

      // 5. Live Smart Contract Execution: approveMilestone + release via contract execution API
      try {
        const agreementId = await getAgreementIdForTransaction({
          idempotencyKey: existingTx?.idempotency_key || txKey,
        });

        if (!agreementId) {
          throw new Error(
            "Cannot release escrow: unable to locate on-chain agreementId for this transaction on ArcEscrow",
          );
        }

        // Cross-check agreement on-chain amount matches authorized transaction amount
        const { getArcEscrowAgreement } = await import("@/lib/circle");
        try {
          const onChainAg = await getArcEscrowAgreement(agreementId);
          if (onChainAg && onChainAg.amount) {
            const onChainAmt = Number(onChainAg.amount) / 1e6;
            const expectedAmt = Number(existingTx?.amount || finalPrice);
            if (expectedAmt > 0 && Math.abs(onChainAmt - expectedAmt) > 0.05) {
              throw new Error(
                `Escrow release blocked: On-chain agreement amount ($${onChainAmt}) does not match authorized transaction amount ($${expectedAmt})`,
              );
            }
          }
        } catch (agErr: any) {
          if (agErr.message?.includes("Escrow release blocked")) throw agErr;
          console.warn("Could not pre-verify agreement amount on-chain (non-fatal):", agErr);
        }

        // Step A: Approve milestone on ArcEscrow (submits milestone if needed first, verifier approves)
        await approveArcEscrowMilestone({
          agreementId,
          milestoneDescription: "Renewal Confirmation Verified",
          forceRealChain: input.forceRealChain,
        });

        // Step B: Release payment from ArcEscrow contract to vendor
        const releaseRes = await releaseArcEscrowPayment({
          agreementId,
          forceRealChain: input.forceRealChain,
        });

        const realTxHash = releaseRes.txHash;
        if (!realTxHash) {
          throw new Error(
            "ArcEscrow release did not return a valid transaction hash",
          );
        }

        let transactionId = existingTx?.id;
        if (existingTx) {
          await supabase
            .from("transactions")
            .update({
              status: "released",
              tx_hash: realTxHash,
              escrow_address: ARC_CONFIG.escrowContractAddress,
              is_simulated: false,
            })
            .eq("id", existingTx.id);
        } else {
          const { data: createdTx, error: createTxErr } = await supabase
            .from("transactions")
            .insert({
              business_id: businessId,
              vendor_id: contract?.vendor_id || null,
              contract_id: contract?.id || null,
              negotiation_id: neg?.id || null,
              amount: finalPrice,
              currency: "USDC",
              status: "released",
              tx_hash: realTxHash,
              escrow_address: ARC_CONFIG.escrowContractAddress,
              idempotency_key: txKey,
              is_simulated: false,
            })
            .select()
            .maybeSingle();

          if (createTxErr || !createdTx) {
            const { data: winnerTx } = await supabase
              .from("transactions")
              .select("*")
              .eq("idempotency_key", txKey)
              .maybeSingle();
            transactionId = winnerTx?.id;
          } else {
            transactionId = createdTx.id;
          }
        }

        // Update contract status to active
        if (contract?.id) {
          await supabase
            .from("contracts")
            .update({
              status: "active",
              current_price: finalPrice,
            })
            .eq("id", contract.id);
        }

        // Automatically record successful delivery into vendor memory
        if (contract?.vendor_id) {
          await record_vendor_memory({
            businessId,
            vendorId: contract.vendor_id,
            contractId: contract?.id,
            negotiationId: neg?.id,
            originalPrice: Number(
              neg?.original_price || contract.current_price || finalPrice,
            ),
            finalPrice,
            roundsToClose: neg?.rounds || 3,
            outcome: "success",
            deliveredOk: true,
          }).catch((err) =>
            console.warn(
              "Failed to record vendor memory on payment release:",
              err,
            ),
          );
        }

        // Log append-only action with real on-chain hash
        await logAgentAction({
          businessId,
          action: "release_escrow",
          reason:
            "Vendor confirmation fully verified; released payment from ArcEscrow contract to vendor",
          confidence: 1.0,
          input: {
            contractId: contract?.id,
            finalPrice,
            transactionId,
            agreementId: agreementId.toString(),
          },
          result: {
            txHash: realTxHash,
            status: "released",
            explorerUrl: `${ARC_CONFIG.explorerUrl}/tx/${realTxHash}`,
          },
        });

        return {
          success: true,
          transactionId,
          txHash: realTxHash,
          status: "released",
          amount: finalPrice,
          explorerUrl: `${ARC_CONFIG.explorerUrl}/tx/${realTxHash}`,
          isSimulation: false,
          isSimulated: false,
        };
      } catch (releaseErr) {
        const errorMsg =
          releaseErr instanceof Error
            ? releaseErr.message
            : "Escrow release execution failed";

        if (existingTx?.id) {
          await supabase
            .from("transactions")
            .update({ status: "failed" })
            .eq("id", existingTx.id);
        }

        await logAgentAction({
          businessId,
          action: "release_escrow",
          reason: `Escrow release failed: ${errorMsg}`,
          confidence: 1.0,
          input: {
            contractId: contract?.id,
            transactionId: existingTx?.id,
          },
          result: {
            status: "failed",
            error: errorMsg,
          },
        });

        throw new Error(`Escrow release failed on Arc testnet: ${errorMsg}`);
      }
    },
  });
}

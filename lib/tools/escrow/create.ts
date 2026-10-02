import { tool } from "ai";
import { z } from "zod";

import {
  ARC_CONFIG,
  createArcEscrowAgreement,
  fundArcEscrowAgreement,
  isSimulationMode,
} from "@/lib/circle";
import { SIMULATED_VENDOR_WALLET } from "@/lib/constants";
import { record_vendor_memory } from "@/lib/memory";
import {
  createApprovalRecord,
  verifyPolicyExecutionAuthorization,
} from "@/lib/policy";
import { isValidEVMAddress, screenAddress } from "@/lib/screening";
import { getServiceSupabase } from "@/lib/supabase";

import { logAgentAction } from "../audit";
import { ToolContext } from "../types";
import {
  computeEscrowIdempotencyKey,
  isDefinitiveOnChainFailure,
  reconcilePendingEscrow,
} from "./idempotency";

export function buildCreateEscrowTool(ctx: ToolContext) {
  return tool({
    description:
      "Create on-chain Arc USDC escrow with deterministic server-side policy enforcement, SHA-256 idempotency, and vendor address compliance screening.",
    inputSchema: z.object({
      amount: z.number().positive().describe("Amount of USDC to escrow"),
      vendor: z
        .union([z.string(), z.record(z.string(), z.any())])
        .optional()
        .describe("Vendor name, UUID, or object"),
      vendorWallet: z
        .string()
        .optional()
        .describe("Vendor recipient EVM wallet address"),
      contractId: z.string().optional().describe("Associated contract UUID"),
      negotiationId: z
        .string()
        .optional()
        .describe("Associated negotiation UUID"),
      category: z.string().optional().describe("Contract category"),
      forceFailSimulation: z
        .boolean()
        .optional()
        .describe("Simulate on-chain RPC/balance funding failure"),
      forceRealChain: z
        .boolean()
        .optional()
        .describe("Force real on-chain contract execution"),
    }),
    execute: async (input: {
      amount: number;
      vendor?: string | Record<string, any>;
      vendorWallet?: string;
      contractId?: string;
      negotiationId?: string;
      category?: string;
      forceFailSimulation?: boolean;
      forceRealChain?: boolean;
    }) => {
      const businessId = await ctx.resolveBusinessId(input.contractId);
      const supabase = getServiceSupabase();

      // Resolve contractId from negotiationId if contractId is omitted
      if (!input.contractId && input.negotiationId) {
        const { data: neg } = await supabase
          .from("negotiations")
          .select("contract_id")
          .eq("id", input.negotiationId)
          .maybeSingle();
        if (neg?.contract_id) {
          input.contractId = neg.contract_id;
        }
      }

      // Reject arbitrary payments lacking both contractId and negotiationId
      if (!input.contractId && !input.negotiationId) {
        const reason =
          "Transaction rejected: create_escrow requires a contractId or negotiationId. Unlinked arbitrary payments are not permitted.";
        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason,
          confidence: 1.0,
          input: {
            amount: input.amount,
            vendor: input.vendor,
            vendorWallet: input.vendorWallet,
          },
          result: { status: "rejected", reason },
        });
        throw new Error(`Policy refusal: ${reason}`);
      }

      let vendorId: string | null = null;
      let resolvedCategory: string = "";
      let resolvedWallet =
        input.vendorWallet !== undefined ? input.vendorWallet : null;
      const negId = input.negotiationId || null;
      let contractRecord: any = null;

      if (input.contractId) {
        const { data: contract } = await supabase
          .from("contracts")
          .select(
            "vendor_id, category, current_price, vendors ( id, name, wallet_address )",
          )
          .eq("id", input.contractId)
          .maybeSingle();

        if (contract) {
          contractRecord = contract;
          vendorId = contract.vendor_id || null;

          // Authoritative contract category verification:
          // If contract.category is null/missing, do not evaluate policy against caller inputs.
          if (!contract.category || contract.category.trim() === "") {
            const reason =
              "Contract has no category set, cannot evaluate policy.";
            await logAgentAction({
              businessId,
              action: "create_escrow",
              reason,
              confidence: 1.0,
              input: {
                contractId: input.contractId,
                amount: input.amount,
                vendor: input.vendor,
                vendorWallet: input.vendorWallet,
                inputCategory: input.category,
              },
              result: { status: "rejected", reason },
            });
            throw new Error(`Policy refusal: ${reason}`);
          }

          resolvedCategory = contract.category;
          if (resolvedWallet === null) {
            if (
              contract.vendors &&
              typeof contract.vendors === "object" &&
              !Array.isArray(contract.vendors)
            ) {
              resolvedWallet =
                (contract.vendors as Record<string, any>).wallet_address ||
                null;
            } else if (Array.isArray(contract.vendors) && contract.vendors[0]) {
              resolvedWallet =
                (contract.vendors[0] as Record<string, any>).wallet_address ||
                null;
            }
          }

          let negRecord: any = null;
          if (negId) {
            const { data: neg } = await supabase
              .from("negotiations")
              .select("id, savings, original_price")
              .eq("id", negId)
              .maybeSingle();
            negRecord = neg;
          }
        }
      }

      // If vendor was passed as object or UUID string
      if (
        !vendorId &&
        typeof input.vendor === "string" &&
        input.vendor.length === 36
      ) {
        vendorId = input.vendor;
      }

      // Fallback query for vendor record if wallet still unpopulated
      if (resolvedWallet === null && vendorId) {
        const { data: vRecord } = await supabase
          .from("vendors")
          .select("wallet_address, is_simulated")
          .eq("id", vendorId)
          .maybeSingle();

        if (vRecord?.wallet_address) {
          resolvedWallet = vRecord.wallet_address;
        } else if (vRecord?.is_simulated) {
          resolvedWallet = SIMULATED_VENDOR_WALLET;
        }
      }

      // Wrong-vendor defense: if contract has an assigned vendor and input.vendor is provided, verify match
      if (input.contractId && input.vendor && vendorId) {
        const inputVendorStr =
          typeof input.vendor === "string"
            ? input.vendor
            : input.vendor.id || input.vendor.name || "";
        const contractVendorId = vendorId;
        const contractVendorName = (contractRecord as any)?.vendors?.name || "";
        const matches =
          inputVendorStr === contractVendorId ||
          (contractVendorName &&
            inputVendorStr.toLowerCase() === contractVendorName.toLowerCase());

        if (!matches) {
          const mismatchErr = `Wrong-vendor violation: Mismatch between contract vendor (${contractVendorName || contractVendorId}) and transaction vendor (${inputVendorStr}). Escrow creation blocked.`;
          await logAgentAction({
            businessId,
            action: "create_escrow",
            reason: mismatchErr,
            confidence: 1.0,
            input: {
              contractId: input.contractId,
              inputVendor: input.vendor,
              contractVendor: contractVendorName || contractVendorId,
            },
            result: { status: "rejected_vendor_mismatch", error: mismatchErr },
          });
          throw new Error(mismatchErr);
        }
      }

      // If contract has no vendor_id or vendor record has no address, and caller did not explicitly pass empty string
      if (
        resolvedWallet === null &&
        input.contractId &&
        input.vendorWallet === undefined
      ) {
        resolvedWallet = SIMULATED_VENDOR_WALLET;
      }

      // 1. Vendor recipient wallet presence and format check
      if (!resolvedWallet || resolvedWallet.trim() === "") {
        throw new Error(
          "Vendor wallet address is required before funding escrow",
        );
      }

      if (!isValidEVMAddress(resolvedWallet)) {
        throw new Error(`Invalid vendor wallet EVM address: ${resolvedWallet}`);
      }

      // Authoritative savings derivation:
      // If contractId is present, derive it from contract.current_price - input.amount (never negative).
      // If contractId is absent, effectiveSavings is strictly 0 (unlinked transactions cannot claim savings).
      const effectiveSavings =
        input.contractId &&
        contractRecord?.current_price !== null &&
        contractRecord?.current_price !== undefined
          ? Math.max(0, Number(contractRecord.current_price) - input.amount)
          : 0;

      if (!resolvedCategory || resolvedCategory.trim() === "") {
        const reason = "Contract has no category set, cannot evaluate policy.";
        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason,
          confidence: 1.0,
          input: {
            contractId: input.contractId,
            amount: input.amount,
            vendor: input.vendor,
            vendorWallet: input.vendorWallet,
            inputCategory: input.category,
          },
          result: { status: "rejected", reason },
        });
        throw new Error(`Policy refusal: ${reason}`);
      }

      // Mandatory server-side policy re-verification (deterministic code gatekeeper)
      // Check input.category if specified: caller category must strictly match contract category
      if (input.category && input.category !== resolvedCategory) {
        const mismatchErr = `Policy refusal: Caller category '${input.category}' does not match authoritative contract category '${resolvedCategory}'.`;
        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason: mismatchErr,
          confidence: 1.0,
          input: {
            contractId: input.contractId,
            amount: input.amount,
            inputCategory: input.category,
            contractCategory: resolvedCategory,
          },
          result: { status: "rejected_category_mismatch", error: mismatchErr },
        });
        throw new Error(mismatchErr);
      }

      const auth = await verifyPolicyExecutionAuthorization(businessId, {
        amount: input.amount,
        savings: effectiveSavings,
        category: resolvedCategory,
        contractId: input.contractId,
        negotiationId: negId || undefined,
        action: "create_escrow",
      });

      if (!auth.authorized) {
        throw new Error(`Policy refusal: ${auth.reason}`);
      }

      // Vendor wallet mutation check (Wrong-vendor defense): escalate to human approval if changed
      if (vendorId) {
        // Check registered address in vendors table
        const { data: registeredVendor } = await supabase
          .from("vendors")
          .select("name, wallet_address")
          .eq("id", vendorId)
          .maybeSingle();

        const registeredAddress = registeredVendor?.wallet_address;

        // Check past completed transactions
        const { data: pastTxs } = await supabase
          .from("transactions")
          .select("escrow_address, status")
          .eq("vendor_id", vendorId)
          .in("status", [
            "funded",
            "verified",
            "released",
            "escrowed",
            "completed",
          ])
          .order("created_at", { ascending: false });

        const pastAddress = pastTxs?.find(
          (t) => t.escrow_address && isValidEVMAddress(t.escrow_address),
        )?.escrow_address;

        const knownAddress = registeredAddress || pastAddress;

        if (
          knownAddress &&
          knownAddress.toLowerCase() !== resolvedWallet.toLowerCase()
        ) {
          const reason = `Vendor wallet address changed from ${knownAddress} to ${resolvedWallet}; human supervisor approval required before funding`;
          await createApprovalRecord(supabase, {
            businessId,
            negotiationId: negId,
            status: "pending",
            reason,
            amount: input.amount,
          });

          await logAgentAction({
            businessId,
            action: "create_escrow",
            reason:
              "Escalated to human supervisor due to mutated vendor wallet address",
            confidence: 1.0,
            input: {
              contractId: input.contractId,
              vendorId,
              oldAddress: knownAddress,
              newAddress: resolvedWallet,
            },
            result: { status: "escalated_to_human", reason },
          });

          throw new Error(`Policy refusal: ${reason}`);
        }
      }

      // 4. Always compute deterministic SHA-256 Idempotency Key server-side:
      // sha256(business_id | contract_id | negotiation_id | amount)
      // Any caller-supplied idempotencyKey is completely ignored.
      const idempotencyKey = computeEscrowIdempotencyKey({
        businessId,
        contractId: input.contractId,
        negotiationId: negId,
        amount: input.amount,
      });

      // 5. Single-payment-per-negotiation check: verify negotiation does not already have an active/completed payment
      if (negId) {
        const { data: existingNegTx } = await supabase
          .from("transactions")
          .select("*")
          .eq("negotiation_id", negId)
          .not("status", "eq", "failed")
          .maybeSingle();

        if (existingNegTx) {
          if (existingNegTx.status === "pending") {
            return await reconcilePendingEscrow({
              supabase,
              businessId,
              existingTx: existingNegTx,
              idempotencyKey,
              forceRealChain: input.forceRealChain,
            });
          }
          const isSim =
            existingNegTx.is_simulated === true ||
            existingNegTx.status === "simulation-only";
          return {
            success: true,
            transactionId: existingNegTx.id,
            status: existingNegTx.status,
            amount: Number(existingNegTx.amount),
            escrowAddress: existingNegTx.escrow_address,
            txHash: existingNegTx.tx_hash,
            explorerUrl:
              !isSim && existingNegTx.tx_hash
                ? `${ARC_CONFIG.explorerUrl}/tx/${existingNegTx.tx_hash}`
                : undefined,
            idempotencyKey: existingNegTx.idempotency_key,
            idempotentHit: true,
            isSimulation: isSim,
            isSimulated: isSim,
            message:
              "Idempotent hit: negotiation already has an active or completed transaction; duplicate payment prohibited",
          };
        }
      } else if (input.contractId) {
        // Unlinked negotiation defense: prevent multiple active escrows for the same contract
        const { data: existingContractTx } = await supabase
          .from("transactions")
          .select("*")
          .eq("business_id", businessId)
          .eq("contract_id", input.contractId)
          .is("negotiation_id", null)
          .not("status", "eq", "failed")
          .maybeSingle();

        if (existingContractTx) {
          if (existingContractTx.status === "pending") {
            return await reconcilePendingEscrow({
              supabase,
              businessId,
              existingTx: existingContractTx,
              idempotencyKey,
              forceRealChain: input.forceRealChain,
            });
          }
          const isSim =
            existingContractTx.is_simulated === true ||
            existingContractTx.status === "simulation-only";
          return {
            success: true,
            transactionId: existingContractTx.id,
            status: existingContractTx.status,
            amount: Number(existingContractTx.amount),
            escrowAddress: existingContractTx.escrow_address,
            txHash: existingContractTx.tx_hash,
            explorerUrl:
              !isSim && existingContractTx.tx_hash
                ? `${ARC_CONFIG.explorerUrl}/tx/${existingContractTx.tx_hash}`
                : undefined,
            idempotencyKey: existingContractTx.idempotency_key,
            idempotentHit: true,
            isSimulation: isSim,
            isSimulated: isSim,
            message:
              "Idempotent hit: contract already has an active unlinked escrow transaction; duplicate payment prohibited",
          };
        }
      }

      // Contract-level active funded/escrowed lock defense: prevent double funding of same contract
      if (input.contractId) {
        const { data: activeFundedTx } = await supabase
          .from("transactions")
          .select("*")
          .eq("business_id", businessId)
          .eq("contract_id", input.contractId)
          .in("status", ["funded", "escrowed"])
          .maybeSingle();

        if (activeFundedTx && activeFundedTx.negotiation_id !== negId) {
          const isSim =
            activeFundedTx.is_simulated === true ||
            activeFundedTx.status === "simulation-only";
          return {
            success: true,
            transactionId: activeFundedTx.id,
            status: activeFundedTx.status,
            amount: Number(activeFundedTx.amount),
            escrowAddress: activeFundedTx.escrow_address,
            txHash: activeFundedTx.tx_hash,
            explorerUrl:
              !isSim && activeFundedTx.tx_hash
                ? `${ARC_CONFIG.explorerUrl}/tx/${activeFundedTx.tx_hash}`
                : undefined,
            idempotencyKey: activeFundedTx.idempotency_key,
            idempotentHit: true,
            isSimulation: isSim,
            isSimulated: isSim,
            message:
              "Idempotent hit: contract already has an active funded escrow; duplicate funding prohibited",
          };
        }
      }

      // 6. Check Idempotency Key in transactions table (UNIQUE constraint)
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingTx) {
        if (existingTx.status === "pending") {
          return await reconcilePendingEscrow({
            supabase,
            businessId,
            existingTx,
            idempotencyKey,
            forceRealChain: input.forceRealChain,
          });
        }
        const isSim =
          existingTx.is_simulated === true ||
          existingTx.status === "simulation-only";
        return {
          success: true,
          transactionId: existingTx.id,
          status: existingTx.status,
          amount: Number(existingTx.amount),
          escrowAddress: existingTx.escrow_address,
          txHash: existingTx.tx_hash,
          explorerUrl:
            !isSim && existingTx.tx_hash
              ? `${ARC_CONFIG.explorerUrl}/tx/${existingTx.tx_hash}`
              : undefined,
          idempotencyKey,
          idempotentHit: true,
          isSimulation: isSim,
          isSimulated: isSim,
          message:
            "Idempotent hit: existing escrow returned without creating duplicate on-chain transaction",
        };
      }

      // 7. Counterparty compliance screening
      const screening = await screenAddress(resolvedWallet);
      if (!screening.passed) {
        const screenErr = `Counterparty wallet address rejected by compliance screening: ${screening.reason}`;
        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason: screenErr,
          confidence: 1.0,
          input: {
            contractId: input.contractId,
            vendorWallet: resolvedWallet,
            screening,
          },
          result: { status: "screening_failed", reason: screening.reason },
        });
        throw new Error(screenErr);
      }

      // 8. Transaction State Machine: Step 1 -> 'pending' with escrow_address set to ArcEscrow contract
      const isSimMode = isSimulationMode(input.forceRealChain);
      const { data: newTx, error: txError } = await supabase
        .from("transactions")
        .insert({
          business_id: businessId,
          vendor_id: vendorId,
          contract_id: input.contractId || null,
          negotiation_id: negId,
          amount: input.amount,
          currency: "USDC",
          escrow_address: ARC_CONFIG.escrowContractAddress,
          status: "pending",
          idempotency_key: idempotencyKey,
          is_simulated: isSimMode,
        })
        .select()
        .single();

      if (txError || !newTx) {
        // Concurrency race condition handling: if another thread inserted simultaneously
        if (
          txError &&
          (txError.code === "23505" ||
            txError.message?.includes("unique") ||
            txError.message?.includes("idempotency_key") ||
            txError.message?.includes("idx_transactions_unique_negotiation") ||
            txError.message?.includes("idx_transactions_active_contract") ||
            txError.message?.includes(
              "idx_transactions_unique_contract_unlinked",
            ))
        ) {
          let winnerQuery = supabase.from("transactions").select("*");
          if (negId) {
            winnerQuery = winnerQuery
              .eq("negotiation_id", negId)
              .not("status", "eq", "failed");
          } else if (input.contractId) {
            winnerQuery = winnerQuery
              .eq("business_id", businessId)
              .eq("contract_id", input.contractId)
              .is("negotiation_id", null)
              .not("status", "eq", "failed");
          } else {
            winnerQuery = winnerQuery.eq("idempotency_key", idempotencyKey);
          }
          const { data: winnerTx } = await winnerQuery
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (winnerTx) {
            if (winnerTx.status === "pending") {
              return await reconcilePendingEscrow({
                supabase,
                businessId,
                existingTx: winnerTx,
                idempotencyKey,
                forceRealChain: input.forceRealChain,
              });
            }
            const isSimTx =
              winnerTx.is_simulated === true ||
              winnerTx.status === "simulation-only";
            return {
              success: true,
              transactionId: winnerTx.id,
              status: winnerTx.status,
              amount: Number(winnerTx.amount),
              escrowAddress: winnerTx.escrow_address,
              txHash: winnerTx.tx_hash,
              explorerUrl:
                !isSimTx && winnerTx.tx_hash
                  ? `${ARC_CONFIG.explorerUrl}/tx/${winnerTx.tx_hash}`
                  : null,
              idempotencyKey: winnerTx.idempotency_key,
              idempotentHit: true,
              isSimulation: isSimTx,
              isSimulated: isSimTx,
              message:
                "Idempotent hit: concurrent request resolved to existing transaction",
            };
          }
        }
        throw new Error(
          `Failed to initialize pending escrow transaction: ${txError?.message}`,
        );
      }

      if (input.forceFailSimulation) {
        await supabase
          .from("transactions")
          .update({
            status: "failed",
          })
          .eq("id", newTx.id);

        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason:
            "Escrow funding failed: Simulated on-chain RPC error or EVM execution revert during funding",
          confidence: 1.0,
          input: {
            contractId: input.contractId,
            transactionId: newTx.id,
            amount: input.amount,
            idempotencyKey,
          },
          result: {
            status: "failed",
            error:
              "Simulated on-chain RPC error or EVM execution revert during funding",
          },
        });

        throw new Error(
          "Escrow funding failed on Arc testnet: Simulated on-chain RPC error or EVM execution revert during funding",
        );
      }

      // 8. Simulation-Only Guard: If in mock mode or credentials absent, mark simulation-only
      if (isSimulationMode(input.forceRealChain)) {
        await supabase
          .from("transactions")
          .update({
            status: "simulation-only",
            tx_hash: null,
            escrow_address: ARC_CONFIG.escrowContractAddress,
            is_simulated: true,
          })
          .eq("id", newTx.id);

        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason:
            "Simulation mode: escrow recorded without live blockchain transaction (credentials absent or LLM_PROVIDER=mock)",
          confidence: 1.0,
          input: {
            contractId: input.contractId,
            negotiationId: negId,
            amount: input.amount,
            savings: effectiveSavings,
            idempotencyKey,
            vendorWallet: resolvedWallet,
          },
          result: {
            transactionId: newTx.id,
            status: "simulation-only",
            txHash: null,
            escrowAddress: ARC_CONFIG.escrowContractAddress,
            explorerUrl: null,
            isSimulated: true,
          },
        });

        return {
          success: true,
          transactionId: newTx.id,
          status: "simulation-only",
          amount: input.amount,
          savings: effectiveSavings,
          escrowAddress: ARC_CONFIG.escrowContractAddress,
          txHash: null,
          explorerUrl: null,
          idempotencyKey,
          idempotentHit: false,
          isSimulation: true,
          isSimulated: true,
          message:
            "Simulation mode: escrow recorded without live blockchain transaction (credentials absent or LLM_PROVIDER=mock)",
        };
      }

      // 9. Real On-chain contract execution: createAgreementWithSavings + fundAgreement
      let fundingTxHash: string | null = null;
      try {
        if (input.forceFailSimulation) {
          throw new Error(
            "Simulated on-chain RPC error or EVM execution revert during funding",
          );
        }

        // Create Agreement on ArcEscrow.sol (funds move into contract, not vendor)
        const baselinePrice = contractRecord?.current_price
          ? Number(contractRecord.current_price)
          : input.amount;

        const createRes = await createArcEscrowAgreement({
          vendorWallet: resolvedWallet,
          amount: input.amount,
          baselinePrice,
          category: resolvedCategory,
          idempotencyKey,
          forceRealChain: input.forceRealChain,
        });

        // Fund Agreement on ArcEscrow.sol (transfers USDC to contract held balance)
        const fundRes = await fundArcEscrowAgreement({
          agreementId: createRes.agreementId,
          amount: input.amount,
          forceRealChain: input.forceRealChain,
        });

        fundingTxHash = fundRes.txHash || createRes.txHash;
        if (!fundingTxHash) {
          throw new Error(
            "ArcEscrow on-chain funding did not return a valid transaction hash",
          );
        }

        // Commit funded status with real tx hash
        const { error: updateErr } = await supabase
          .from("transactions")
          .update({
            status: "funded",
            tx_hash: fundingTxHash,
            escrow_address: ARC_CONFIG.escrowContractAddress,
            is_simulated: false,
          })
          .eq("id", newTx.id);

        if (updateErr) {
          throw new Error(
            `Failed to commit funded status: ${updateErr.message}`,
          );
        }

        // Log successful escrow to agent_actions (append-only)
        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason:
            "Created and funded agreement in ArcEscrow smart contract on Arc testnet",
          confidence: 1.0,
          input: {
            contractId: input.contractId,
            negotiationId: negId,
            amount: input.amount,
            savings: effectiveSavings,
            idempotencyKey,
            vendorWallet: resolvedWallet,
            agreementId: createRes.agreementId,
          },
          result: {
            transactionId: newTx.id,
            status: "funded",
            txHash: fundingTxHash,
            escrowAddress: ARC_CONFIG.escrowContractAddress,
            explorerUrl: `${ARC_CONFIG.explorerUrl}/tx/${fundingTxHash}`,
            agreementId: createRes.agreementId,
            isSimulated: false,
          },
        });

        return {
          success: true,
          transactionId: newTx.id,
          status: "funded",
          amount: input.amount,
          savings: effectiveSavings,
          escrowAddress: ARC_CONFIG.escrowContractAddress,
          txHash: fundingTxHash,
          explorerUrl: `${ARC_CONFIG.explorerUrl}/tx/${fundingTxHash}`,
          idempotencyKey,
          agreementId: createRes.agreementId,
          idempotentHit: false,
          isSimulation: false,
          isSimulated: false,
        };
      } catch (fundErr) {
        const failureMessage =
          fundErr instanceof Error
            ? fundErr.message
            : "Funding execution failed";

        const isDefinitive = isDefinitiveOnChainFailure(fundErr);

        if (isDefinitive) {
          // Transition state to 'failed' because execution was definitively reverted/rejected
          await supabase
            .from("transactions")
            .update({
              status: "failed",
            })
            .eq("id", newTx.id);

          await logAgentAction({
            businessId,
            action: "create_escrow",
            reason: `Escrow funding definitively failed on-chain: ${failureMessage}`,
            confidence: 1.0,
            input: {
              contractId: input.contractId,
              transactionId: newTx.id,
              amount: input.amount,
              idempotencyKey,
            },
            result: {
              status: "failed",
              error: failureMessage,
            },
          });

          throw new Error(
            `Escrow funding failed on Arc testnet: ${failureMessage}`,
          );
        } else {
          // Ambiguous timeout, network drop, or unknown outcome:
          // LEAVE status as 'pending' to prevent duplicate payment retries via partial unique index
          await logAgentAction({
            businessId,
            action: "create_escrow",
            reason: `Escrow funding outcome is ambiguous (${failureMessage}); left in 'pending' status for explicit reconciliation`,
            confidence: 1.0,
            input: {
              contractId: input.contractId,
              transactionId: newTx.id,
              amount: input.amount,
              idempotencyKey,
            },
            result: {
              status: "pending_reconciliation",
              error: failureMessage,
            },
          });

          throw new Error(
            `Escrow funding outcome is ambiguous (${failureMessage}). Transaction left in 'pending' status and requires explicit reconciliation before retry.`,
          );
        }
      }
    },
  });
}

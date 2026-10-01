import { tool } from "ai";
import crypto from "crypto";
import { z } from "zod";

import {
  approveArcEscrowMilestone,
  ARC_CONFIG,
  createArcEscrowAgreement,
  fundArcEscrowAgreement,
  getAgreementIdForTransaction,
  getArcPublicClient,
  isSimulationMode,
  refundArcEscrowAgreement,
  releaseArcEscrowPayment,
} from "@/lib/circle";
import { SIMULATED_VENDOR_WALLET } from "@/lib/constants";
import { ARC_ESCROW_ABI } from "@/lib/contracts/arc-escrow";
import { record_vendor_memory } from "@/lib/memory";
import {
  createApprovalRecord,
  verifyPolicyExecutionAuthorization,
} from "@/lib/policy";
import { isValidEVMAddress, screenAddress } from "@/lib/screening";
import { getServiceSupabase } from "@/lib/supabase";

import { logAgentAction } from "./audit";
import { ToolContext } from "./types";

/**
 * Computes a deterministic SHA-256 idempotency key for escrow transactions:
 * sha256(business_id | contract_id | negotiation_id | amount)
 */
export function computeEscrowIdempotencyKey(params: {
  businessId: string;
  contractId?: string | null;
  negotiationId?: string | null;
  amount: number | string;
}): string {
  const payload = `${params.businessId}|${params.contractId || ""}|${params.negotiationId || ""}|${params.amount}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Distinguishes definitive on-chain/contract failures (reverts, rejections, budget caps)
 * from ambiguous network timeouts, socket hangups, process kills, or unconfirmed states.
 * Only definitive failures may transition a pending transaction to 'failed'.
 */
export function isDefinitiveOnChainFailure(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  // Explicit simulation test flag
  if (
    lower.includes("simulated on-chain rpc error") ||
    lower.includes("simulated failure")
  ) {
    return true;
  }

  // Real EVM reverts (contract execution explicitly rejected on-chain)
  if (
    lower.includes("reverted") ||
    lower.includes("execution reverted") ||
    lower.includes("transactionrevertederror") ||
    lower.includes("contractfunctionrevertederror") ||
    lower.includes("agentnotauthorized") ||
    lower.includes("categorybudgetexceeded") ||
    lower.includes("agreementcapexceeded") ||
    lower.includes("insufficient funds") ||
    lower.includes("insufficient balance") ||
    lower.includes("insufficient allowance") ||
    lower.includes("exceeds balance") ||
    lower.includes("only owner") ||
    lower.includes("only verifier") ||
    lower.includes("deadline not reached") ||
    lower.includes("already funded") ||
    lower.includes("agreement does not exist") ||
    lower.includes("invalid agreement")
  ) {
    return true;
  }

  // Circle confirmed terminal rejections
  if (
    lower.includes("state: failed") ||
    lower.includes("state: denied") ||
    lower.includes("state: cancelled") ||
    lower.includes("circle contract execution failed") ||
    lower.includes("circle transaction denied")
  ) {
    return true;
  }

  // Ambiguous network errors, timeouts, process interruptions, or gateway dropouts are NOT definitive
  return false;
}

/**
 * Reconciles an escrow transaction left in 'pending' status due to ambiguous timeout,
 * process interruption, or incomplete write. Checks on-chain ArcEscrow status to confirm
 * whether the agreement was actually funded before allowing any state update.
 */
export async function reconcilePendingEscrow(params: {
  supabase: any;
  businessId: string;
  existingTx: any;
  idempotencyKey: string;
  forceRealChain?: boolean;
}): Promise<{
  success: boolean;
  transactionId: string;
  status: string;
  amount: number;
  escrowAddress: string;
  txHash: string | null;
  explorerUrl?: string;
  idempotencyKey: string;
  agreementId?: string;
  idempotentHit: boolean;
  isSimulation: boolean;
  isSimulated: boolean;
  message: string;
}> {
  const { supabase, businessId, existingTx, idempotencyKey, forceRealChain } =
    params;

  if (isSimulationMode(forceRealChain)) {
    await supabase
      .from("transactions")
      .update({
        status: "simulation-only",
        tx_hash: null,
        escrow_address: ARC_CONFIG.escrowContractAddress,
        is_simulated: true,
      })
      .eq("id", existingTx.id);

    return {
      success: true,
      transactionId: existingTx.id,
      status: "simulation-only",
      amount: Number(existingTx.amount),
      escrowAddress: ARC_CONFIG.escrowContractAddress,
      txHash: null,
      explorerUrl: undefined,
      idempotencyKey,
      idempotentHit: true,
      isSimulation: true,
      isSimulated: true,
      message: "Reconciled pending transaction in simulation mode",
    };
  }

  // Query ArcEscrow.sol for on-chain agreement mapped to this idempotency key
  try {
    const agreementId = await getAgreementIdForTransaction({ idempotencyKey });
    if (agreementId && Number(agreementId) > 0) {
      const publicClient = getArcPublicClient();
      const agreement = (await publicClient.readContract({
        address: ARC_CONFIG.escrowContractAddress as `0x${string}`,
        abi: ARC_ESCROW_ABI,
        functionName: "getAgreement",
        args: [BigInt(agreementId)],
      })) as any;

      // Status: Created = 0, Funded = 1, MilestoneSubmitted = 2, Approved = 3, Released = 4, Refunded = 5, Disputed = 6
      if (agreement.status >= 1) {
        await supabase
          .from("transactions")
          .update({
            status: "funded",
            escrow_address: ARC_CONFIG.escrowContractAddress,
            is_simulated: false,
          })
          .eq("id", existingTx.id);

        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason: `Reconciled pending escrow transaction on-chain: agreement #${agreementId} is funded (status: ${agreement.status})`,
          confidence: 1.0,
          input: {
            transactionId: existingTx.id,
            idempotencyKey,
            agreementId: agreementId.toString(),
          },
          result: {
            status: "funded",
            agreementId: agreementId.toString(),
          },
        });

        const isSimTx =
          existingTx.is_simulated === true ||
          existingTx.status === "simulation-only";
        return {
          success: true,
          transactionId: existingTx.id,
          status: "funded",
          amount: Number(existingTx.amount),
          escrowAddress: ARC_CONFIG.escrowContractAddress,
          txHash: existingTx.tx_hash || null,
          explorerUrl:
            !isSimTx && existingTx.tx_hash
              ? `${ARC_CONFIG.explorerUrl}/tx/${existingTx.tx_hash}`
              : undefined,
          idempotencyKey,
          agreementId: agreementId.toString(),
          idempotentHit: true,
          isSimulation: isSimTx,
          isSimulated: isSimTx,
          message: `Reconciled pending transaction: agreement #${agreementId} is active and funded on-chain`,
        };
      }
    }
  } catch (reconcileErr) {
    throw new Error(
      `Pending escrow transaction requires reconciliation. Unable to verify on-chain status (${(reconcileErr as Error).message}); duplicate payment prohibited. Retry after status confirmation.`,
    );
  }

  // Agreement not found on-chain or still unresolved
  throw new Error(
    "Pending escrow transaction requires reconciliation. Transaction is still pending or undetermined on-chain; duplicate payment prohibited. Retry after status confirmation.",
  );
}

export function buildEscrowTools(ctx: ToolContext) {
  // create_escrow
  const create_escrow = tool({
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

      // 2. Mandatory server-side policy re-verification (deterministic code gatekeeper)
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

      // 3. Vendor wallet mutation check (Wrong-vendor defense): escalate to human approval if changed
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

          throw new Error(reason);
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

  // release_escrow
  const release_escrow = tool({
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

  // dispute_escrow
  const dispute_escrow = tool({
    description:
      "Flag an escrow transaction as disputed due to confirmation discrepancies and request human approval.",
    inputSchema: z.object({
      contractId: z.string(),
      negotiationId: z.string().optional(),
      reason: z.string(),
      discrepancies: z.array(z.string()).optional(),
    }),
    execute: async (input: {
      contractId: string;
      negotiationId?: string;
      reason: string;
      discrepancies?: string[];
    }) => {
      const businessId = await ctx.resolveBusinessId(input.contractId);
      const supabase = getServiceSupabase();

      // 1. Fetch contract & negotiation
      const { data: contract } = await supabase
        .from("contracts")
        .select("vendor_id")
        .eq("id", input.contractId)
        .maybeSingle();

      let negotiationId = input.negotiationId;
      if (!negotiationId) {
        const { data: neg } = await supabase
          .from("negotiations")
          .select("id")
          .eq("contract_id", input.contractId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        negotiationId = neg?.id;
      }

      // 2. Mark existing transaction as disputed or insert
      const txKey = `escrow-dispute-${input.contractId}-${negotiationId || "def"}`;
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("*")
        .eq("contract_id", input.contractId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingTx) {
        await supabase
          .from("transactions")
          .update({ status: "disputed" })
          .eq("id", existingTx.id);
      } else {
        await supabase.from("transactions").insert({
          business_id: businessId,
          vendor_id: contract?.vendor_id || null,
          contract_id: input.contractId,
          negotiation_id: negotiationId || null,
          amount: 0,
          currency: "USDC",
          status: "disputed",
          idempotency_key: txKey,
        });
      }

      // 3. Create Human Approval entry
      let approvalId: string | null = null;
      if (negotiationId) {
        const fullReason = input.discrepancies?.length
          ? `Vendor confirmation discrepancies: ${input.discrepancies.join("; ")}`
          : input.reason;

        const { data: approval } = await supabase
          .from("approvals")
          .insert({
            business_id: businessId,
            negotiation_id: negotiationId,
            status: "pending",
            reason: fullReason,
          })
          .select()
          .single();

        approvalId = approval?.id || null;
      }

      // 3b. Automatically record disputed delivery into vendor memory
      if (contract?.vendor_id) {
        const { data: negData } = negotiationId
          ? await supabase
              .from("negotiations")
              .select("*")
              .eq("id", negotiationId)
              .maybeSingle()
          : { data: null };
        await record_vendor_memory({
          businessId,
          vendorId: contract.vendor_id,
          contractId: input.contractId,
          negotiationId: negotiationId || undefined,
          originalPrice: Number(negData?.original_price || 0),
          finalPrice: Number(negData?.final_price || 0),
          roundsToClose: negData?.rounds || 3,
          outcome: "disputed",
          deliveredOk: false,
        }).catch((err) =>
          console.warn("Failed to record vendor memory on dispute:", err),
        );
      }

      // 4. Log append-only action
      await logAgentAction({
        businessId,
        action: "dispute_escrow",
        reason: input.reason,
        confidence: 1.0,
        input: {
          contractId: input.contractId,
          negotiationId,
          discrepancies: input.discrepancies,
        },
        result: {
          status: "disputed",
          approvalId,
        },
      });

      return {
        success: true,
        status: "disputed",
        approvalId,
      };
    },
  });

  // refund_escrow
  const refund_escrow = tool({
    description:
      "Claim refund from ArcEscrow contract back to depositor when verification fails or vendor fails to fulfill terms after deadline.",
    inputSchema: z.object({
      contractId: z.string().optional().describe("Associated contract UUID"),
      transactionId: z.string().optional().describe("Transaction UUID"),
      idempotencyKey: z
        .string()
        .optional()
        .describe("Associated idempotency key"),
      reason: z.string().describe("Reason for claiming refund"),
      forceRealChain: z
        .boolean()
        .optional()
        .describe("Force live on-chain execution"),
    }),
    execute: async (input: {
      contractId?: string;
      transactionId?: string;
      idempotencyKey?: string;
      reason: string;
      forceRealChain?: boolean;
    }) => {
      const businessId = await ctx.resolveBusinessId(input.contractId);
      const supabase = getServiceSupabase();

      let targetTx: any = null;
      if (input.transactionId) {
        const { data } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", input.transactionId)
          .maybeSingle();
        targetTx = data;
      } else if (input.idempotencyKey) {
        const { data } = await supabase
          .from("transactions")
          .select("*")
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        targetTx = data;
      } else if (input.contractId) {
        const { data } = await supabase
          .from("transactions")
          .select("*")
          .eq("contract_id", input.contractId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        targetTx = data;
      }

      if (!targetTx) {
        throw new Error("Transaction not found for refund");
      }

      if (targetTx.status === "refunded") {
        return {
          success: true,
          transactionId: targetTx.id,
          status: "refunded",
          txHash: targetTx.tx_hash,
          explorerUrl: targetTx.tx_hash
            ? `${ARC_CONFIG.explorerUrl}/tx/${targetTx.tx_hash}`
            : null,
          message: "Idempotent hit: escrow already refunded",
        };
      }

      // Check simulation mode
      if (isSimulationMode(input.forceRealChain)) {
        await supabase
          .from("transactions")
          .update({
            status: "refunded",
            tx_hash: null,
            is_simulated: true,
          })
          .eq("id", targetTx.id);

        await logAgentAction({
          businessId,
          action: "refund_escrow",
          reason: `Simulation refund: ${input.reason}`,
          confidence: 1.0,
          input: { transactionId: targetTx.id, reason: input.reason },
          result: {
            status: "refunded",
            txHash: null,
            explorerUrl: null,
            isSimulated: true,
          },
        });

        return {
          success: true,
          transactionId: targetTx.id,
          status: "refunded",
          txHash: null,
          explorerUrl: null,
          isSimulation: true,
          isSimulated: true,
          message:
            "Simulation mode: escrow marked refunded without blockchain transaction",
        };
      }

      // On-chain refund
      try {
        const agreementId = await getAgreementIdForTransaction({
          idempotencyKey: targetTx.idempotency_key,
        });

        if (!agreementId) {
          throw new Error("Unable to locate on-chain agreementId for refund");
        }

        const refundRes = await refundArcEscrowAgreement({
          agreementId,
          forceRealChain: input.forceRealChain,
        });

        const realTxHash = refundRes.txHash;
        if (!realTxHash) {
          throw new Error(
            "ArcEscrow refund did not return a valid transaction hash",
          );
        }

        await supabase
          .from("transactions")
          .update({
            status: "refunded",
            tx_hash: realTxHash,
            is_simulated: false,
          })
          .eq("id", targetTx.id);

        await logAgentAction({
          businessId,
          action: "refund_escrow",
          reason: `On-chain refund executed: ${input.reason}`,
          confidence: 1.0,
          input: {
            transactionId: targetTx.id,
            agreementId: agreementId.toString(),
            reason: input.reason,
          },
          result: {
            status: "refunded",
            txHash: realTxHash,
            explorerUrl: `${ARC_CONFIG.explorerUrl}/tx/${realTxHash}`,
            isSimulated: false,
          },
        });

        return {
          success: true,
          transactionId: targetTx.id,
          status: "refunded",
          txHash: realTxHash,
          explorerUrl: `${ARC_CONFIG.explorerUrl}/tx/${realTxHash}`,
          isSimulation: false,
          isSimulated: false,
        };
      } catch (refundErr) {
        const errMsg =
          refundErr instanceof Error
            ? refundErr.message
            : "Refund execution failed";
        await logAgentAction({
          businessId,
          action: "refund_escrow",
          reason: `Refund attempt failed: ${errMsg}`,
          confidence: 1.0,
          input: { transactionId: targetTx.id, reason: input.reason },
          result: { status: "failed", error: errMsg },
        });
        throw new Error(`Refund failed on Arc testnet: ${errMsg}`);
      }
    },
  });

  return {
    create_escrow,
    release_escrow,
    dispute_escrow,
    refund_escrow,
  };
}

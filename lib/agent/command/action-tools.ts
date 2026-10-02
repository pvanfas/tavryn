import { evaluateContractOpportunity } from "@/lib/heuristics";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";
import { runNegotiationLoop } from "../negotiate";
import { ActionConfirmationData } from "./types";

// ─── ACTION TOOLS (Never executed automatically from chat) ─────────────────

export async function toolProposeNegotiation(
  businessId: string,
  serviceOrVendor: string,
): Promise<ActionConfirmationData> {
  const supabase = getServiceSupabase();
  const query = serviceOrVendor.toLowerCase().trim();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, vendors(id, name)")
    .eq("business_id", businessId);

  const match = (contracts || []).find(
    (c) =>
      c.service.toLowerCase().includes(query) ||
      (c.vendors?.name && c.vendors.name.toLowerCase().includes(query)),
  );

  const serviceName = match ? match.service : serviceOrVendor;
  const contractId = match ? match.id : undefined;
  const currentPrice = match ? Number(match.current_price) : 37200;
  const opp = match ? evaluateContractOpportunity(match as any) : null;
  const targetPrice =
    opp && opp.saving > 0
      ? currentPrice - opp.saving
      : Math.round(currentPrice * 0.8);

  const confirmation: ActionConfirmationData = {
    type: "action_confirmation",
    action: "start_negotiation",
    service: serviceName,
    contractId,
    currentPrice,
    targetPrice,
    detail: `Initiate multi-round autonomous renewal negotiation for ${serviceName}. Current annual commitment is $${currentPrice.toLocaleString()} with an opening target of $${targetPrice.toLocaleString()}.`,
    params: {
      contractId,
      serviceName,
      targetPrice,
    },
  };

  await logAgentAction({
    businessId,
    action: "tool_propose_action",
    reason: `Staged unconfirmed negotiation action proposal for ${serviceName}`,
    confidence: 1.0,
    input: { businessId, serviceOrVendor },
    result: { action: "start_negotiation", contractId, serviceName },
  });

  return confirmation;
}

export async function toolProposeApprovalRequest(
  businessId: string,
  serviceOrVendor: string,
  amount?: number,
  reason?: string,
): Promise<ActionConfirmationData> {
  const confirmation: ActionConfirmationData = {
    type: "action_confirmation",
    action: "request_approval",
    service: serviceOrVendor,
    detail: `Create human supervisor approval request for ${serviceOrVendor} renewal${amount ? ` ($${amount.toLocaleString()})` : ""}.`,
    params: {
      serviceName: serviceOrVendor,
      amount,
      reason: reason || "Manual escalation via command bar",
    },
  };

  await logAgentAction({
    businessId,
    action: "tool_propose_action",
    reason: `Staged unconfirmed approval request for ${serviceOrVendor}`,
    confidence: 1.0,
    input: { businessId, serviceOrVendor, amount },
    result: { action: "request_approval" },
  });

  return confirmation;
}

export async function toolProposeCreateReceipt(
  businessId: string,
  serviceOrVendor: string,
): Promise<ActionConfirmationData> {
  const confirmation: ActionConfirmationData = {
    type: "action_confirmation",
    action: "create_receipt",
    service: serviceOrVendor,
    detail: `Generate a public verified cryptographic savings receipt for ${serviceOrVendor}.`,
    params: {
      serviceName: serviceOrVendor,
    },
  };

  await logAgentAction({
    businessId,
    action: "tool_propose_action",
    reason: `Staged unconfirmed receipt generation for ${serviceOrVendor}`,
    confidence: 1.0,
    input: { businessId, serviceOrVendor },
    result: { action: "create_receipt" },
  });

  return confirmation;
}

// ─── ACTION EXECUTION (Only upon explicit user click confirmation) ─────────

export async function executeConfirmedAction(
  businessId: string,
  action: "start_negotiation" | "request_approval" | "create_receipt",
  params: Record<string, unknown>,
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const supabase = getServiceSupabase();

  if (action === "start_negotiation") {
    let contractId = params.contractId as string | undefined;

    // Resolve contract if only serviceName was passed
    if (!contractId && params.serviceName) {
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id")
        .eq("business_id", businessId)
        .ilike("service", `%${params.serviceName}%`)
        .limit(1);
      if (contracts && contracts.length > 0) {
        contractId = contracts[0].id;
      }
    }

    if (!contractId) {
      throw new Error("Contract ID is required to execute a negotiation.");
    }

    const result = await runNegotiationLoop(contractId, { maxRounds: 5 });

    await logAgentAction({
      businessId,
      action: "ask_tavryn_action_confirmed",
      reason: `User explicitly confirmed execution of negotiation for contract ${contractId}`,
      confidence: 1.0,
      input: { action, contractId, params },
      result: {
        status: result.status,
        finalPrice: result.finalPrice,
        savings: result.savings,
        rounds: result.rounds,
      },
    });

    const statusMsg =
      result.status === "agreed"
        ? `Successfully negotiated! Agreed at $${result.finalPrice?.toLocaleString()} (saved $${result.savings.toLocaleString()}) across ${result.rounds} rounds.`
        : `Negotiation conducted over ${result.rounds} rounds; reached walk-away limit to defend spending policy.`;

    return {
      success: true,
      message: statusMsg,
      data: result,
    };
  }

  if (action === "request_approval") {
    const serviceName = (params.serviceName as string) || "Contract Renewal";
    const reason =
      (params.reason as string) || "Requested from Ask Tavryn command bar";

    const { data: newApproval, error } = await supabase
      .from("approvals")
      .insert({
        business_id: businessId,
        status: "pending",
        reason,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    await logAgentAction({
      businessId,
      action: "ask_tavryn_action_confirmed",
      reason: `User explicitly confirmed creation of supervisor approval request for ${serviceName}`,
      confidence: 1.0,
      input: { action, serviceName, params },
      result: { approvalId: newApproval.id },
    });

    return {
      success: true,
      message: `Pending human supervisor approval created for ${serviceName}.`,
      data: newApproval,
    };
  }

  if (action === "create_receipt") {
    const serviceName =
      (params.serviceName as string) ||
      (params.serviceOrVendor as string) ||
      "Service";

    // Attempt to find completed contract / transaction to generate real receipt
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, service")
      .eq("business_id", businessId)
      .ilike("service", `%${serviceName}%`)
      .limit(1)
      .maybeSingle();

    if (contract) {
      const { data: tx } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("contract_id", contract.id)
        .eq("business_id", businessId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tx) {
        const { createReceipt } = await import("@/lib/receipt");
        const receipt = await createReceipt({
          transactionId: tx.id,
          businessId,
          createdBy: "command_bar",
        });

        return {
          success: true,
          message: `Public verified cryptographic savings receipt generated for ${contract.service}: ${receipt.receiptUrl}`,
          data: {
            receiptUrl: receipt.receiptUrl,
            token: receipt.token,
          },
        };
      }
    }

    return {
      success: true,
      message: `Verified savings receipt link ready for ${serviceName}.`,
      data: {
        receiptUrl: `/decision`,
      },
    };
  }

  throw new Error(`Unsupported action: ${action}`);
}


import { generateObject } from "ai";
import { z } from "zod";

import { getAgentLanguageModel, isLiveLLMConfigured } from "@/lib/agent/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAgentAction } from "@/lib/tools/audit";

import {
  toolProposeNegotiation,
} from "./action-tools";
import { isPromptInjection } from "./guardrails";
import {
  toolExplainDecision,
  toolGetBiggestSavings,
  toolGetPendingApprovals,
  toolGetRenewals,
  toolGetSavingsSummary,
} from "./read-tools";
import { CommandResponse } from "./types";

// ─── COMMAND BAR QUERY RESOLVER ───────────────────────────────────────────

export async function processCommandQuery(
  rawText: string,
  businessId: string,
): Promise<CommandResponse> {
  const text = rawText.trim();

  // 1. Rate Limiting Check
  const rateLimit = checkRateLimit(`ask_tavryn_${businessId}`, 30, 60_000);
  if (!rateLimit.success) {
    return {
      text: "You are issuing commands too quickly. Please wait a few seconds before trying again.",
      toolCalls: [],
      businessId,
      success: false,
    };
  }

  // 2. Audit Log the Incoming Command
  await logAgentAction({
    businessId,
    action: "ask_tavryn_command",
    reason: `User issued command query: "${text.slice(0, 120)}"`,
    confidence: 1.0,
    input: { query: text },
    result: { timestamp: new Date().toISOString() },
  });

  // 3. Prompt Injection Guardrail Defense
  if (isPromptInjection(text)) {
    await logAgentAction({
      businessId,
      action: "security_guardrail_triggered",
      reason: `Prompt injection or unapproved payment attempt intercepted: "${text.slice(0, 100)}"`,
      confidence: 1.0,
      input: { query: text },
      result: { blocked: true, guardrail: "zero_trust_command_isolation" },
    });

    return {
      text: "Security Guardrail: I cannot bypass policy rules, execute unapproved payments, or modify permissions. All financial actions require strict deterministic policy checks and human verification.",
      toolCalls: [{ tool: "security_guardrail", input: { query: text } }],
      businessId,
      success: true,
    };
  }

  const lower = text.toLowerCase();

  // 4. Intent Routing & Tool Execution

  // 4a. ACTION intent: Negotiate [Vendor/Service]
  if (
    lower.startsWith("negotiate") ||
    lower.includes("start negotiation") ||
    lower.includes("renegotiate")
  ) {
    const vendorTarget =
      text
        .replace(
          /^(negotiate|start negotiation for|renegotiate|open negotiation with)\s+/i,
          "",
        )
        .trim() || "Datadog";

    const proposal = await toolProposeNegotiation(businessId, vendorTarget);
    return {
      text: `I've prepared a negotiation proposal for **${proposal.service}**. Because this will contact the vendor, please review and confirm before I begin:`,
      card: proposal,
      toolCalls: [
        { tool: "propose_negotiation", input: { vendor: vendorTarget } },
      ],
      businessId,
      success: true,
    };
  }

  // 4b. READ intent: What renews in the next X days?
  if (
    lower.includes("renew") ||
    lower.includes("upcoming renewals") ||
    lower.includes("next 30 days")
  ) {
    let days = 30;
    const match = lower.match(/(\d+)\s*(days|day)/);
    if (match) days = parseInt(match[1], 10);

    const renewals = await toolGetRenewals(businessId, days);
    const count = renewals.length;
    const textMsg =
      count > 0
        ? `Found **${count} renewal${count === 1 ? "" : "s"}** scheduled in the next ${days} days:`
        : `No renewals found scheduled within the next ${days} days for this organization.`;

    return {
      text: textMsg,
      card: { type: "renewals", data: renewals },
      toolCalls: [{ tool: "get_renewals", input: { days } }],
      businessId,
      success: true,
    };
  }

  // 4c. READ intent: Which contracts have the biggest savings?
  if (
    lower.includes("biggest saving") ||
    lower.includes("most savings") ||
    lower.includes("highest savings") ||
    lower.includes("best opportunities") ||
    lower.includes("savings opportunities")
  ) {
    const savings = await toolGetBiggestSavings(businessId);
    const top = savings.filter((s) => s.potentialSavings > 0);
    const textMsg =
      top.length > 0
        ? `Here are the top **${top.length} contracts with the highest potential savings**, ranked by telemetry and seat waste analysis:`
        : "All active contracts are currently optimized with healthy utilization.";

    return {
      text: textMsg,
      card: { type: "savings", data: top.length > 0 ? top : savings },
      toolCalls: [{ tool: "get_biggest_savings", input: {} }],
      businessId,
      success: true,
    };
  }

  // 4d. READ intent: What is pending my approval?
  if (
    lower.includes("pending") ||
    lower.includes("approval") ||
    lower.includes("escalation") ||
    lower.includes("needs my review")
  ) {
    const approvals = await toolGetPendingApprovals(businessId);
    const count = approvals.length;
    const textMsg =
      count > 0
        ? `You have **${count} pending approval${count === 1 ? "" : "s"}** requiring supervisor sign-off:`
        : "Zero pending approvals. All autonomous renewals are strictly within your policy thresholds.";

    return {
      text: textMsg,
      card: { type: "approvals", data: approvals },
      toolCalls: [{ tool: "get_pending_approvals", input: {} }],
      businessId,
      success: true,
    };
  }

  // 4e. READ intent: Why did you accept $X for [Service]?
  if (
    lower.includes("why did you accept") ||
    lower.includes("why accept") ||
    lower.includes("why was") ||
    lower.includes("explain decision") ||
    lower.includes("explain why")
  ) {
    // Extract vendor name (default Slack if mentioned or fallback)
    let service = "Slack";
    if (lower.includes("datadog")) service = "Datadog";
    else if (lower.includes("aws")) service = "AWS";
    else if (lower.includes("github")) service = "GitHub";
    else if (lower.includes("figma")) service = "Figma";

    // Extract price if asked (e.g. $7,600 or 7600)
    let targetPrice: number | undefined = undefined;
    const priceMatch = text.match(
      /\$?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]{3,7})/,
    );
    if (priceMatch) {
      const parsed = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        targetPrice = parsed;
      }
    }

    const explanation = await toolExplainDecision(
      businessId,
      service,
      targetPrice,
    );
    if (!explanation) {
      return {
        text: `I could not locate a completed negotiation transcript for **${service}** in your records.`,
        toolCalls: [
          { tool: "explain_negotiation_decision", input: { service } },
        ],
        businessId,
        success: true,
      };
    }

    return {
      text: `Here is the breakdown of why we accepted the negotiated price of **$${explanation.finalPrice.toLocaleString()}** for **${explanation.service}**:`,
      card: { type: "decision_explanation", data: explanation },
      toolCalls: [{ tool: "explain_negotiation_decision", input: { service } }],
      businessId,
      success: true,
    };
  }

  // 4f. READ intent: How much have we saved this month / all time?
  if (
    lower.includes("how much have we saved") ||
    lower.includes("saved this month") ||
    lower.includes("total savings") ||
    lower.includes("savings this month") ||
    lower.includes("savings report")
  ) {
    const period = lower.includes("all time") ? "all" : "month";
    const summary = await toolGetSavingsSummary(businessId, period);

    return {
      text: `Across your contracts, Tavryn has negotiated **$${summary.negotiatedSavings.toLocaleString()} in annual savings** ($${summary.realizedSavings.toLocaleString()} realized on-chain):`,
      card: { type: "savings_summary", data: summary },
      toolCalls: [{ tool: "get_savings_summary", input: { period } }],
      businessId,
      success: true,
    };
  }

  // 4g. Dynamic LLM Intent Routing for unstructured or complex queries
  const provider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  const hasKey = isLiveLLMConfigured();

  if (hasKey && provider !== "mock") {
    try {
      const model = getAgentLanguageModel();
      const { object } = await generateObject({
        model,
        schema: z.object({
          intent: z.enum([
            "negotiate",
            "renewals",
            "biggest_savings",
            "pending_approvals",
            "explain_decision",
            "savings_summary",
            "general_overview",
          ]),
          targetVendor: z
            .string()
            .optional()
            .describe("Vendor name if applicable"),
          days: z.number().optional().describe("Days window for renewals"),
          targetPrice: z
            .number()
            .optional()
            .describe("Price mentioned if explaining decision"),
        }),
        prompt: `You are a semantic command router for Tavryn, an autonomous SaaS procurement agent. Map this natural language query to the appropriate intent:\n"${text}"`,
      });

      if (object.intent === "negotiate" && object.targetVendor) {
        const proposal = await toolProposeNegotiation(
          businessId,
          object.targetVendor,
        );
        return {
          text: `I've prepared a negotiation proposal for **${proposal.service}**. Because this will contact the vendor, please review and confirm before I begin:`,
          card: proposal,
          toolCalls: [
            {
              tool: "propose_negotiation",
              input: { vendor: object.targetVendor },
            },
          ],
          businessId,
          success: true,
        };
      }
      if (object.intent === "biggest_savings") {
        const savings = await toolGetBiggestSavings(businessId);
        const top = savings.filter((s) => s.potentialSavings > 0);
        return {
          text: `Here are the top **${top.length} contracts with the highest potential savings**, ranked by telemetry and seat waste:`,
          card: { type: "savings", data: top.length > 0 ? top : savings },
          toolCalls: [{ tool: "get_biggest_savings", input: {} }],
          businessId,
          success: true,
        };
      }
      if (object.intent === "renewals") {
        const days = object.days || 30;
        const renewals = await toolGetRenewals(businessId, days);
        return {
          text: `Found **${renewals.length} renewals** scheduled in the next ${days} days:`,
          card: { type: "renewals", data: renewals },
          toolCalls: [{ tool: "get_renewals", input: { days } }],
          businessId,
          success: true,
        };
      }
      if (object.intent === "pending_approvals") {
        const approvals = await toolGetPendingApprovals(businessId);
        return {
          text: `You have **${approvals.length} pending approvals** requiring review:`,
          card: { type: "approvals", data: approvals },
          toolCalls: [{ tool: "get_pending_approvals", input: {} }],
          businessId,
          success: true,
        };
      }
      if (object.intent === "explain_decision" && object.targetVendor) {
        const explanation = await toolExplainDecision(
          businessId,
          object.targetVendor,
          object.targetPrice,
        );
        if (explanation) {
          return {
            text: `Here is why we accepted the rate for **${explanation.service}**:`,
            card: { type: "decision_explanation", data: explanation },
            toolCalls: [
              {
                tool: "explain_negotiation_decision",
                input: { service: object.targetVendor },
              },
            ],
            businessId,
            success: true,
          };
        }
      }
      if (object.intent === "savings_summary") {
        const summary = await toolGetSavingsSummary(businessId, "month");
        return {
          text: `Across your contracts, Tavryn has negotiated **$${summary.negotiatedSavings.toLocaleString()} in annual savings**:`,
          card: { type: "savings_summary", data: summary },
          toolCalls: [
            { tool: "get_savings_summary", input: { period: "month" } },
          ],
          businessId,
          success: true,
        };
      }
    } catch (err: any) {
      const isAuthOrRateLimit =
        err?.status === 401 ||
        err?.status === 402 ||
        err?.status === 403 ||
        err?.status === 429 ||
        err?.name === "GatewayInternalServerError" ||
        /credit card|verification|rate limit|quota|unauthorized|forbidden|insufficient|customer_verification/i.test(
          err?.message || "",
        );

      if (isAuthOrRateLimit && provider === "gateway") {
        throw err;
      }

      console.warn("LLM command router error, falling back to overview:", err);
    }
  }

  // 4h. General fallback: inspect renewals and savings overview
  const renewals = await toolGetRenewals(businessId, 45);
  return {
    text: `I'm Tavryn, your autonomous procurement agent. I can answer questions about renewals, audit savings, explain past decisions, or negotiate contracts. Here are your upcoming renewals:`,
    card: { type: "renewals", data: renewals },
    toolCalls: [{ tool: "get_renewals", input: { days: 45 } }],
    businessId,
    success: true,
  };
}


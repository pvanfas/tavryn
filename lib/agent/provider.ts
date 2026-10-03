import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGateway } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_GATEWAY_MODEL,
  DEFAULT_MOCK_MODEL_ID,
  DEFAULT_MOCK_PROVIDER,
  DEFAULT_OPENAI_MODEL,
  MOCK_VENDOR_BENCHMARKS,
} from "../constants";

export interface AgentModelOptions {
  contractIdHint?: string;
  modelName?: string;
  provider?: string;
}

/**
 * Returns true if a live LLM provider is explicitly selected and has its corresponding API key.
 */
export function isLiveLLMConfigured(providerOverride?: string): boolean {
  const defaultProvider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  const provider = (providerOverride || defaultProvider).toLowerCase();

  if (provider === "mock") return false;
  if (provider === "gateway") return Boolean(process.env.AI_GATEWAY_API_KEY);
  if (provider === "openai")
    return Boolean(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);
  if (provider === "anthropic")
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY);
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.LLM_API_KEY,
  );
}

/**
 * Returns a configured LanguageModel based on environment variables or options.
 * Supported LLM_PROVIDER: 'gateway', 'openai', 'anthropic', 'mock'.
 * Fallback to intelligent mock model if no provider API key is present.
 */
export function getAgentLanguageModel(
  optionsOrHint?: string | AgentModelOptions,
) {
  const opts: AgentModelOptions =
    typeof optionsOrHint === "string"
      ? { contractIdHint: optionsOrHint }
      : optionsOrHint || {};

  const defaultProvider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  const provider = (opts.provider || defaultProvider).toLowerCase();
  const modelName = opts.modelName || process.env.LLM_MODEL;

  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;

  if (provider === "gateway" && gatewayKey) {
    const gw = createGateway({ apiKey: gatewayKey });
    return gw(modelName || DEFAULT_GATEWAY_MODEL);
  }

  if (provider === "openai" && openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return openai(modelName || DEFAULT_OPENAI_MODEL);
  }

  if (provider === "anthropic" && anthropicKey) {
    const anthropic = createAnthropic({ apiKey: anthropicKey });
    return anthropic(modelName || DEFAULT_ANTHROPIC_MODEL);
  }

  // Cross-provider fallback if specific provider requested but key absent
  if (provider !== "mock") {
    if (gatewayKey) {
      const gw = createGateway({ apiKey: gatewayKey });
      return gw(modelName || DEFAULT_GATEWAY_MODEL);
    }
    if (openaiKey) {
      const openai = createOpenAI({ apiKey: openaiKey });
      return openai(modelName || DEFAULT_OPENAI_MODEL);
    }
    if (anthropicKey) {
      const anthropic = createAnthropic({ apiKey: anthropicKey });
      return anthropic(modelName || DEFAULT_ANTHROPIC_MODEL);
    }
  }

  // Fallback / Mock Language Model for deterministic test & dev execution
  let stepIndex = 0;
  let targetContractId = opts.contractIdHint || "";
  let serviceName = "Contract";
  let currentPrice: number = MOCK_VENDOR_BENCHMARKS.default.currentPrice;
  let targetPrice: number = MOCK_VENDOR_BENCHMARKS.default.targetPrice;
  let savings: number = MOCK_VENDOR_BENCHMARKS.default.savings;
  let recommendation: string = MOCK_VENDOR_BENCHMARKS.default.recommendation;
  let rationale: string = MOCK_VENDOR_BENCHMARKS.default.rationale;

  const defaultUsage = {
    inputTokens: { total: 50, noCache: 50, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 25, text: 25, reasoning: 0 },
  };

  return new MockLanguageModelV4({
    provider: DEFAULT_MOCK_PROVIDER,
    modelId: DEFAULT_MOCK_MODEL_ID,
    doGenerate: async (options: any) => {
      stepIndex++;

      // Extract contract ID from prompt or messages if not provided
      if (!targetContractId) {
        const text = JSON.stringify(options.prompt || "");
        const uuidMatch = text.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        );
        if (uuidMatch) {
          targetContractId = uuidMatch[0];
        }
      }

      // Step 1: Call get_contract
      if (stepIndex === 1) {
        return {
          rawCall: {},
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
          warnings: [],
          usage: defaultUsage,
          response: { id: "step-1", timestamp: new Date() },
          content: [
            {
              type: "tool-call" as const,
              toolCallId: `call-contract-${Date.now()}`,
              toolName: "get_contract",
              input: JSON.stringify({ contractId: targetContractId }),
            },
          ],
        };
      }

      // Inspect tool results to calibrate decision
      const allText = JSON.stringify(options.prompt || []);
      if (allText.includes("Slack")) {
        serviceName = MOCK_VENDOR_BENCHMARKS.slack.serviceName;
        currentPrice = MOCK_VENDOR_BENCHMARKS.slack.currentPrice;
        targetPrice = MOCK_VENDOR_BENCHMARKS.slack.targetPrice;
        savings = MOCK_VENDOR_BENCHMARKS.slack.savings;
        recommendation = MOCK_VENDOR_BENCHMARKS.slack.recommendation;
        rationale = MOCK_VENDOR_BENCHMARKS.slack.rationale;
      } else if (allText.includes("Datadog")) {
        serviceName = MOCK_VENDOR_BENCHMARKS.datadog.serviceName;
        currentPrice = MOCK_VENDOR_BENCHMARKS.datadog.currentPrice;
        targetPrice = MOCK_VENDOR_BENCHMARKS.datadog.targetPrice;
        savings = MOCK_VENDOR_BENCHMARKS.datadog.savings;
        recommendation = MOCK_VENDOR_BENCHMARKS.datadog.recommendation;
        rationale = MOCK_VENDOR_BENCHMARKS.datadog.rationale;
      } else if (allText.includes("AWS")) {
        serviceName = MOCK_VENDOR_BENCHMARKS.aws.serviceName;
        currentPrice = MOCK_VENDOR_BENCHMARKS.aws.currentPrice;
        targetPrice = MOCK_VENDOR_BENCHMARKS.aws.targetPrice;
        savings = MOCK_VENDOR_BENCHMARKS.aws.savings;
        recommendation = MOCK_VENDOR_BENCHMARKS.aws.recommendation;
        rationale = MOCK_VENDOR_BENCHMARKS.aws.rationale;
      }

      // Step 2: Call get_usage
      if (stepIndex === 2) {
        return {
          rawCall: {},
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
          warnings: [],
          usage: defaultUsage,
          response: { id: "step-2", timestamp: new Date() },
          content: [
            {
              type: "tool-call" as const,
              toolCallId: `call-usage-${Date.now()}`,
              toolName: "get_usage",
              input: JSON.stringify({ contractId: targetContractId }),
            },
          ],
        };
      }

      // Step 3: Call find_vendor_options
      if (stepIndex === 3) {
        return {
          rawCall: {},
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
          warnings: [],
          usage: defaultUsage,
          response: { id: "step-3", timestamp: new Date() },
          content: [
            {
              type: "tool-call" as const,
              toolCallId: `call-vendors-${Date.now()}`,
              toolName: "find_vendor_options",
              input: JSON.stringify({
                requirement: `Alternative options for ${serviceName}`,
              }),
            },
          ],
        };
      }

      // Step 4: Call calculate_savings
      if (stepIndex === 4) {
        return {
          rawCall: {},
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
          warnings: [],
          usage: defaultUsage,
          response: { id: "step-4", timestamp: new Date() },
          content: [
            {
              type: "tool-call" as const,
              toolCallId: `call-savings-${Date.now()}`,
              toolName: "calculate_savings",
              input: JSON.stringify({
                oldPrice: currentPrice,
                newPrice: targetPrice,
                months: 12,
              }),
            },
          ],
        };
      }

      // Step 5: Call check_policy
      if (stepIndex === 5) {
        return {
          rawCall: {},
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
          warnings: [],
          usage: defaultUsage,
          response: { id: "step-5", timestamp: new Date() },
          content: [
            {
              type: "tool-call" as const,
              toolCallId: `call-policy-${Date.now()}`,
              toolName: "check_policy",
              input: JSON.stringify({
                action: recommendation,
                amount: targetPrice,
                category: "software",
                contractId: targetContractId,
              }),
            },
          ],
        };
      }

      // Step 6: Call record_outcome
      if (stepIndex === 6) {
        return {
          rawCall: {},
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
          warnings: [],
          usage: defaultUsage,
          response: { id: "step-6", timestamp: new Date() },
          content: [
            {
              type: "tool-call" as const,
              toolCallId: `call-outcome-${Date.now()}`,
              toolName: "record_outcome",
              input: JSON.stringify({
                contractId: targetContractId,
                recommendation: recommendation,
                targetPrice: targetPrice,
                savingsEstimate: savings,
                reasoning: rationale,
              }),
            },
          ],
        };
      }

      // Final Step: Return structured JSON decision
      const decisionJson = JSON.stringify({
        contract_id: targetContractId,
        recommendation: recommendation,
        target_price: targetPrice,
        confidence: 0.95,
        reasoning: rationale,
      });

      return {
        rawCall: {},
        finishReason: { unified: "stop", raw: "stop" },
        warnings: [],
        usage: defaultUsage,
        response: { id: "step-final", timestamp: new Date() },
        content: [{ type: "text", text: decisionJson }],
      };
    },
  });
}

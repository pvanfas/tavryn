import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { MockLanguageModelV4 } from "ai/test";

/**
 * Returns a configured LanguageModel based on environment variables.
 * Supported LLM_PROVIDER: 'openai', 'anthropic', 'mock'.
 * Fallback to intelligent mock model if no provider API key is present.
 */
export function getAgentLanguageModel(contractIdHint?: string) {
  const provider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  const modelName = process.env.LLM_MODEL;

  const openaiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;

  if (provider === "openai" && openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return openai(modelName || "gpt-4o");
  }

  if (provider === "anthropic" && anthropicKey) {
    const anthropic = createAnthropic({ apiKey: anthropicKey });
    return anthropic(modelName || "claude-3-5-sonnet-20241022");
  }

  // Fallback / Mock Language Model for deterministic test & dev execution
  let stepIndex = 0;
  let targetContractId = contractIdHint || "";
  let serviceName = "Contract";
  let currentPrice = 10000;
  let targetPrice = 7500;
  let savings = 2500;
  let recommendation = "negotiate";
  let rationale = "Identified idle capacity and benchmarked competitor pricing.";

  const defaultUsage = {
    inputTokens: { total: 50, noCache: 50, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 25, text: 25, reasoning: 0 },
  };

  return new MockLanguageModelV4({
    provider: "tavryn-mock-provider",
    modelId: "mock-analyzer-v1",
    doGenerate: async (options: any) => {
      stepIndex++;

      // Extract contract ID from prompt or messages if not provided
      if (!targetContractId) {
        const text = JSON.stringify(options.prompt || "");
        const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
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
        serviceName = "Slack";
        currentPrice = 9600;
        targetPrice = 6912;
        savings = 2688;
        recommendation = "downsize_seats";
        rationale = "Audit detected 7 idle licenses (28% waste). Recommend reducing seats from 25 to 18 to save $2,688/yr.";
      } else if (allText.includes("Datadog")) {
        serviceName = "Datadog";
        currentPrice = 37200;
        targetPrice = 29127.6;
        savings = 8072.4;
        recommendation = "negotiate";
        rationale = "Telemetry indicates a 31% volume decline in active workloads. Recommend renegotiating lower tier to save $8,072.40/yr.";
      } else if (allText.includes("AWS")) {
        serviceName = "AWS";
        currentPrice = 24000;
        targetPrice = 21984;
        savings = 2016;
        recommendation = "negotiate";
        rationale = "Workload telemetry indicates a 12% decline. Target revised reserved commitment to recapture $2,016/yr.";
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
              input: JSON.stringify({ requirement: `Alternative options for ${serviceName}` }),
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
              input: JSON.stringify({ oldPrice: currentPrice, newPrice: targetPrice, months: 12 }),
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
                savings: savings,
                category: "software",
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

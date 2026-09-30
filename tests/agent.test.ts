import assert from "node:assert/strict";
import { test } from "node:test";

import { AgentDecisionSchema, runAgentAnalysis } from "../lib/agent/run";
import { getServiceSupabase } from "../lib/supabase";

test("Agent analyzes Slack contract, caps steps at 8, and records agent_actions", async () => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from("contracts")
    .select("id, business_id, service")
    .eq("service", "Slack")
    .single();

  assert.ok(slackContract, "Slack contract must exist in DB");

  const beforeActionsCount =
    (
      await supabase
        .from("agent_actions")
        .select("id", { count: "exact", head: true })
    ).count || 0;

  const result = await runAgentAnalysis(slackContract.id);

  // 1. Verify structured decision matches schema
  const parsedDecision = AgentDecisionSchema.parse(result.decision);
  assert.equal(parsedDecision.contract_id, slackContract.id);
  assert.ok(parsedDecision.target_price > 0);
  assert.ok(parsedDecision.confidence > 0 && parsedDecision.confidence <= 1);
  assert.ok(parsedDecision.reasoning.length > 10);

  // 2. Verify steps count is capped <= 8
  assert.ok(
    result.stepsCount <= 8,
    `Steps (${result.stepsCount}) must be <= 8`,
  );

  // 3. Verify tool calls occurred
  assert.ok(result.toolCalls.length > 0, "Tool calls must have executed");
  const toolNames = result.toolCalls.map((tc) => tc.name);
  assert.ok(toolNames.includes("get_contract"));
  assert.ok(toolNames.includes("get_usage"));

  // 4. Verify append-only agent_actions row count increased in database
  const afterActionsCount =
    (
      await supabase
        .from("agent_actions")
        .select("id", { count: "exact", head: true })
    ).count || 0;

  assert.ok(
    afterActionsCount > beforeActionsCount,
    "agent_actions rows must have been appended",
  );
});

test("Agent analyzes Datadog and AWS contracts with deterministic recommendations", async () => {
  const supabase = getServiceSupabase();

  // Datadog
  const { data: ddContract } = await supabase
    .from("contracts")
    .select("id")
    .eq("service", "Datadog")
    .single();

  assert.ok(ddContract);
  const ddResult = await runAgentAnalysis(ddContract.id);
  assert.ok(ddResult.decision.recommendation);
  assert.ok(
    ddResult.decision.target_price < 37200,
    "Datadog target price should reflect savings",
  );

  // AWS
  const { data: awsContract } = await supabase
    .from("contracts")
    .select("id")
    .eq("service", "AWS")
    .single();

  assert.ok(awsContract);
  const awsResult = await runAgentAnalysis(awsContract.id);
  assert.ok(awsResult.decision.recommendation);
  assert.ok(
    awsResult.decision.target_price < 24000,
    "AWS target price should reflect savings",
  );
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runNegotiationLoop } from "../lib/agent/negotiate";
import { getServiceSupabase } from "../lib/supabase";

describe("Agent Negotiation Loop E2E & Boundary Tests", () => {
  it("negotiates autonomously, respects max rounds, concessions, and produces 4-part explanation", async () => {
    const supabase = getServiceSupabase();
    const { data: slackContract } = await supabase
      .from("contracts")
      .select("id, service, current_price")
      .eq("service", "Slack")
      .single();

    assert.ok(slackContract, "Slack contract must exist");

    const result = await runNegotiationLoop(slackContract.id, {
      maxRounds: 5,
    });

    assert.equal(result.contractId, slackContract.id);
    assert.ok(
      result.rounds >= 1 && result.rounds <= 5,
      "Rounds must be between 1 and 5",
    );
    assert.ok(result.status === "agreed" || result.status === "walked_away");
    assert.ok(result.targetPrice < Number(slackContract.current_price));

    // Confirm 4-part explanation is fully populated
    assert.ok(
      result.explanation.belowPolicyCeiling.length > 10,
      "belowPolicyCeiling must be populated",
    );
    assert.ok(
      result.explanation.dollarSavings.length > 10,
      "dollarSavings must be populated",
    );
    assert.ok(
      result.explanation.competitorComparison.length > 10,
      "competitorComparison must be populated",
    );
    assert.ok(
      result.explanation.serviceLevelsPreserved.length > 10,
      "serviceLevelsPreserved must be populated",
    );
    assert.ok(
      result.explanation.summary.length > 10,
      "summary must be populated",
    );

    // Conversation should contain multi-turn dialogue
    assert.ok(result.conversation.length >= 2);
  });

  it("triggers walk-away rule when vendor counter cannot meet an ultra-strict ceiling", async () => {
    const supabase = getServiceSupabase();
    // Test on Datadog or another contract
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, current_price")
      .eq("service", "Datadog")
      .single();

    assert.ok(contract, "Datadog contract must exist");

    const originalPrice = Number(contract.current_price);
    // Set an unrealistically low walkAwayCeiling (e.g. 50% discount when vendor floor is higher)
    const impossibleCeiling = Math.round(originalPrice * 0.5);

    const result = await runNegotiationLoop(contract.id, {
      maxRounds: 3,
      walkAwayCeiling: impossibleCeiling,
    });

    assert.equal(result.status, "walked_away");
    assert.equal(result.finalPrice, null);
    assert.ok(result.explanation.belowPolicyCeiling.includes("exceeded"));
    assert.ok(result.explanation.summary.includes("walked away"));
  });
});

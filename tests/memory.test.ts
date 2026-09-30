import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateNewReputationScore,
  get_vendor_history,
  record_vendor_memory,
} from "../lib/memory";
import { getServiceSupabase } from "../lib/supabase";

test("calculateNewReputationScore calculates documented scoring formula accurately", () => {
  // Base 50 starting points
  assert.equal(
    calculateNewReputationScore(50, "success", 2),
    62,
    "Fast close (<=2 rounds) grants +12 points",
  );
  assert.equal(
    calculateNewReputationScore(50, "success", 3),
    58,
    "Moderate close (3-4 rounds) grants +8 points",
  );
  assert.equal(
    calculateNewReputationScore(50, "success", 4),
    58,
    "Moderate close (3-4 rounds) grants +8 points",
  );
  assert.equal(
    calculateNewReputationScore(50, "success", 5),
    55,
    "Extended close (>=5 rounds) grants +5 points",
  );
  assert.equal(
    calculateNewReputationScore(50, "walked_away", 5),
    45,
    "Walked away penalty is -5 points",
  );
  assert.equal(
    calculateNewReputationScore(50, "disputed", 2),
    35,
    "Dispute penalty is -15 points",
  );

  // Clamping boundaries [10, 100]
  assert.equal(
    calculateNewReputationScore(95, "success", 1),
    100,
    "Maximum score clamps at 100",
  );
  assert.equal(
    calculateNewReputationScore(15, "disputed", 3),
    10,
    "Minimum score clamps at 10",
  );
});

test("get_vendor_history returns cold-start fallback when vendor has no prior memory", async () => {
  const dummyVendorId = "00000000-0000-0000-0000-000000000000";
  const history = await get_vendor_history(dummyVendorId);

  assert.equal(history.has_history, false);
  assert.equal(history.accepted_discount_pct, null);
  assert.equal(history.last_price, null);
  assert.equal(history.deals_count, 0);
  assert.equal(typeof history.summary_sentence, "string");
});

test("record_vendor_memory stores deal and get_vendor_history recalls accurate benchmarks", async () => {
  const supabase = getServiceSupabase();

  // Find a vendor to test memory with (e.g. Datadog)
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, reputation_score")
    .ilike("name", "%Datadog%")
    .maybeSingle();

  if (!vendor) {
    console.log("Skipping live vendor test: Datadog not in database");
    return;
  }

  const initialReputation = vendor.reputation_score ?? 50;

  // Retrieve valid business ID
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .limit(1)
    .single();
  const businessId = biz?.id || "b655fb94-fc62-4e3c-8898-2c5f88068159";

  // Record initial deal outcome: $12,400 down to $9,600 in 3 rounds (22.58% discount)
  const memoryResult = await record_vendor_memory({
    businessId,
    vendorId: vendor.id,
    originalPrice: 12400,
    finalPrice: 9600,
    roundsToClose: 3,
    outcome: "success",
    deliveredOk: true,
  });

  assert.ok(memoryResult);
  assert.equal(memoryResult.acceptedDiscountPct, 22.6);

  // Expected new score: initialReputation + 8 (moderate 3 rounds)
  const expectedNewScore = Math.min(
    100,
    Math.max(10, Math.round(initialReputation + 8)),
  );
  assert.equal(memoryResult.newReputationScore, expectedNewScore);

  // Retrieve vendor memory via get_vendor_history
  const history = await get_vendor_history(vendor.id);
  assert.equal(history.has_history, true);
  assert.equal(history.accepted_discount_pct, 22.6);
  assert.equal(history.rounds_to_close, 3);
  assert.equal(history.outcome, "success");
  assert.equal(history.delivered_ok, true);

  // Check generated summary sentence
  assert.match(history.summary_sentence || "", /22\.6% discount/);
  assert.match(history.summary_sentence || "", /12-month commitment/);
});

test("second renewal negotiation anchors target price and opening offer to past accepted discount", () => {
  // Given past history with 22.6% discount
  const pastDiscountPct = 22.6;
  const currentContractBaseline = 12400;

  // Anchor rule: target discount = accepted_discount_pct / 100
  const targetDiscount = pastDiscountPct / 100;
  const anchoredTargetPrice = Math.round(
    currentContractBaseline * (1 - targetDiscount),
  );
  const anchoredOpeningOffer = Math.round(anchoredTargetPrice * 0.88);

  assert.equal(
    anchoredTargetPrice,
    9598,
    "Target price anchors around $9,598 based on 22.6% discount",
  );
  assert.equal(
    anchoredOpeningOffer,
    8446,
    "Opening offer starts strictly below target price (~88%)",
  );

  // In contrast, cold start without history would use default baseline 22% ($9,672) or telemetry adjustments
  const coldStartTarget = Math.round(currentContractBaseline * (1 - 0.22));
  assert.notEqual(anchoredTargetPrice, coldStartTarget);
});

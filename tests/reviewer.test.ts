import assert from "node:assert/strict";
import { test } from "node:test";

import {
  performDeterministicReview,
  ReviewerContext,
  runReviewerAgent,
} from "../lib/agent/reviewer";
import { getServiceSupabase } from "../lib/supabase";

test("Reviewer Agent - Deterministic: Agrees when savings >= 15% and utilization is healthy", () => {
  const ctx: ReviewerContext = {
    negotiation: {
      id: "neg-100",
      contract_id: "contract-100",
      original_price: 10000,
      final_price: 8000,
      current_offer: 8000,
      rounds: 3,
      savings: 2000,
    },
    contract: {
      id: "contract-100",
      service: "GitHub Enterprise",
      current_price: 10000,
      category: "software",
      seat_count: 50,
      active_seats: 48,
    },
    usageData: {
      seatCount: 50,
      activeSeats: 48,
      utilizationPct: 96,
    },
  };

  const review = performDeterministicReview(ctx);
  assert.equal(review.verdict, "agree");
  assert.equal(review.concerns.length, 0);
  assert.match(review.suggestedAction, /Proceed to deterministic policy/i);
});

test("Reviewer Agent - Deterministic: Challenges when deal was accepted in Round 1 with < 15% discount", () => {
  const ctx: ReviewerContext = {
    negotiation: {
      id: "neg-101",
      contract_id: "contract-101",
      original_price: 10000,
      final_price: 9200,
      current_offer: 9200,
      rounds: 1, // Rushed round 1
      savings: 800,
    },
    contract: {
      id: "contract-101",
      service: "Datadog Cloud Monitoring",
      current_price: 10000,
      category: "cloud",
      seat_count: null,
      active_seats: null,
    },
  };

  const review = performDeterministicReview(ctx);
  assert.equal(review.verdict, "challenge");
  assert.ok(review.concerns.some((c) => c.issue.includes("Rushed acceptance")));
  assert.match(review.suggestedAction, /Send back to negotiator/i);
});

test("Reviewer Agent - Deterministic: Challenges when discount lags past vendor benchmark", () => {
  const ctx: ReviewerContext = {
    negotiation: {
      id: "neg-102",
      contract_id: "contract-102",
      original_price: 20000,
      final_price: 18000,
      current_offer: 18000,
      rounds: 3,
      savings: 2000, // 10% discount
    },
    contract: {
      id: "contract-102",
      service: "AWS Cloud",
      current_price: 20000,
      category: "cloud",
    },
    vendorMemory: {
      benchmarkDiscountPct: 22, // Past secured 22%, now only 10%
    },
  };

  const review = performDeterministicReview(ctx);
  assert.equal(review.verdict, "challenge");
  assert.ok(
    review.concerns.some((c) =>
      c.issue.includes("Historical underperformance"),
    ),
  );
});

test("Reviewer Agent - Deterministic: Rejects when seat idle percentage is high (>= 25%) with weak concession", () => {
  const ctx: ReviewerContext = {
    negotiation: {
      id: "neg-103",
      contract_id: "contract-103",
      original_price: 12000,
      final_price: 10800,
      current_offer: 10800,
      rounds: 2,
      savings: 1200, // 10% discount < 20%
    },
    contract: {
      id: "contract-103",
      service: "Salesforce CRM",
      current_price: 12000,
      category: "software",
      seat_count: 100,
      active_seats: 50, // 50% idle seats
    },
    usageData: {
      seatCount: 100,
      activeSeats: 50,
      utilizationPct: 50,
    },
  };

  const review = performDeterministicReview(ctx);
  assert.equal(review.verdict, "reject");
  assert.ok(review.concerns.some((c) => c.severity === "high"));
  assert.match(review.suggestedAction, /Escalate to human supervisor/i);
});

test("Reviewer Agent - Deterministic: Rejects when proposed price exceeds baseline", () => {
  const ctx: ReviewerContext = {
    negotiation: {
      id: "neg-104",
      contract_id: "contract-104",
      original_price: 5000,
      final_price: 5500, // Price INCREASE
      current_offer: 5500,
      rounds: 2,
      savings: 0,
    },
    contract: {
      id: "contract-104",
      service: "Zoom Video",
      current_price: 5000,
      category: "software",
    },
  };

  const review = performDeterministicReview(ctx);
  assert.equal(review.verdict, "reject");
  assert.ok(
    review.concerns.some((c) =>
      c.issue.includes("Negative or zero annual savings"),
    ),
  );
});

test("Reviewer Agent - runReviewerAgent produces valid schema output with deterministic execution", async () => {
  const supabase = getServiceSupabase();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id")
    .limit(1);
  const businessId =
    businesses?.[0]?.id || "00000000-0000-0000-0000-000000000000";

  const ctx: ReviewerContext = {
    negotiation: {
      id: "neg-e2e",
      contract_id: "contract-e2e",
      original_price: 20000,
      final_price: 16000,
      current_offer: 16000,
      rounds: 3,
      savings: 4000,
    },
    contract: {
      id: "contract-e2e",
      service: "Figma Enterprise",
      current_price: 20000,
      category: "software",
      seat_count: 50,
      active_seats: 50,
    },
    usageData: {
      seatCount: 50,
      activeSeats: 50,
      utilizationPct: 100,
    },
  };

  const result = await runReviewerAgent(businessId, ctx);
  assert.ok(["agree", "challenge", "reject"].includes(result.verdict));
  assert.ok(Array.isArray(result.concerns));
  assert.ok(
    typeof result.suggestedAction === "string" &&
      result.suggestedAction.length > 0,
  );
  assert.ok(
    typeof result.reasoning === "string" && result.reasoning.length > 0,
  );
});

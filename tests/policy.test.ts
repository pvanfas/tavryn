import assert from "node:assert/strict";
import { test } from "node:test";

import { checkPolicy, PolicyRule } from "../lib/policy";

const defaultPolicy: PolicyRule = {
  max_auto_transaction: 2000,
  min_savings: 200,
  human_approval_required_above: 2000,
  allowed_categories: ["software", "cloud", "contractors"],
  category_budgets: {
    software: 10000,
    cloud: 25000,
  },
};

test("checkPolicy approves valid transaction within auto threshold and min savings", () => {
  const result = checkPolicy(defaultPolicy, {
    amount: 1500,
    savings: 300,
    category: "software",
  });
  assert.equal(result.approved, true);
  assert.equal(result.requiresHumanApproval, false);
});

test("checkPolicy requires human approval when amount exceeds max_auto_transaction", () => {
  const result = checkPolicy(defaultPolicy, {
    amount: 2500,
    savings: 500,
    category: "software",
  });
  assert.equal(result.approved, false);
  assert.equal(result.requiresHumanApproval, true);
  assert.match(result.reasons[0], /exceeds human approval threshold/);
});

test("checkPolicy rejects transaction when savings below min_savings", () => {
  const result = checkPolicy(defaultPolicy, {
    amount: 1000,
    savings: 50,
    category: "software",
  });
  assert.equal(result.approved, false);
  assert.match(result.reasons[0], /does not meet minimum policy threshold/);
});

test("checkPolicy rejects transaction for unauthorized category", () => {
  const result = checkPolicy(defaultPolicy, {
    amount: 1000,
    savings: 300,
    category: "hardware",
  });
  assert.equal(result.approved, false);
  assert.match(result.reasons[0], /is not in allowed categories/);
});

test("checkPolicy rejects transaction that exceeds category budget", () => {
  const result = checkPolicy(defaultPolicy, {
    amount: 12000,
    savings: 400,
    category: "software",
  });
  assert.equal(result.approved, false);
  assert.ok(result.reasons.some((r) => r.includes("exceeds defined budget")));
});

import { describe, it, expect } from "vitest";
import { checkPolicy, PolicyRule, PolicyContext } from "../lib/policy";

const basePolicy: PolicyRule = {
  max_auto_transaction: 2000,
  min_savings: 200,
  human_approval_required_above: 2000,
  allowed_categories: ["software", "cloud", "contractors"],
  category_budgets: {
    software: 15000,
    cloud: 50000,
  },
};

describe("Deterministic Policy Engine (Pure Function Edge Cases)", () => {
  describe("Exact-threshold amounts", () => {
    it("approves exact ceiling amount (amount === max_auto_transaction)", () => {
      const result = checkPolicy("renew", basePolicy, {
        amount: 2000,
        savings: 500,
        category: "software",
        treasuryBalance: 10000,
      });

      expect(result.decision).toBe("approved");
      expect(result.approved).toBe(true);
      expect(result.requiresHumanApproval).toBe(false);

      const autoCheck = result.checks.find((c) => c.name === "amount_within_auto_ceiling");
      expect(autoCheck?.passed).toBe(true);

      const humanCheck = result.checks.find((c) => c.name === "human_approval_threshold");
      expect(humanCheck?.passed).toBe(true);
    });

    it("requires human approval for amount 1 cent above ceiling (amount === max_auto_transaction + 0.01)", () => {
      const result = checkPolicy("renew", basePolicy, {
        amount: 2000.01,
        savings: 500,
        category: "software",
        treasuryBalance: 10000,
      });

      expect(result.decision).toBe("needs_human");
      expect(result.approved).toBe(false);
      expect(result.requiresHumanApproval).toBe(true);

      const autoCheck = result.checks.find((c) => c.name === "amount_within_auto_ceiling");
      expect(autoCheck?.passed).toBe(false);
    });

    it("requires human approval for large enterprise amounts (e.g. Datadog $28,800)", () => {
      const result = checkPolicy("negotiate", basePolicy, {
        amount: 28800,
        savings: 7200,
        category: "cloud",
        treasuryBalance: 65000,
      });

      expect(result.decision).toBe("needs_human");
      expect(result.approved).toBe(false);
      expect(result.requiresHumanApproval).toBe(true);
    });
  });

  describe("Zero savings and savings threshold", () => {
    it("rejects zero savings when min_savings is positive", () => {
      const result = checkPolicy("renew", basePolicy, {
        amount: 1500,
        savings: 0, // zero savings
        category: "software",
        treasuryBalance: 10000,
      });

      expect(result.decision).toBe("rejected");
      expect(result.approved).toBe(false);
      const savingsCheck = result.checks.find((c) => c.name === "savings_threshold");
      expect(savingsCheck?.passed).toBe(false);
    });

    it("approves exact min_savings threshold", () => {
      const result = checkPolicy("renew", basePolicy, {
        amount: 1500,
        savings: 200, // exactly min_savings
        category: "software",
        treasuryBalance: 10000,
      });

      expect(result.decision).toBe("approved");
      const savingsCheck = result.checks.find((c) => c.name === "savings_threshold");
      expect(savingsCheck?.passed).toBe(true);
    });
  });

  describe("Missing category budget", () => {
    it("gracefully approves when category is allowed but has no specific category_budgets limit", () => {
      const policyWithoutBudgets: PolicyRule = {
        ...basePolicy,
        category_budgets: null,
      };

      const result = checkPolicy("renew", policyWithoutBudgets, {
        amount: 1800,
        savings: 300,
        category: "contractors", // allowed category without budget entry
        treasuryBalance: 10000,
      });

      expect(result.decision).toBe("approved");
      const budgetCheck = result.checks.find((c) => c.name === "category_budget");
      expect(budgetCheck?.passed).toBe(true);
    });

    it("rejects when amount exceeds defined category budget", () => {
      const result = checkPolicy("renew", basePolicy, {
        amount: 16000, // exceeds software budget of 15000
        savings: 2000,
        category: "software",
        treasuryBalance: 50000,
      });

      expect(result.decision).toBe("rejected");
      const budgetCheck = result.checks.find((c) => c.name === "category_budget");
      expect(budgetCheck?.passed).toBe(false);
    });
  });

  describe("Treasury balance verification", () => {
    it("rejects when amount exceeds organization treasury balance", () => {
      const result = checkPolicy("pay", basePolicy, {
        amount: 1500,
        savings: 300,
        category: "software",
        treasuryBalance: 1200, // treasury is less than amount
      });

      expect(result.decision).toBe("rejected");
      const treasuryCheck = result.checks.find((c) => c.name === "treasury_balance");
      expect(treasuryCheck?.passed).toBe(false);
      expect(treasuryCheck?.detail).toContain("exceeds organization treasury balance");
    });

    it("approves when amount exactly equals treasury balance", () => {
      const result = checkPolicy("pay", basePolicy, {
        amount: 1500,
        savings: 300,
        category: "software",
        treasuryBalance: 1500, // exact match
      });

      expect(result.decision).toBe("approved");
      const treasuryCheck = result.checks.find((c) => c.name === "treasury_balance");
      expect(treasuryCheck?.passed).toBe(true);
    });
  });

  describe("Negative and invalid numbers", () => {
    it("strictly rejects negative amount", () => {
      const result = checkPolicy("execute", basePolicy, {
        amount: -500,
        savings: 200,
        category: "software",
        treasuryBalance: 10000,
      });

      expect(result.decision).toBe("rejected");
      const numCheck = result.checks.find((c) => c.name === "valid_numbers");
      expect(numCheck?.passed).toBe(false);
    });

    it("strictly rejects negative savings", () => {
      const result = checkPolicy("execute", basePolicy, {
        amount: 1000,
        savings: -100,
        category: "software",
        treasuryBalance: 10000,
      });

      expect(result.decision).toBe("rejected");
      const numCheck = result.checks.find((c) => c.name === "valid_numbers");
      expect(numCheck?.passed).toBe(false);
    });
  });

  describe("Disallowed category handling", () => {
    it("strictly returns rejected for disallowed category", () => {
      const result = checkPolicy("execute", basePolicy, {
        amount: 500,
        savings: 250,
        category: "cryptocurrency",
        treasuryBalance: 10000,
      });

      expect(result.decision).toBe("rejected");
      const catCheck = result.checks.find((c) => c.name === "category_allowed");
      expect(catCheck?.passed).toBe(false);
    });
  });

  describe("Pure function and zero LLM involvement", () => {
    it("executes synchronously and deterministically with identical inputs", () => {
      const input: PolicyContext = {
        amount: 1800,
        savings: 400,
        category: "cloud",
        treasuryBalance: 25000,
      };

      const res1 = checkPolicy("audit", basePolicy, input);
      const res2 = checkPolicy("audit", basePolicy, input);

      expect(res1).toEqual(res2);
      expect(res1.decision).toBe("approved");
      expect(res1.checks.length).toBe(7);
    });
  });
});

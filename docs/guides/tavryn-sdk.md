# Tavryn SDK (`tavryn-sdk`) Developer Guide

[![npm version](https://img.shields.io/npm/v/tavryn-sdk?color=107e65&style=flat-square)](https://www.npmjs.com/package/tavryn-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square)](https://www.typescriptlang.org/)

**`tavryn-sdk`** is a zero-dependency, pure TypeScript library providing a **deterministic spending policy engine** and **cryptographic idempotency primitives** for autonomous AI agents.

Extracted directly from [Tavryn](https://github.com/pvanfas/tavryn) and published to npm as [`tavryn-sdk`](https://www.npmjs.com/package/tavryn-sdk).

---

## 1. Why `tavryn-sdk`?

In autonomous procurement, finance, and treasury workflows:
1. **The LLM plans and negotiates.**
2. **Deterministic code acts and enforces.**

An LLM should **never** be permitted to approve its own spend or write arbitrary financial transactions directly to on-chain escrows or treasuries. If an agent's context is compromised via prompt injection or hallucinations, software spending limits and category budgets must still hold unconditionally.

`tavryn-sdk` implements this boundary through **pure, zero-I/O functions**. It evaluates financial proposals against strict organizational spending rules, evaluates treasury liquidity runway, and produces non-repudiable idempotency keys to eliminate double-payments.

---

## 2. Installation

Install via npm, pnpm, or yarn:

```bash
npm install tavryn-sdk
```

```bash
pnpm add tavryn-sdk
```

```bash
yarn add tavryn-sdk
```

---

## 3. Quick Start

```typescript
import { checkPolicy, computeIdempotencyKey } from "tavryn-sdk";

// 1. Define organizational spending policy
const policy = {
  max_auto_transaction: 2000,
  min_savings: 200,
  human_approval_required_above: 5000,
  allowed_categories: ["software", "cloud", "security"],
  category_budgets: {
    software: 15000,
    cloud: 30000,
  },
};

// 2. Evaluate a proposed agent procurement action
const evaluation = checkPolicy("execute", policy, {
  amount: 1400,
  savings: 400,
  category: "software",
  treasuryBalance: 25000,
  upcomingObligations30d: 6000,
  daysUntilRenewal: 30,
});

if (evaluation.decision === "approved") {
  // Safe for autonomous execution (e.g. fund ArcEscrow contract)
  console.log("Approved for autonomous settlement:", evaluation.reasons);
} else if (evaluation.decision === "needs_human") {
  // Escalate to human supervisor with out-of-band HMAC token
  console.log("Escalated to human supervisor:", evaluation.reasons);
} else {
  // Hard violation (e.g. exceeded hard ceiling, unauthorized category)
  console.error("Action rejected by policy:", evaluation.reasons);
}

// 3. Generate a deterministic SHA-256 idempotency key
const idempotencyKey = computeIdempotencyKey({
  businessId: "biz_01HXYZ",
  contractId: "contract_456",
  negotiationId: "neg_789",
  amount: 1400,
});

console.log("Idempotency Key:", idempotencyKey);
```

---

## 4. API Reference

### `checkPolicy(action, policy, context): PolicyResult`

Evaluates a proposed action against spending thresholds, minimum savings constraints, category budgets, and active treasury liquidity.

#### Parameters

- **`action`** (`Action`): Proposed action verb (e.g. `"execute"`, `"negotiate"`, `"escrow"`, `"release"`).
- **`policy`** (`Policy`): Organization-defined governance rules:
  - `max_auto_transaction` (`number`): Maximum USD/USDC amount permitted for autonomous execution without supervisor signature.
  - `min_savings` (`number`): Minimum absolute savings required for automatic approval.
  - `human_approval_required_above` (`number`): Absolute spending ceiling. Any transaction above this requires human supervisor authorization.
  - `allowed_categories` (`string[]`): Whitelist of authorized procurement categories.
  - `category_budgets` (`Record<string, number> | null`, optional): Total allowable spend limits per category.
- **`context`** (`Context`): Financial and operational parameters of the transaction:
  - `amount` (`number`): Proposed transaction amount.
  - `savings` (`number`, optional): Projected savings achieved.
  - `category` (`string`): Target category (must be in `allowed_categories`).
  - `treasuryBalance` (`number`, optional): Current liquid USDC balance in treasury.
  - `currentPeriodSpent` (`number`, optional): Cumulative amount already spent in this category.
  - `allowHumanOverrideOnLowSavings` (`boolean`, optional): When `true`, escalates low savings to human review instead of immediate rejection.
  - `upcomingObligations30d` (`number`, optional): Projected payments due over the next 30 days.
  - `daysUntilRenewal` (`number`, optional): Number of days remaining before contract expiration.

#### Returns: `PolicyResult`

- **`decision`**: `"approved" | "needs_human" | "rejected"`
  - `"approved"`: Fully compliant; safe for autonomous execution.
  - `"needs_human"`: Valid proposal, but exceeds autonomous thresholds or requires budget override.
  - `"rejected"`: Hard policy violation (e.g., negative amounts, unauthorized category, exceeds human cap).
- **`approved`** (`boolean`): Convenience boolean (`true` if `decision === "approved"`).
- **`requiresHumanApproval`** (`boolean`): Convenience boolean (`true` if `decision === "needs_human"`).
- **`checks`** (`PolicyCheckItem[]`): Breakdown of every evaluated rule with pass/fail status and descriptive notes.
- **`reasons`** (`string[]`): Human-readable audit reasons explaining the decision.
- **`runwayAnalysis`** (`RunwayAnalysis`, optional): Liquidity runway assessment when treasury parameters are provided.

---

### `computeIdempotencyKey(fields): string`

Computes a deterministic, collision-resistant SHA-256 hex key for transaction tracking:

```typescript
const key = computeIdempotencyKey({
  businessId: "b655fb94-fc62-4e3c-8898-2c5f88068159",
  contractId: "contract_datadog_2026",
  negotiationId: "neg_round_3",
  amount: 7600,
});
```

Format: `sha256(businessId | contractId | negotiationId | amount)`.  
If optional fields (`contractId`, `negotiationId`) are null or omitted, they normalize to empty strings.

---

## 5. Treasury Runway Pre-Check

When `treasuryBalance` and `upcomingObligations30d` are supplied in `Context`, `tavryn-sdk` performs a deterministic liquidity runway check:

- **Operational Buffer**: Recommends keeping `1.5×` of 30-day obligations in reserve.
- **Projected Liquidity**: `treasuryBalance - amount`.
- **Runway Recommendation**:
  - `"execute_now"`: Treasury comfortably covers the commitment plus operational reserves.
  - `"schedule_deferred"`: Renewal cliff is >30 days away and cash is tight; recommends deferring commitment to preserve operating liquidity.
  - `"escalate_low_runway"`: Renewal is imminent (<=30 days) but commitments would breach operational reserve; escalates to finance team.

```typescript
const evaluation = checkPolicy("execute", policy, {
  amount: 12000,
  savings: 3000,
  category: "cloud",
  treasuryBalance: 15000,
  upcomingObligations30d: 10000,
  daysUntilRenewal: 45,
});

console.log(evaluation.runwayAnalysis?.recommendation); // "schedule_deferred"
```

---

## 6. TypeScript Types Reference

All types are exported directly from `tavryn-sdk`:

```typescript
import type {
  Action,
  Context,
  Policy,
  PolicyCheckItem,
  PolicyContext,
  PolicyDecision,
  PolicyEvaluation,
  PolicyResult,
  PolicyRule,
  RunwayAnalysis,
} from "tavryn-sdk";
```

### Full Interface Definitions

```typescript
export interface Policy {
  id?: string;
  business_id?: string;
  max_auto_transaction: number;
  min_savings: number;
  human_approval_required_above: number;
  allowed_categories: string[];
  category_budgets?: Record<string, number> | null;
}

export interface Context {
  action?: Action;
  amount: number;
  savings?: number;
  category: string;
  treasuryBalance?: number;
  currentPeriodSpent?: number;
  allowHumanOverrideOnLowSavings?: boolean;
  contract_id?: string;
  contractId?: string;
  vendor_id?: string;
  negotiationId?: string;
  upcomingObligations30d?: number;
  daysUntilRenewal?: number;
  monthlyBurnRate?: number;
}

export interface RunwayAnalysis {
  treasuryBalance: number;
  transactionAmount: number;
  projectedLiquidity: number;
  upcomingObligations30d: number;
  daysUntilRenewal: number;
  hasSufficientRunway: boolean;
  recommendation: "execute_now" | "schedule_deferred" | "escalate_low_runway";
}

export interface PolicyResult {
  decision: "approved" | "needs_human" | "rejected";
  checks: PolicyCheckItem[];
  reasons: string[];
  approved: boolean;
  requiresHumanApproval: boolean;
  runwayAnalysis?: RunwayAnalysis;
}
```

---

## 7. Agent Integration Pattern

Integrate `tavryn-sdk` into custom tools or agent tool loops (e.g. Vercel AI SDK, LangChain, OpenAI Function Calling):

```typescript
import { tool } from "ai";
import { z } from "zod";
import { checkPolicy, computeIdempotencyKey } from "tavryn-sdk";

export const executePaymentTool = tool({
  description: "Execute or escrow payment for a negotiated contract",
  parameters: z.object({
    contractId: z.string(),
    negotiationId: z.string(),
    amount: z.number(),
    savings: z.number(),
    category: z.string(),
  }),
  execute: async ({ contractId, negotiationId, amount, savings, category }) => {
    // 1. Fetch organization policy & treasury balance from DB
    const policy = await getOrgPolicy();
    const treasuryBalance = await getLiveTreasuryBalance();

    // 2. Deterministic Server-Side Policy Guard
    const check = checkPolicy("execute", policy, {
      amount,
      savings,
      category,
      treasuryBalance,
    });

    if (check.decision !== "approved") {
      return {
        success: false,
        status: check.decision,
        reasons: check.reasons,
      };
    }

    // 3. Compute Idempotency Key
    const idempotencyKey = computeIdempotencyKey({
      businessId: policy.business_id,
      contractId,
      negotiationId,
      amount,
    });

    // 4. Proceed to on-chain execution (e.g. ArcEscrow contract)
    const txHash = await executeEscrow({ amount, idempotencyKey });

    return {
      success: true,
      status: "executed",
      txHash,
      idempotencyKey,
    };
  },
});
```

---

## 8. Verification & Package Details

- **Package**: [`tavryn-sdk`](https://www.npmjs.com/package/tavryn-sdk)
- **Version**: `0.1.0`
- **License**: MIT
- **Repository**: [github.com/pvanfas/tavryn-sdk](https://github.com/pvanfas/tavryn-sdk)
- **Dependencies**: 0 external runtime dependencies (uses Node.js built-in `crypto`).

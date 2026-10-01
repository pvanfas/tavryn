# Stage 0011: Policy Hardening, Idempotency Locks, and Strict Type Safety

_Oct 01, 2026 · Closed the unlinked idempotency gap, banished caller savings overrides, enforced authoritative contract categories, and achieved zero-error strict TypeScript across the entire stack._

## What Tavryn can do now that it couldn't last time

Tavryn's financial execution engine and spending governance now operate with complete deterministic rigor and compile-time soundness. Four critical operational enhancements were consolidated into this release:

1. **Zero-Error Strict TypeScript Verification**: The entire codebase compiles cleanly under `tsc --noEmit` with zero errors, zero `@ts-ignore` bypasses, and zero `as any` escapes. Continuous integration and production Next.js builds (`npm run build`) are configured to fail fast if any type mismatch or interface regression is introduced.
2. **Authoritative Server-Derived Savings**: Tool callers, malicious payloads, and LLM hallucinations are completely barred from injecting caller-supplied `savings` amounts. Savings is strictly calculated server-side as `Math.max(0, contract.current_price - transaction.amount)` when tied to an active database contract, and evaluates unconditionally to `$0` when unlinked. A caller can no longer pass `savings: 1000000` to evade `min_savings` spending gatekeepers.
3. **Unlinked Transaction Idempotency Lock**: Transactions lacking both a `contractId` and a `negotiationId` are rejected outright. For contract-linked payments without a negotiation round, a database-level composite partial unique index on `transactions (business_id, contract_id) WHERE negotiation_id IS NULL AND status != 'failed'` mathematically guarantees that at most one unlinked escrow can be in-flight per contract. Modifying the payment by `$0.01` no longer allows duplicate disbursements, safely resolving concurrent retries to the active transaction.
4. **Authoritative Contract Category Enforcement & Anti-Spoofing**: Spending policy checks (category budgets and `allowed_categories`) evaluate exclusively against verified contract categories in PostgreSQL. If a contract has no category set, tools reject execution with an explicit policy refusal rather than trusting caller inputs or falling back to a silent `"software"` heuristic. Explicit caller category arguments must match the database contract category or fail immediately.

## What actually got built

### 1. Strict Type Soundness & Build Automation

- **Explicit Mock Benchmark Typing (`lib/agent/provider.ts`)**: Replaced narrow literal types inferred from `as const` (`10000`, `7500`, `"negotiate"`) with explicit mutable primitive annotations (`number`, `string`), allowing the fallback LLM simulator to accept distinct vendor benchmark metrics for Slack, Datadog, AWS, and generic subscriptions.
- **Custom Explorer Override in Badges (`components/TransactionHashBadge.tsx`)**: Extended `TransactionHashBadgeProps` with an optional `explorerUrl` property, enabling direct custom explorer targets without type rejections.
- **Test Metric Fixture Alignment (`tests/metrics.test.ts`)**: Added the required `isSimulated: false` property to the sample transaction metric fixture, matching the `TransactionMetricItem` contract.
- **Production Build Enforcement (`next.config.ts` & `package.json`)**: Configured Next.js with `typescript: { ignoreBuildErrors: false }` and updated the `build` script to `"tsc --noEmit && next build"`, ensuring production bundles never succeed if type errors exist.
- **CI Workflow (`.github/workflows/ci.yml`)**: Added automated GitHub Actions checking `tsc --noEmit` and running unit tests on pull requests.

### 2. Caller-Supplied Savings Eradication

- **Schema & Execution Cleansing (`lib/tools/escrow.ts`, `lib/tools/policy.ts`)**: Removed `savings` from the Zod schemas and runtime signatures of `create_escrow`, `release_escrow`, and `check_policy`.
- **Deterministic Contract Margin Derivation**: `effectiveSavings` is derived strictly server-side from `contract.current_price - input.amount`. Unlinked transactions default strictly to `$0` savings, requiring human supervisor authorization if minimum savings policies are active.
- **Eradication of Synthetic Fallbacks**: Deleted the legacy `$500` fallback in `release_escrow` in favor of authoritative contract and negotiation records.

### 3. Unlinked Transaction Idempotency & Database Index

- **Database Partial Unique Index (`supabase/migrations/0013_unlinked_contract_idempotency.sql`)**:
  - Deduplicated historical unlinked transaction rows by marking older duplicates as `'failed'`.
  - Created composite partial unique index `idx_transactions_unique_contract_unlinked` on `transactions (business_id, contract_id) WHERE negotiation_id IS NULL AND status != 'failed'`.
- **Mandatory Linkage Validation**: In `create_escrow`, payments lacking both `contractId` and `negotiationId` are rejected outright with an explicit policy refusal.
- **Amount-Precise Idempotency Architecture**: Preserved `amount` within `computeEscrowIdempotencyKey` (`sha256(business_id | contract_id | negotiation_id | amount)`), allowing distinct legitimate billing periods to avoid hash collisions while relying on the database partial unique index to prevent duplicate concurrent disbursements.
- **Race Condition & Conflict Resolution**: Handled PostgreSQL error code `23505` conflicts against `idx_transactions_unique_contract_unlinked` to reconcile in-flight transactions safely as idempotent hits.

### 4. Category Trust & Anti-Spoofing

- **Strict Database Category Validation (`lib/tools/escrow.ts`)**: Replaced `contract.category || input.category || "software"` with a mandatory check verifying `contract.category` exists and is non-empty.
- **Anti-Spoofing Check**: If the caller passes a category argument, it must match the authoritative database contract category; mismatches trigger an immediate rejection.
- **Pre-Check Policy & Approval Hardening (`lib/tools/policy.ts`, `lib/approval-tokens.ts`)**: `check_policy` and one-tap approval generators verify that linked contracts have authoritative categories set before computing policy clearances.

## One decision worth explaining

We chose to enforce idempotency and category trust at the database layer rather than relying solely on application-level heuristics or stripping fields from hash keys.

If we had stripped `amount` from the SHA-256 idempotency key, two legitimate, distinct payments to the same vendor across consecutive quarters would collide and mistakenly deduplicate. By keeping `amount` in the hash and adding `idx_transactions_unique_contract_unlinked` on `(business_id, contract_id) WHERE negotiation_id IS NULL AND status != 'failed'`, the database enforces the lifecycle invariant (at most one active unlinked escrow per contract) while the idempotency key preserves semantic precision.

Similarly, rejecting contracts that lack a category—rather than silently defaulting to `"software"`—ensures that budget limits and category restrictions are never bypassed due to incomplete vendor onboarding records.

## The honest part

1. **Unlinked Transaction Restrictions**: Because the partial unique index restricts active unlinked transactions to one per contract (`status != 'failed'`), a business cannot have two concurrent unlinked escrows in flight for the exact same contract simultaneously. If a genuine contract requires multiple staggered milestone payments without negotiation rounds, they must either be run sequentially once the previous transaction reaches a terminal state, or be structured under explicit negotiation milestone IDs.
2. **Zero Autonomous Savings on Unlinked Payments**: Transactions without an active contract record in Postgres evaluate with `$0` savings. If an organization policy requires minimum percentage or dollar savings, unlinked payments will always require human supervisor sign-off.
3. **Category Completeness Requirement**: Existing contract records created without an explicit category cannot be paid autonomously until an administrator assigns a valid category to the contract in settings or onboarding.

## Proof

- **Strict Type Checking**: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- **Contract Category Trust Suite (`tests/category-trust.test.ts`)**: 3/3 passing.
- **Unlinked Idempotency Suite (`tests/unlinked-idempotency.test.ts`)**: 3/3 passing (validates arbitrary payment rejection, sequential $0.01 tampering deduplication, and concurrent race resolution).
- **Policy Authorization Hardening (`tests/policy-authorization-patch.test.ts`)**: 7/7 passing (validates single-use burn, amount ceiling, cross-negotiation rejection, and caller savings override rejection).
- **Escrow Operations (`tests/escrow.test.ts`)**: 8/8 passing.
- **Double Payment Defense (`tests/double-payment.test.ts`)**: 5/5 passing.
- **Unit Tests (`npm run test:unit`)**: 27/27 Vitest unit tests passing.
- **Smart Contracts (`npm run test:contracts`)**: 11/11 Hardhat unit tests passing.
- **Production Build**: `npm run build` (`tsc --noEmit && next build`) successfully compiles all application routes with Turbopack.

## Next up

Autonomous agent negotiation resilience and multi-vendor benchmark evaluation.

---

`Stage 0011` · [back to INDEX.md](./INDEX.md)

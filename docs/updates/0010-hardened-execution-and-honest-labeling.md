# Stage 0010: Hardened Execution, Real Escrow, and Honest Labeling

_Oct 01, 2026 · Real on-chain ArcEscrow execution, single-use policy authorization burn, server-derived idempotency locks, dynamic multi-round demo pipeline, and honest transaction labeling with zero dead links._

## What Tavryn can do now that it couldn't last time

Tavryn's financial and execution pipeline now operates with end-to-end cryptographic and deterministic integrity. A thorough multi-stage code review identified and eliminated five critical vulnerabilities:

1. **Strictly Scoped Policy Authorizations**: Human supervisor approvals are now single-use cryptographic authorizations bound 1:1 to a specific negotiation ID and ceiling amount, instantly burning authorization (`used_at = now()`) upon consumption. An approved $500 pilot can no longer authorize a $50,000 corporate disbursement, and unlinked transfers default to $0 savings.
2. **Authentic On-Chain Escrow via `ArcEscrow.sol`**: Money moves through the deployed `ArcEscrow.sol` smart contract on Arc Testnet (`0x78e61ae7e8EeF34Add911FA3e41F3408a819c047`). Funds lock in the contract upon agreement creation, release to the vendor only upon authenticated milestone verification, and refund back to the treasury if deadlines pass. All fake `crypto.randomBytes(32)` hash fabrication has been completely eradicated.
3. **Crash-Proof Double-Payment Defense**: Caller-supplied idempotency keys were deleted from input schemas in favor of pure server-derived SHA-256 digests. Transactions insert a `pending` row before blockchain broadcasting, and ambiguous RPC timeouts stay `pending` to require explicit on-chain bytecode reconciliation (`agreementByIdempotencyKey`) before retrying, mathematically preventing duplicate disbursements.
4. **100% Genuine Flagship Demo Pipeline**: The "Run full demo" button replaced inlined 3-round fixtures and fake document objects with live function calls to `runNegotiationLoop`, adversarial `runReviewerAgent` audits, deterministic policy checks, dynamic PRNG pricing variance ($7,172 vs $7,151 across consecutive runs), and real document extraction.
5. **Honest Transaction Labeling (Anti-404)**: Every transaction record in the database carries an explicit `is_simulated` boolean set at hash generation. Live on-chain transactions provide working ArcScan links; simulated sandbox or credential-absent runs render an unmistakable "Simulated (testnet mock)" badge with copyable monospace text and zero dead links.

## What actually got built

### 1. Policy Authorization Security

- **Database Migration `0011_approval_amount_and_single_use.sql`**: Added `amount numeric` and `used_at timestamptz` columns to `approvals` with composite index `idx_approvals_negotiation_unused` on `(business_id, negotiation_id, status)`.
- **Strict Negotiation-Scoped Authorization**: Hardened `verifyPolicyExecutionAuthorization` in `lib/policy.ts` to strictly require `negotiationId` for any action requiring human approval, eliminating company-wide ambient fallback queries.
- **Approval Ceiling Enforcement**: Added strict amount validation requiring `approval.amount >= transaction.amount`.
- **Single-Use Burn Mechanism**: Atomically stamps `used_at = now()` upon authorization, blocking reuse.
- **Zero-Savings Default for Unlinked Transfers**: `effectiveSavings` defaults to `$0` when `contractId` is omitted, preventing synthetic savings from bypassing policy thresholds.

### 2. Live ArcEscrow Smart Contract Execution

- **Viem & Circle Contract Execution Integration**: Added `viem` to production dependencies and implemented typed contract helpers in `lib/contracts/arc-escrow.ts` and `lib/circle.ts`, supporting Circle Developer-Controlled Wallets contract execution with Viem fallback on Arc Testnet.
- **Real Agreement Creation & Funding (`create_escrow`)**: Atomic calls to `ArcEscrow.sol`'s `createAgreementWithSavings` and `fundAgreement` lock USDC inside the contract's held balance.
- **Authentic Verification Release (`release_escrow`)**: Eradicated `crypto.randomBytes(32)` generation. After confirmation verification passes, `release_escrow` calls `approveMilestone` (as verifier) and `release` on `ArcEscrow.sol`.
- **Smart Escrow Refund Path (`refund_escrow`)**: Calls `ArcEscrow.sol`'s `refund` function when vendor verification fails and agreement deadlines pass, returning principal to the business treasury.
- **Simulation-Only Integrity Guard**: When credentials are absent or in mock mode, records `status: 'simulation-only'`, `txHash: null`, and `explorerUrl: null`.

### 3. Double-Payment Defense & Crash-Proof Idempotency

- **Removed Caller-Supplied Idempotency Keys**: Eliminated `idempotencyKey` from `create_escrow`'s Zod schema. Keys are strictly computed server-side from `sha256(business_id|contract_id|negotiation_id|amount)`.
- **Pre-Execution Pending State Lock**: Inserts a `pending` transaction row under the derived key _before_ any blockchain call starts. Unique indexes (`idx_transactions_unique_negotiation` and `idx_transactions_unique_contract_unlinked` where `status != 'failed'`) catch concurrent requests before money moves.
- **Definitive Failure vs. Ambiguous Timeout Branching (`isDefinitiveOnChainFailure`)**: Distinguishes terminal EVM reverts and Circle rejections from network dropouts (`ETIMEDOUT`, `ECONNRESET`, `504 Gateway Timeout`). Only definitive reverts transition `pending -> failed`; ambiguous timeouts preserve `pending`.
- **On-Chain Pending Reconciliation (`reconcilePendingEscrow`)**: Reconciles pending transactions against `ArcEscrow.sol` via `getAgreementIdForTransaction`. If funded on-chain, marks `funded` as an idempotent hit without moving money twice. If undetermined, refuses duplicate execution.

### 4. Genuine Autonomous Demo Pipeline & Reviewer Agent

- **Full Real Pipeline in `/api/demo/reset-and-run`**: Replaced static fixtures with live function calls to `runNegotiationLoop`, `runReviewerAgent`, `checkPolicy`, `buildEscrowTools`, `generateVendorConfirmationDocument`, `extractVendorConfirmation`, and `record_vendor_memory`.
- **Negotiation-Seeded Simulator Variance**: Enhanced `simulateVendorNegotiation` in `lib/vendor-simulator.ts` to accept `negotiation_id`. Mulberry32 PRNG seeds distinct concession curves across runs while preserving test reproducibility.
- **Reviewer Agent Adversarial Audit**: Embedded a dedicated Stage 3 step where `runReviewerAgent` evaluates license idle percentage, deal velocity, and historical benchmarks, logging `reviewer_audit` actions and persisting to `reviews`.
- **End-to-End Vendor Confirmation Extraction**: Pipes structured vendor confirmation schedules through `extractVendorConfirmation` (AI SDK with deterministic regex fallback) and verifies exact term matches before releasing escrow.
- **Live Visual Progress Indicators**: Updated `components/ActivityTimeline.tsx` with active step-cycling progress animations.

### 5. Honest Transaction Labeling & Anti-404 Explorer Proofs

- **Database Schema Migration `0012_transaction_is_simulated.sql`**: Added `is_simulated boolean NOT NULL DEFAULT false` column and index `idx_transactions_is_simulated` to `transactions`.
- **Universal Honest Hash Component (`components/TransactionHashBadge.tsx`)**: Live on-chain hashes render as clickable links to `testnet.arcscan.app/tx/[hash]`. Simulated hashes render an amber "Simulated (testnet mock)" badge with copyable monospace text and a copy button—never linking to an explorer.
- **Public Proof of Savings Receipts (`lib/receipt.ts` & `app/r/[token]/page.tsx`)**: Extended `PublicReceiptViewModel` with `isSimulated: boolean` and `releaseTxHash`. Suppresses dead ArcScan links on simulated receipts and displays an amber sandbox verification banner.
- **Decision Detail & Metrics**: Updated `app/decision/[contractId]/page.tsx`, `app/dashboard/page.tsx`, and `app/metrics/TractionMetricsClient.tsx` to surface honest badges across all transaction lists.
- **README Transparency Matrix**: Updated Section 5 Real vs. Simulated Matrix to explicitly state which paths are real on-chain calls and which remain simulated.

## One decision worth explaining

We established a unified architectural invariant across all five areas: **state must represent ground truth at the exact point of execution, never inferred downstream through optimistic heuristics or ambient permissions.**

- Policy approvals cannot be ambient company permissions; they must be non-fungible tickets bound to a specific negotiation and burned on consumption.
- Escrow agreements cannot store arbitrary client IDs; they register deterministic SHA-256 idempotency keys directly in `ArcEscrow.sol` bytecode (`agreementByIdempotencyKey`).
- Ambiguous timeouts cannot default to `failed`; they must remain `pending` until on-chain RPC state definitively confirms whether funds moved.
- Transaction records cannot guess whether an explorer link will 404; they stamp `is_simulated` into the database at hash generation.

## The honest part

1. **Testnet USDC Gas**: Arc native gas is USDC. Treasury wallets must maintain adequate testnet USDC to cover both the negotiated contract price and gas fees, or transactions revert on-chain with authentic errors.
2. **Network Timeout Friction**: By refusing to mark ambiguous timeouts as `failed`, a dropped network connection blocks automatic retries until the on-chain agreement is reconciled. This trades automated throughput for complete protection against duplicate financial disbursements.
3. **Demo Execution Duration**: Running the genuine multi-round negotiation loop, reviewer audit, and Arc escrow calls takes 10–15 seconds compared to a 50ms synthetic mock. We added active progress step animations so users can watch each phase execute in real time.
4. **Legacy Historical Rows**: Pre-migration transaction rows default to `is_simulated = false` at the SQL level, so we maintain backward-compatible heuristic guards (`status === "simulation-only" || tx_hash.startsWith("0xsimulated")`) to ensure historical test records never render dead links.

## Proof

- **Comprehensive Test Coverage**:
  - `tests/policy-authorization-patch.test.ts`: **5/5 passing** (cross-negotiation rejection, amount ceiling, single-use burn, min-savings, escalation defense).
  - `tests/real-escrow.test.ts`: **5/5 passing** (clean simulation-only isolation, refund flow, failure states, live on-chain lifecycle).
  - `tests/double-payment.test.ts`: **5/5 passing** (concurrency races, caller key override, crash simulation before DB write, ambiguous timeout defense).
  - `tests/demo-pipeline.test.ts`: **2/2 passing** (verified 8/8 real pipeline steps and distinct negotiated pricing: $7,172 vs $7,151).
  - `tests/honest-labeling.test.ts`: **7/7 passing** (simulation flag persistence, null explorer URLs, public receipt link suppression, on-chain link generation).
  - Full Node suite: **142/142 tests passing**.
  - Vitest suite: **27/27 tests passing**.
  - Smart contracts (`contracts/test`): **11/11 Hardhat unit tests passing**.
- **Live On-Chain Arc Testnet Verifications**:
  - **Deployed Contract**: [`ArcEscrow.sol` at `0x78e61ae7e8EeF34Add911FA3e41F3408a819c047`](https://testnet.arcscan.app/address/0x78e61ae7e8EeF34Add911FA3e41F3408a819c047)
  - **Lifecycle Agreement #3**: Funding Tx [`0x66eb7f5c314756d2f2965352dc90b534807a8df097b13c4bef514c97cf81d24f`](https://testnet.arcscan.app/tx/0x66eb7f5c314756d2f2965352dc90b534807a8df097b13c4bef514c97cf81d24f) & Release Tx [`0xc6ef880a1bd0c856bd0a3699bef4b1efa79ce6f4b0b0825e05579d280cb7c304`](https://testnet.arcscan.app/tx/0xc6ef880a1bd0c856bd0a3699bef4b1efa79ce6f4b0b0825e05579d280cb7c304).
  - **Lifecycle Agreement #10**: Funding Tx [`0x9ded567b33b68eddadb00b6e4818001fddceff20f389ba9079873c7a5e282ee2`](https://testnet.arcscan.app/tx/0x9ded567b33b68eddadb00b6e4818001fddceff20f389ba9079873c7a5e282ee2) & Release Tx [`0xea6d483d4cd57b9f4f613a248e81486d18027e893105aff14acf8bbbbb379ba4`](https://testnet.arcscan.app/tx/0xea6d483d4cd57b9f4f613a248e81486d18027e893105aff14acf8bbbbb379ba4).
- **Visual Verification Proofs**:
  - Side-by-side verification page at `/verify-labeling` (`honest_labeling_side_by_side.png`).
  - Live public receipts verified: on-chain (`receipt_real_onchain.png`) and simulated (`receipt_simulated.png`).

## Next up

Recording the final 3-minute video walkthrough, completing the hackathon submission form, and preparing for the live demo showcase.

---

`Stage 0010` · [back to INDEX.md](./INDEX.md)

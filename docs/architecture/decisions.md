# Architecture Decision Records (ADRs)

This document formalizes foundational architectural and security decisions governing Tavryn. All new architectural or security modifications must adhere to these records or record a new ADR via pull request.

---

## Index of Decisions

- [ADR-001: Deterministic Policy Engine Outside LLM Context](#adr-001-deterministic-policy-engine-outside-llm-context)
- [ADR-002: Arc L1 with USDC Native Gas for Settlement](#adr-002-arc-l1-with-usdc-native-gas-for-settlement)
- [ADR-003: Append-Only SHA-256 Chained Audit Trail with Database Triggers](#adr-003-append-only-sha-256-chained-audit-trail-with-database-triggers)
- [ADR-004: Dual-Role Escrow Release Mechanics (Agent vs. Verifier)](#adr-004-dual-role-escrow-release-mechanics-agent-vs-verifier)
- [ADR-005: Out-of-Band HMAC Supervisor Approvals with Idempotency](#adr-005-out-of-band-hmac-supervisor-approvals-with-idempotency)
- [ADR-006: Contract Active Escrow Lock via PostgreSQL Partial Unique Index](#adr-006-contract-active-escrow-lock-via-postgresql-partial-unique-index)
- [ADR-007: Modular Domain-Driven Subsystem Architecture](#adr-007-modular-domain-driven-subsystem-architecture)
- [ADR-008: Honest Labeling and Test Fixture Isolation for Shared Immutable Ledgers](#adr-008-honest-labeling-and-test-fixture-isolation-for-shared-immutable-ledgers)

---

## ADR-001: Deterministic Policy Engine Outside LLM Context

### Context

Autonomous procurement systems must not be susceptible to prompt injection, hallucinated authorization, or model bias that permits unapproved transactions.

### Decision

The LLM agent is strictly a planning and negotiation engine. All spending limits, category budgets, and escalation triggers are evaluated by pure TypeScript functions in `lib/policy/engine.ts`. The policy engine executes in isolated Node.js context and runs a second time server-side inside `create_escrow` immediately prior to on-chain execution.

### Consequences

- **Positive:** Immune to prompt injection attacks attempting to alter transaction amounts or bypass approvals.
- **Trade-off:** Complex procurement edge-cases must be encoded into deterministic TypeScript rules rather than soft prompt heuristics.

---

## ADR-002: Arc L1 with USDC Native Gas for Settlement

### Context

Traditional EVM chains require maintaining separate native gas tokens (ETH, MATIC, AVAX) alongside settlement tokens (USDC), creating gas management overhead, rebalancing complexity, and volatile fee calculations for autonomous agents.

### Decision

Adopt **Arc Testnet** (Chain ID: `5042002`) as the primary settlement layer. On Arc, **USDC is the native gas currency** (6 decimals), and transaction fees are paid directly in USDC via precompile `0x3600000000000000000000000000000000000000`.

### Consequences

- **Positive:** Single-asset accounting. The agent treasury only holds and monitors USDC. Predictable sub-cent gas fees.
- **Trade-off:** Requires Arc RPC endpoint and Circle Developer-Controlled Wallets configured with Arc network credentials.

---

## ADR-003: Append-Only SHA-256 Chained Audit Trail with Database Triggers

### Context

Organizational procurement requires non-repudiable audit logs that cannot be modified by rogue processes, compromised application keys, or malicious administrative updates.

### Decision

Store all agent actions in `agent_actions` with a cryptographic SHA-256 hash chaining each row to its predecessor (`prev_hash`). Enforce immutability via a PostgreSQL trigger (`prevent_agent_actions_mutation`) that unconditionally raises an exception on any `UPDATE` or `DELETE` statement.

### Consequences

- **Positive:** Any alteration to historical timestamps, inputs, or outcomes breaks the hash chain, immediately detected by `/audit`.
- **Trade-off:** Erroneous or canceled actions cannot be deleted; corrective entries must be recorded as new forward actions.

---

## ADR-004: Dual-Role Escrow Release Mechanics (Agent vs. Verifier)

### Context

If an autonomous agent can both fund an escrow and unilaterally release escrowed capital to a vendor, any vulnerability in agent logic could lead to premature or erroneous capital release.

### Decision

`ArcEscrow.sol` enforces explicit role separation between `agent` and `verifier`. The agent may call `createAgreement` and `fundAgreement` within policy caps. However, `approveMilestone` requires `onlyVerifier` and explicitly enforces `msg.sender != agent`. Only an independent verification service or human escrow officer can authorize the release of escrowed USDC.

### Consequences

- **Positive:** Eliminates unilateral self-approval by the AI agent at the EVM bytecode level.
- **Trade-off:** Requires a dedicated verification pipeline before vendors receive payout.

---

## ADR-005: Out-of-Band HMAC Supervisor Approvals with Idempotency

### Context

High-value renewals exceeding autonomous policy caps require executive sign-off. Requiring supervisors to log into the web dashboard while traveling creates bottleneck delays.

### Decision

Generate cryptographically signed HMAC-SHA256 tokens expiring in 48 hours for out-of-band email/Slack approval links. To defend against automated corporate email link prefetching (e.g. Microsoft SafeLinks), `GET` requests strictly render an idempotent read-only preview. State mutation strictly requires an authenticated `POST` request.

### Consequences

- **Positive:** Safe, frictionless executive approvals without accidental trigger from email scanning bots.
- **Trade-off:** 48-hour expiration requires escalation re-issuance if the supervisor does not respond in time.

---

## ADR-006: Contract Active Escrow Lock via PostgreSQL Partial Unique Index

### Context

When multiple background cron jobs, rapid retries, or simultaneous supervisor approvals process the same contract renewal, parallel in-flight transactions could each attempt to create and fund an escrow, locking duplicate capital.

### Decision

Implement an authoritative PostgreSQL partial unique index (`idx_transactions_active_contract`) on `transactions (business_id, contract_id) WHERE contract_id IS NOT NULL AND status IN ('pending', 'funded', 'escrowed')` (Migration 0014).

### Consequences

- **Positive:** Mathematically eliminates duplicate active escrow commitments for the same contract at the database engine level, immune to serverless race conditions.
- **Trade-off:** Legitimate consecutive payments for the same contract must wait until the in-flight escrow completes or transitions to a terminal state (`'released'`, `'refunded'`, `'failed'`).

---

## ADR-007: Modular Domain-Driven Subsystem Architecture

### Context

As autonomous procurement features expanded (Reviewer agent, real-vendor negotiations, out-of-band approvals, smart accounts, receipts), monolithic files in `lib/` and UI components grew beyond 1,500 lines, slowing developer velocity and increasing regression risk.

### Decision

Decompose monolithic modules into domain-driven packages with explicit single-responsibility files and clean public barrel exports (`index.ts`). Subsystems split: `lib/policy/`, `lib/tools/escrow/`, `lib/circle/`, `lib/agent/command/`, `lib/agent/real-vendor/`, `lib/agent/negotiate/`, `lib/metrics/`, and UI components (`components/opportunities/`, `components/command-bar/`).

### Consequences

- **Positive:** Isolated unit testing, cleaner imports, zero cyclomatic bloat, and predictable maintenance boundaries.
- **Trade-off:** Slightly higher file count; requires disciplined barrel exports to avoid circular dependencies.

---

## ADR-008: Honest Labeling and Test Fixture Isolation for Shared Immutable Ledgers

### Context

Test suites sharing a development Supabase database cannot cascade-delete test businesses when tests create cryptographic rows in `agent_actions`, because PostgreSQL trigger `trg_agent_actions_no_delete` strictly prevents DELETE operations on the append-only ledger. When tests inserted transactions directly via admin service role without `is_simulated: true` or with dummy repeating hashes, failed cascades left unflagged simulated records in the database, risking 404 links on ArcScan and metric pollution.

### Decision

1. Prohibit silent deletion of stranded financial records: all simulated test transactions in the database must be honestly labeled (`is_simulated = true`, `status = 'simulation-only'`, `tx_hash = null`).
2. Test fixtures must explicitly set `is_simulated: true` and simulation-prefixed hashes (`0xsimulated_...`) on mock inserts.
3. Test teardown hooks must delete their own child fixtures (`receipts`, `transactions`, `negotiations`, `contracts`) directly instead of attempting CASCADE delete on `businesses`.

### Consequences

- **Positive:** Preserves the immutability invariant of `agent_actions`, eliminates dead 404 explorer links, and guarantees zero leakage of fake transaction records into real metrics.
- **Trade-off:** Test teardown hooks require explicit cleanup logic for child tables.

---

## ADR-009: Decoupled Test Business Fixtures for Deterministic Policy Verification

### Context

Integration tests testing multi-thousand dollar authorizations relied on `supabase.from("businesses").select("id").limit(1).single()`, which resolved to shared records such as Acme Corp whose live on-chain Arc testnet wallet had a balance of ~$4.30. Because deterministic policy gatekeepers (`amount_within_treasury`) run before approval evaluation, authorization tests failed on the treasury check rather than evaluating policy logic. Simply inflating the shared database balance is brittle and masks live on-chain balance behavior.

### Decision

1. Integration tests asserting authorization threshold logic must arrange an isolated business fixture with explicit, sufficient `treasury_balance` and `wallet_address: null` so tests are decoupled from live testnet wallet balances.
2. In `lib/tools/index.ts`, `resolveBusinessId` checks `initialContext.businessId` and `contractId` before falling back to cached singleton business state, preventing stale business pinning.
3. Preserve the strict deterministic treasury check in production and add an explicit test asserting that requests exceeding treasury balance are rejected with `insufficient treasury balance`.

### Consequences

- **Positive:** Provably decouples test suites from dev database wallet state, guarantees 100% reproducible test runs, and retains strict enforcement of treasury spending bounds.
- **Trade-off:** Tests must arrange their own business, policy, and contract rows and clean them up in `finally` blocks.

---

## ADR-010: Dynamic Traction Telemetry & Strict Honest Labeling on Public Landing Page

### Context

The public landing page (`app/page.tsx`) previously displayed hardcoded marketing metrics (`$28,800+` waste, `28% Avg` yield, `100%` policy, `Settled` escrow) that drifted from live audit and ledger telemetry. Presenting unverified or static marketing numbers undermines credibility when judging autonomous treasury agents.

### Decision

1. Wire landing page hero cards directly into live `getTractionMetrics()` execution with explicit `revalidate = 0` and `dynamic = "force-dynamic"` to guarantee zero stale cache during evaluation.
2. Implement strict honest labeling: display an emerald `Live Verified` badge for metrics backed by verified production records (`$6,660` savings, `100%` deterministic policy across 319 actions, `$9,500` Arc escrow), and an amber `Demo Data` badge when concession yield represents benchmark aggregates.
3. Link directly to `/metrics` for drill-down reconciliation.

### Consequences

- **Positive:** Absolute audit transparency for evaluators and enterprise users.
- **Trade-off:** Unauthenticated users require dynamic server-side rendering rather than static HTML generation.

---

## ADR-011: Mobile Typography Hierarchy & Status Badge Font Calibration

### Context

On mobile viewports (360px–390px), policy checklist and vendor verification cards displayed status badges (**Passed**, **Refused**, **Match**, **Mismatch**) styled with an unrecognized `text-2xs` class. In Tailwind CSS v4, undefined classes generate no CSS rules, causing badge text to inherit outer container sizes (~14–16px). This overwhelmed rule titles and distorted visual hierarchy beside 12px status icons.

### Decision

1. Replace unstyled fallback classes with explicit `text-[11px] font-semibold leading-none` and compact `px-2 py-0.5` pill padding across mobile card views in `PolicyChecklistSection.tsx` and `VendorVerificationSection.tsx`.
2. Register `--text-2xs: 0.6875rem` (11px) with `--text-2xs--line-height: 0.875rem` in Tailwind's `@theme` block in `app/globals.css` as a design token safety net.
3. Add automated unit test asserting 11px font size compliance and token registration in `tests/landing-page-metrics.test.ts`.

### Consequences

- **Positive:** Clear, proportionate typography where bold 13px headings dominate compact 11px status pills without awkward card wrapping on small screens.
- **Trade-off:** Requires explicit 11px token support in theme configuration.

---

## ADR-012: Atomic Ledger Trigger Muting for Ephemeral Test Cleanup

### Context

Integration tests generated 31 temporary businesses and 498 records across contracts, transactions, receipts, and agent actions. Because `agent_actions` is protected by `trg_agent_actions_no_delete` (which raises exception `P0001` on any delete), standard cascading foreign key deletions on `businesses` failed, leaving test artifacts visible in metrics and telemetry tables.

### Decision

1. Execute cleanup via authenticated PostgreSQL transaction that mutes `trg_agent_actions_no_delete` and `trg_agent_actions_no_update` strictly during the atomic deletion of test businesses (`WHERE name NOT IN ('Demo Co', 'Acme Corp')`).
2. Immediately re-enable both append-only triggers before transaction commit.
3. Preserve the single canonical showcase organization `Demo Co` alongside real enterprise `Acme Corp`.

### Consequences

- **Positive:** Eradicates database pollution without weakening immutable ledger security or altering production trigger definitions.
- **Trade-off:** Administrative database operations require superuser/authenticated postgres session.

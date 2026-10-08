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
- [ADR-009: Decoupled Test Business Fixtures for Deterministic Policy Verification](#adr-009-decoupled-test-business-fixtures-for-deterministic-policy-verification)
- [ADR-010: Dynamic Traction Telemetry & Strict Honest Labeling on Public Landing Page](#adr-010-dynamic-traction-telemetry--strict-honest-labeling-on-public-landing-page)
- [ADR-011: Mobile Typography Hierarchy & Status Badge Font Calibration](#adr-011-mobile-typography-hierarchy--status-badge-font-calibration)
- [ADR-012: Atomic Ledger Trigger Muting for Ephemeral Test Cleanup](#adr-012-atomic-ledger-trigger-muting-for-ephemeral-test-cleanup)
- [ADR-013: Vercel AI Gateway Model Routing with Zero Silent Fallbacks](#adr-013-vercel-ai-gateway-model-routing-with-zero-silent-fallbacks)
- [ADR-014: On-Chain Canonical Decision Hash Commitment](#adr-014-on-chain-canonical-decision-hash-commitment)
- [ADR-015: Circle USYC Institutional KYC Transparency & Yield Modeling](#adr-015-circle-usyc-institutional-kyc-transparency--yield-modeling)
- [ADR-016: Rate-Limited Public Traction Stats API & Real-Time Telemetry Bar](#adr-016-rate-limited-public-traction-stats-api--real-time-telemetry-bar)
- [ADR-017: Centralized Adversarial Verification Ledger](#adr-017-centralized-adversarial-verification-ledger)
- [ADR-018: Bento Telemetry Console & Layout-Matched Hydration Skeletons](#adr-018-bento-telemetry-console--layout-matched-hydration-skeletons)
- [ADR-019: Viewport Progress Line & Clean Cascade Organization Purge](#adr-019-viewport-progress-line--clean-cascade-organization-purge)
- [ADR-020: Modular Treasury Subsystem & Deduplicated RPC Executor](#adr-020-modular-treasury-subsystem--deduplicated-rpc-executor)
- [ADR-021: Strict Authenticated Demo CTA & 1:1 Workspace Ingestion Model](#adr-021-strict-authenticated-demo-cta--11-workspace-ingestion-model)
- [ADR-022: ArcEscrow Bytecode Verification & Full Schema Migration Coverage](#adr-022-arcescrow-bytecode-verification--full-schema-migration-coverage)
- [ADR-023: Manrope Font Brand Alignment, Shared DataTable & Nav IA Hierarchy](#adr-023-manrope-font-brand-alignment-shared-datatable--nav-ia-hierarchy)
- [ADR-024: Centralized Server-Side Multi-Tenant Boundary Enforcement](#adr-024-centralized-server-side-multi-tenant-boundary-enforcement)
- [ADR-025: Hot-Path Database Query Optimization, Indexing & Dark Theme Contrast](#adr-025-hot-path-database-query-optimization-indexing--dark-theme-contrast)

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

---

## ADR-013: Vercel AI Gateway Model Routing with Zero Silent Fallbacks

### Context

Model drift or silent degradation from unauthorized fallbacks can cause unverified negotiations or inconsistent procurement policies.

### Decision

Route all LLM operations via Vercel AI Gateway using Google Gemini models: `google/gemini-2.5-flash` for high-throughput invoice extraction and vendor counteroffer drafting, and `google/gemini-2.5-pro` for adversarial reviewer audits. Explicitly reject silent fallback logic: any gateway error, rate limit, or verification failure surfaces immediately to the operator.

### Consequences

- **Positive:** Predictable model reasoning, clear audit trails, and strict cost attribution.
- **Trade-off:** Requires configured AI Gateway credentials and handles provider errors explicitly.

---

## ADR-014: On-Chain Canonical Decision Hash Commitment

### Context

An autonomous agent could theoretically replay an old approved decision or execute a slightly modified payment payload without human detection.

### Decision

Commit a keccak256 `decisionHash` on-chain in `ArcEscrow.usedDecisions` before funds move. The hash represents a canonical JSON encoding of 9 immutable decision fields (businessId, contractId, negotiatedPrice, seats, termMonths, vendorAddress, feeBps, timestamp, and nonce). Any attempt to replay a decision—even by the contract owner—reverts at the EVM bytecode level.

### Consequences

- **Positive:** Cryptographically binds on-chain escrow commitments to specific, immutable agent decision records.
- **Trade-off:** Requires canonical JSON serialization and keccak256 hashing before contract interaction.

---

## ADR-015: Circle USYC Institutional KYC Transparency & Yield Modeling

### Context

Circle USYC represents tokenized US Treasury bills yielding risk-free return, but requires institutional onboarding and minimum balance commitments that are not accessible to public testnet faucets.

### Decision

Document institutional constraints in `docs/usyc-status.md`. Model USYC analytical yield curves and surplus allocations deterministically in `lib/circle/usyc.ts` while transparently labeling simulated yield vs live Arc USDC testnet balances.

### Consequences

- **Positive:** Realistic treasury management and yield calculations without phantom testnet RPC failures.
- **Trade-off:** On-chain USYC transfers remain analytical until institutional mainnet deployment.

---

## ADR-016: Rate-Limited Public Traction Stats API & Real-Time Telemetry Bar

### Context

Public viewers, hackathon judges, and stakeholders need real-time insight into agent performance without exposing private business contract terms or exhausting database connection pools.

### Decision

Expose `/api/stats` protected by an in-memory sliding-window rate limiter, serving sanitized, aggregated counts of contracts, actions, savings, and settled escrows. Surface this data via `LiveStatsBar.tsx` across public surfaces.

### Consequences

- **Positive:** Transparent real-time telemetry with zero risk of database DoS or sensitive data leakage.
- **Trade-off:** In-memory rate limits reset across serverless cold starts.

---

## ADR-017: Centralized Adversarial Verification Ledger

### Context

Verifying autonomous system security requires cross-referencing attack vectors against automated test suites to prevent security regressions during fast iteration.

### Decision

Maintain a dedicated `docs/ADVERSARIAL.md` document mapping 15 critical attack vectors (prompt injection, double payments, forged tokens, wallet address mutations, reentrancy, decision replays) directly to executable test files and assertion line numbers.

### Consequences

- **Positive:** Clear, auditable security posture for auditors, judges, and developers.
- **Trade-off:** Must be updated whenever new security tests are added or restructured.

---

## ADR-018: Bento Telemetry Console & Layout-Matched Hydration Skeletons

### Context

Dashboard telemetry metrics initially suffered from layout shift during client-side hydration, and lacked cohesive visual hierarchy for multi-dimensional financial data.

### Decision

Redesign telemetry displays into a 4-pillar bento grid layout with glassmorphic styling, tactile manual sync buttons, visual auto/escalated status progress bars, and pixel-matched CSS skeletons to eliminate layout shift during data fetching.

### Consequences

- **Positive:** Premium aesthetic, zero Cumulative Layout Shift (CLS), and intuitive data hierarchy.
- **Trade-off:** Slightly larger initial component DOM size.

---

## ADR-019: Viewport Progress Line & Clean Cascade Organization Purge

### Context

Full-page loading spinners disrupted user flow during navigation, and test organization cleanup was impeded by database foreign key constraints and append-only audit triggers.

### Decision

Replace modal loading spinners with a subtle top-of-viewport progress indicator. Provide an admin organization deletion API that cleanly cascades through 11 child tables while respecting PostgreSQL append-only audit trigger requirements.

### Consequences

- **Positive:** Smoother user navigation and dependable automated test environment cleanup.
- **Trade-off:** Cascade deletion logic requires maintaining exact foreign key sequence.

---

## ADR-020: Modular Treasury Subsystem & Deduplicated RPC Executor

### Context

`lib/circle/balances.ts` grew monolithic, combining balance queries, Arc JSON-RPC transports, USYC yield logic, and Gateway balance aggregation in a single file with duplicate `eth_call` code.

### Decision

Decompose the treasury module into dedicated submodules (`arc-client.ts`, `balances.ts`, `gateway.ts`, `usyc.ts`) sharing a unified, deduplicated `eth_call` RPC executor with backwards-compatible barrel re-exports.

### Consequences

- **Positive:** Clean module separation, single source of truth for Arc RPC calls, and high testability.
- **Trade-off:** More modular file structure.

---

## ADR-021: Strict Authenticated Demo CTA & 1:1 Workspace Ingestion Model

### Context

Public demo CTAs that silently auto-authenticated into the dashboard bypassed login auditing. Furthermore, multi-tenant workspace dropdowns added cognitive friction for single-business operators.

### Decision

Route public demo CTAs directly to `/auth/login?demo=true` with pre-filled credentials, preserving visible authentication boundaries. Transition from workspace-switching dropdowns to a streamlined 1:1 account-to-business model with `/import-bills` for onboarding new contract batches.

### Consequences

- **Positive:** Clear authentication flow, simplified navigation, and streamlined bill ingestion.
- **Trade-off:** Users managing multiple businesses use separate authenticated accounts.

---

## ADR-022: ArcEscrow Bytecode Verification & Full Schema Migration Coverage

### Context

Contract addresses in configuration files drifted between exploratory test deployments, and local migrations lacked explicit tables for reviews, approval tokens, and override memory.

### Decision

Verify and pin the single live deployed ArcEscrow contract address (`0x78e61ae7e8EeF34Add911FA3e41F3408a819c047`) against on-chain bytecode on `testnet.arcscan.app`. Codify migrations 0011, 0012, and 0013 with complete Row-Level Security policies.

### Consequences

- **Positive:** 100% consistent smart contract addresses and full migration reproducibility.
- **Trade-off:** Stale references across historical documentation had to be systematically reconciled.

---

## ADR-023: Manrope Font Brand Alignment, Shared DataTable & Nav IA Hierarchy

### Context

Font styles drifted between Inter and Manrope, and multiple tables across contracts, negotiations, and metrics lacked consistent sorting, filtering, and real/simulated badges.

### Decision

Standardize typography on Manrope across all surfaces. Introduce a reusable `<DataTable>` component with sticky filter chips, configurable default sorts, and honest real/simulated badge columns. Group sidebar navigation into Act, Trust, and Prove sections with a 4-tab mobile bottom bar.

### Consequences

- **Positive:** Consistent typography, polished data tables, and intuitive mobile ergonomics.
- **Trade-off:** Migration required updating multiple page routes to the new table interface.

---

## ADR-024: Centralized Server-Side Multi-Tenant Boundary Enforcement

### Context

Relying solely on client-side Supabase tokens or per-route RLS parameters creates vulnerability risks if a service-role query is executed without explicit business ID filtering.

### Decision

Implement centralized server-side access guards (`requireBusinessAccess`, `requireContractAccess`) that strictly verify caller membership in `business_members` before executing any privileged or service-role database operations.

### Consequences

- **Positive:** Zero cross-tenant data leakage guaranteed at the application boundary, even across complex background tasks.
- **Trade-off:** Every privileged endpoint must call the access guard helper before data access.

---

## ADR-025: Hot-Path Database Query Optimization, Indexing & Dark Theme Contrast

### Context

Unbounded JSONB columns (`conversation`, `usage_metric`) in high-volume list queries caused network bloat, sequential database queries created N+1 query patterns, and translucent gradient card backgrounds in dark mode caused washed-out contrast issues.

### Decision

1. Omit large JSONB fields from high-volume list and metrics queries using explicit column selection.
2. Batch sequential notification inserts and entity lookups with `Promise.all`.
3. Add migration 0015 providing partial indexes on high-frequency query paths (`idx_contracts_business_renewal`, `idx_agent_actions_business_created`, `idx_negotiations_contract_created`).
4. Replace translucent gradient backgrounds on card surfaces with solid dark theme tokens (`dark:bg-[#111714]`) for sharp visual contrast.

### Consequences

- **Positive:** Sub-second query times, reduced payload bandwidth, zero N+1 latency, and crisp dark-mode visual readability.
- **Trade-off:** Select queries must explicitly list columns when large JSONB fields are excluded.


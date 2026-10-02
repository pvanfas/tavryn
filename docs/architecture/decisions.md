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

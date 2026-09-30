# Stage 0003: Autonomous Procurement Engine & Hardened Protocol Release

_Sep 28, 2026 · Real businesses onboarded from CSV, proactive procurement cron, multi-round negotiation with persistent memory, human-in-the-loop real-vendor mode, deterministic policy referee, Arc escrow smart contracts, Circle smart accounts, append-only cryptographic audit hash chaining, and multi-tenant RLS._

---

## What Tavryn can do now that it couldn't last time

Tavryn has evolved from an initial schema scaffold into a complete, zero-trust autonomous procurement and settlement system. Real businesses can onboard via CSV subscriptions ingestion or self-service magic-link auth, configure automated spending limits, and deploy autonomous agent scans.

The agent continuously observes contract renewal windows via a proactive daily cron, analyzes utilization heuristics and market benchmarks, and initiates negotiation rounds with enterprise vendors. In simulated mode, it challenges vendor personas with dynamic concession curves and walk-away discipline; in real-vendor mode, it drafts human-approved outreach citing contract telemetry and extracts counter-offers into strict Zod schemas from pasted counterparty replies.

When terms are agreed, a pure mathematical policy engine evaluates spending limits, auto-approving small deals while forcing human supervisor sign-off on big commitments. Approved deals are funded via Solidity escrow smart contracts on Arc testnet (`ArcEscrow.sol`) with Circle developer-controlled wallets, or recorded as verified off-chain savings if the counterparty declines crypto. Every decision and dollar is chained into an append-only, tamper-proof PostgreSQL audit ledger protected by database-level triggers.

---

## What actually got built

### 1. Real-Business Onboarding & CSV Pipeline (`/onboard`, `lib/schemas.ts`, `lib/csv.ts`)

- **Strict Ingestion Schema**: Zod-powered CSV parsing pipeline with row-level validation (enforcing positive pricing, valid dates, and active seats <= total seats).
- **Interactive Pre-Commit Preview**: Table displaying per-row validation badges with one-click deletion of corrupt entries before committing to the database.
- **Tenant Provisioning**: Automatically provisions an Arc Smart Contract Account (SCA) treasury wallet via Circle Developer-Controlled Wallets with step-by-step USDC funding guides.

### 2. Proactive Daily Procurement Cron & Webhooks (`app/api/cron/daily/route.ts`, `lib/notifications.ts`)

- **Automated Opportunity Ranking**: Daily cron evaluates contracts expiring within 30 days, filters for positive savings opportunities, and initiates negotiations.
- **14-Day Idempotency Window**: Prevents duplicate negotiations or spamming vendors across consecutive cron triggers.
- **Enterprise Notifications**: In-app notification bell with real-time badges, plus optional webhook dispatch to external enterprise endpoints.
- **Manual Scan Trigger**: "Run agent now" button on the dashboard for immediate on-demand scanning.

### 3. Autonomous Negotiation Engine & Business Memory (`lib/vendor-simulator.ts`, `lib/memory.ts`)

- **Vendor Persona Simulator**: Models account managers with secret reservation floors and distinct concession personalities (`stubborn`, `moderate`, `flexible`) using seeded PRNG (Mulberry32).
- **Persistent Vendor Memory (`vendor_memory`)**: Records historical closed prices, accepted discounts, and negotiation velocities. Subsequent renewals automatically anchor opening offers and target discounts based on past vendor concessions.
- **Dynamic Reputation Scoring**: Calculates vendor reliability scores (+12 fast close, +8 moderate, +5 slow, -5 walk-away, -15 dispute).

### 4. Real-Vendor Mode with Human in the Loop (`lib/agent/real-vendor.ts`, `app/negotiate/[contractId]/page.tsx`)

- **Proactive AI Outreach Drafting**: Drafts personalized renewal emails citing actual usage metrics (active vs purchased seats, usage decline) and proposing target discounts. Strictly displays for human approval—never sends automatically.
- **Structured Reply Extraction**: Parses pasted unstructured vendor emails into strict schemas (`counter_offer`, `accepted`, `seats`, `commitment_months`, `accepts_usdc`, `notes`).
- **Off-Chain Savings Recording**: If an enterprise vendor refuses USDC settlement, the system supports a "savings recorded without payment" outcome that reflects immediately in realized savings and analytics.
- **Audit Attachment**: Every drafted outreach and raw vendor reply is attached to immutable `agent_actions` records.

### 5. Pure Deterministic Policy Engine (`lib/policy.ts`, `/decision/[contractId]`)

- **Zero-LLM Boundary**: Pure TypeScript function evaluating transaction ceilings, minimum required savings, category budgets, and treasury balance. The LLM cannot approve transactions.
- **Server-Side Enforcement**: `create_escrow` and `release_escrow` re-execute policy verification server-side immediately before moving funds, refusing any unapproved transaction.
- **Human Escalation Workflow**: Transactions exceeding autonomous limits create pending approval rows in `approvals` requiring supervisor authorization.

### 6. Arc Escrow Smart Contracts & Circle Wallets (`contracts/`, `lib/tools/escrow.ts`, `lib/circle.ts`)

- **Solidity Smart Contracts**: `ArcEscrow.sol` deployed on Arc testnet with agreement ceilings and category budget caps. Gas is paid in native Arc USDC.
- **Verifier Separation**: Smart contract strictly enforces that the milestone verifier cannot be the depositor or the agent.
- **Deterministic Idempotency**: SHA-256 idempotency key (`business_id + contract_id + negotiation_id + amount`) backed by a PostgreSQL unique constraint on `transactions(negotiation_id)` eliminating double-spending.

### 7. Append-Only Cryptographic Audit Ledger (`lib/tools/audit.ts`, `/audit`)

- **Cryptographic Hash Chaining**: Every agent action stores `prev_hash` and `hash` calculated via SHA-256 chaining back to genesis.
- **Database Engine Immutability**: PostgreSQL trigger `prevent_agent_actions_mutation()` throws an exception on any `UPDATE` or `DELETE` attempt.
- **Live Verification UI**: `/audit` dashboard verifies the entire cryptographic chain in real time, detecting broken links or altered payloads.

### 8. Multi-Tenant Row-Level Security (`supabase/migrations/0004_audit_chain_and_rls.sql`)

- **PostgreSQL RLS**: All 11 tables enforce strict multi-tenant isolation bound to authenticated user membership (`business_members`).
- **Zero-Trust Access**: Non-admin users cannot read or mutate foreign contracts, policies, treasury balances, or audit logs.

### 9. Traction Metrics Dashboard (`app/metrics/`)

- **Live Database Aggregations**: Dynamic calculation of total spend, negotiated and realized savings, discount rates, and USDC transaction volume without synthetic mocks.
- **Real vs All Scope Toggle**: Ability to isolate verified real organizations from seeded demonstration accounts.
- **RFC 4180 CSV Export**: One-click download of auditable metrics spreadsheets for accounting and executive review.

---

## One decision worth explaining

**The Absolute Separation Between Probabilistic LLM Intelligence and Deterministic Financial Execution.**

In Tavryn, the large language model is treated as an untrusted reasoning engine. It drafts outreach messages, evaluates vendor counter-arguments, and parses unstructured emails into typed JSON schemas. However, it is fundamentally barred from database mutation and transaction signing.

All financial decisions pass through pure deterministic TypeScript functions (`checkPolicy`), all payments require a cryptographically derived idempotency key, all escrow operations re-verify policy clearance server-side, and all database records are chained via SHA-256 hashes with database triggers physically blocking mutation. The agent can suggest; only deterministic code and human supervisors can execute.

---

## The honest part

1. **Real-Vendor Email Transport**: In this release, real-mode vendor communications require copy-pasting the vendor's reply into the interface rather than automated IMAP/SMTP background scraping. This is an intentional human-in-the-loop design to prevent an agent from inadvertently committing to unfavorable legal terms without operator review.
2. **Blockchain Network**: Escrow settlement operates on Arc Testnet. Gas accounting uses testnet USDC.
3. **Compliance Screening**: Counterparty address screening utilizes an internal heuristic blocklist rather than live paid feeds from Chainalysis or TRM Labs.

---

## Proof

- **Test Suite**: 96 automated tests across 12 suites (policy edge cases, heuristics, idempotency, double-payment locks, vendor memory, RLS isolation, real-vendor mode, and tools) passing with 0 failures (`npm test`).
- **Deterministic Policy Tests**: 13 pure unit tests passing via Vitest (`npm run test:unit`).
- **Static Analysis & Linting**: `npx eslint . --quiet` passing with 0 errors and 0 warnings.
- **Production Build**: `npx next build` compiling cleanly across all 18 routes in 2.3s.
- **Cryptographic Audit**: Live chain verification on `/audit` confirms 100% hash integrity from genesis.

---

## Next up

- Production pilot onboardings with enterprise finance teams.
- Automated bidirectional email integration with human approval gates.
- Arc Mainnet settlement deployment and ERP integration (QuickBooks / NetSuite).

---

`Stage 0003` · [back to INDEX.md](./INDEX.md)

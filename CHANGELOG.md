# Changelog

All notable changes to **Tavryn** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-28

### Added

#### Real-Vendor Mode with Human in the Loop

- **AI Outreach Drafting:** Automatically drafts personalized renewal outreach citing contract telemetry (seat count, active utilization, price) and target price without ever sending emails autonomously.
- **Structured Reply Extraction:** Strict Zod schema (`VendorReplyExtractionSchema`) extracting counter-offers, commitment terms, seat counts, and payment conditions from pasted counterparty messages.
- **Dual Settlement Modes:** Supports either automated USDC escrow on Arc testnet or "savings recorded without payment" for traditional vendors that do not accept cryptocurrency.
- **Auditable Reply Log:** Raw vendor replies and extracted terms permanently attached to append-only `agent_actions` records.

#### Traction Metrics & Telemetry Reporting

- **Live Database Aggregations:** Computes total annual spend, realized savings, average discount percentage, USDC transaction volume, and autonomous win rates directly from PostgreSQL without synthetic mocks.
- **Data Filtering:** Support for filtering metrics by verified real businesses (`is_real = true`) or all registered organizations.
- **Standardized Exports:** RFC 4180 CSV export endpoint and structured JSON telemetry compatible with Arc Canteen telemetry standards.

#### Self-Service Business Onboarding & Multi-Tenant RLS

- **Authentication & Security:** Supabase Auth integration supporting passwordless magic link email authentication and OAuth.
- **CSV Contract Ingestion:** Drag-and-drop CSV parser with RFC 4180 parsing, automated category classification, and seat utilization calculation.
- **Automated Treasury Provisioning:** Onboarding creates developer-controlled wallets on Arc testnet via Circle SDK with step-by-step USDC funding instructions.
- **PostgreSQL Row-Level Security:** Strict tenant isolation policies applied to all 11 database tables, preventing cross-organization data reads or writes.

#### Packaging & Autonomous Showcase

- **Modern Public Landing Page:** Clean dark-mode-first aesthetic showcasing core value propositions, live architecture diagrams, and feature overviews.
- **Autonomous Demo Flow:** Interactive 7-step procurement walkthrough demonstrating observe -> analyze -> negotiate -> decide -> escrow -> verify -> release.
- **Audit Verification Interface:** `/audit` route providing real-time cryptographic verification of the SHA-256 action block chain.

#### Zero-Trust Hardening & Cryptographic Ledger

- **Cryptographic Audit Hash Chain:** Every agent action stores `prev_hash` and `hash` using SHA-256 chained back to genesis.
- **PostgreSQL Immutability Triggers:** `prevent_agent_actions_mutation()` trigger physically rejects `UPDATE` and `DELETE` queries at the database engine level.
- **Double-Payment Defense:** Deterministic SHA-256 idempotency key combined with a partial unique index on `transactions(negotiation_id)` eliminating duplicate payouts.
- **Sanctions & Mutation Screening:** OFAC blocklist checks and automated vendor wallet change detection that freezes execution upon address mismatch.

#### Proactive Autonomous Procurement Agent

- **Daily Procurement Cron:** Protected `/api/cron/daily` endpoint evaluating contract renewal opportunities within configurable notice windows (30 days).
- **Idempotency Window:** 14-day duplicate negotiation window preventing spam or runaway multi-agent rounds.
- **In-App Notifications & Webhooks:** Real-time notification panel for negotiation outcomes, approvals, and webhook dispatch to external enterprise endpoints.

#### Autonomous Negotiation Engine & Arc Escrow

- **Decomposed Agent Tools:** 100% strongly typed tools in `lib/tools/` for contract inspection, usage analytics, vendor options, concessions, and escrow.
- **Autonomous Multi-Round Negotiation:** Agent counter-offers guided by vendor personality profiles (stubborn, moderate, flexible) and concession decay curves.
- **Pure Deterministic Policy Engine:** Deterministic TypeScript validation (`lib/policy.ts`) enforcing spending limits and mandatory human approval gates.
- **Dynamic Vendor Memory:** Tracks past counterparty concessions and discount benchmarks to anchor future renewal negotiations.
- **Smart Contract Escrow:** Solidity escrow contract (`contracts/ArcEscrow.sol`) deployed to Arc testnet with USDC gas payment and Circle developer-controlled wallet integration.

#### Relational Schema & Executive Dashboard

- **Relational PostgreSQL Architecture:** 11 core tables (`businesses`, `policies`, `vendors`, `contracts`, `negotiations`, `approvals`, `transactions`, `agent_actions`, `vendor_memory`, `notifications`, `onboarding_events`).
- **Real-Time Glass Dashboard:** Displays actual spend, active contracts, upcoming renewals, and real-time on-chain treasury balances.

#### Project Foundation

- **Scaffold & Architecture:** Next.js App Router, TypeScript, Tailwind CSS, Base UI, Lucide icons.
- **Genesis Specification:** Architecture rules, deterministic tool execution protocol, and threat matrix.

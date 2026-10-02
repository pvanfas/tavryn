# Tavryn Application Usage Guide

> **Official Guide:** Complete walkthrough of Tavryn for finance teams, procurement managers, and operations supervisors.

---

## Table of Contents

1. [Introduction to Tavryn](#1-introduction-to-tavryn)
2. [Interface & Navigation Overview](#2-interface--navigation-overview)
3. [Contract Management & Statement Ingestion](#3-contract-management--statement-ingestion)
4. [Configuring Organizational Policies](#4-configuring-organizational-policies)
5. [Autonomous Negotiation & Reviewer Agent](#5-autonomous-negotiation--reviewer-agent)
6. [Human-in-the-Loop Governance & Approvals](#6-human-in-the-loop-governance--approvals)
7. [Treasury Operations & Arc Escrow Settlement](#7-treasury-operations--arc-escrow-settlement)
8. [Cryptographic Audit Ledger & Savings Receipts](#8-cryptographic-audit-ledger--savings-receipts)
9. [Ask Tavryn Command Bar (Cmd+K)](#9-ask-tavryn-command-bar-cmdk)
10. [Frequently Asked Questions & Troubleshooting](#10-frequently-asked-questions--troubleshooting)

---

## 1. Introduction to Tavryn

**Tavryn** is an autonomous B2B procurement protocol. It monitors SaaS and vendor renewal timelines, analyzes seat utilization waste, autonomously negotiates favorable terms with vendor counterparties, and settles agreed renewals using smart contract escrow on the **Arc Layer-1 blockchain** with **Circle USDC**.

### Key Value Pillars

- **Zero Surprises:** Continuous 60-day renewal horizon monitoring prevents automatic auto-renewals at list price.
- **Strict Policy Guardrails:** The AI agent operates within deterministic financial ceilings set by your CFO. The agent cannot self-approve or exceed spending limits.
- **Dual-Agent Verification:** Every proposed agreement is evaluated by an adversarial Reviewer Agent to eliminate concessions and unneeded idle seats.
- **On-Chain Settlement:** Agreements are funded in ArcEscrow smart contracts. Payouts require independent verifier confirmation.

---

## 2. Interface & Navigation Overview

The application features a responsive sidebar navigation on desktop and an optimized bottom tab bar on mobile:

| Section                   | Route        | Primary Purpose                                                                                      |
| :------------------------ | :----------- | :--------------------------------------------------------------------------------------------------- |
| **Executive Dashboard**   | `/`          | High-level metrics: total annualized spend, realized savings, active renewals, and immediate alerts. |
| **Contracts**             | `/contracts` | Complete registry of vendor agreements, renewal calendar, license counts, and statement upload.      |
| **Approvals Queue**       | `/approvals` | Human-in-the-loop escalation inbox for agreements exceeding policy caps or flagged by the reviewer.  |
| **Treasury & Escrow**     | `/treasury`  | Real-time Arc L1 wallet balance (USDC), active on-chain escrow locks, and gas metrics.               |
| **Negotiation Simulator** | `/simulator` | Interactive sandbox to test negotiation strategies against simulated vendor personalities.           |
| **Audit Ledger**          | `/audit`     | Live cryptographic SHA-256 hash chain verification proving data integrity and tamper-resistance.     |
| **Settings**              | `/settings`  | Organization profile, policy ceiling thresholds, category budgets, and API keys.                     |

---

## 3. Contract Management & Statement Ingestion

### Adding and Viewing Contracts

1. Navigate to **Contracts** (`/contracts`).
2. Each contract card displays:
   - **Vendor Name & Category** (`software`, `cloud`, `services`).
   - **Current Annual/Monthly Value** and **Upcoming Renewal Date**.
   - **Seat Utilization Metrics** (provisioned seats vs. active 30-day logins).
   - **Lifecycle Status** (`active`, `negotiating`, `pending_approval`, `settled`).

### Importing Vendor Statements

- Upload your monthly credit card statements (CSV) or vendor renewal notices (PDF).
- Tavryn automatically extracts vendor names, recurrence intervals, price-per-seat changes, and flags surprise rate increases.

---

## 4. Configuring Organizational Policies

Tavryn's deterministic policy engine enforces company spending rules outside the LLM. Configure your rules in **Settings** (`/settings`):

1. **Maximum Autonomous Transaction Cap (`max_auto_transaction`):**
   - The dollar threshold (e.g. `$10,000 USDC`) under which the agent is authorized to negotiate and fund renewals without requiring manual human sign-off.
   - Any transaction exceeding this limit automatically escalates to `/approvals`.
2. **Category Budgets:**
   - Define dedicated monthly or annual caps for specific categories (`software`, `cloud`, `contractors`).
3. **Minimum Savings Target (`min_savings_pct`):**
   - The required percentage discount (e.g. `10%`) the agent must secure before agreeing to terms.
4. **Counterparty Wallet Pinning:**
   - Registered vendor EVM wallet addresses are pinned. If a vendor attempts to switch payment destinations, Tavryn freezes execution and alerts supervisors immediately.

---

## 5. Autonomous Negotiation & Reviewer Agent

### How the Autonomous Cycle Works

1. **Trigger:** Every day, the procurement cron (`/api/cron/daily`) inspects contracts entering the renewal window (within 60 days).
2. **Analysis:** Tavryn examines historical usage, seat waste, and cross-vendor pricing benchmarks.
3. **Multi-Turn Counteroffers:** The primary agent crafts counterproposals requesting volume discounts, multi-year lock-ins, or seat reductions.
4. **Adversarial Review:**
   - Before any counteroffer is accepted, Tavryn's **Reviewer Agent** (`lib/agent/reviewer.ts`) performs an independent audit.
   - It issues one of three verdicts:
     - `PASS`: The agreement offers strong value and adheres to all guidelines.
     - `CHALLENGE`: The discount is subpar or excess seats remain; escalates to a supervisor.
     - `REJECT`: Unfavorable terms or potential breach of policy; cancels the deal.

---

## 6. Human-in-the-Loop Governance & Approvals

When an agreement exceeds your autonomous limit or is challenged by the Reviewer Agent, it enters the **Approvals Queue** (`/approvals`).

### Approving in the Web App

1. Go to **Approvals** (`/approvals`).
2. Review the deal breakdown: baseline price, negotiated price, net savings, and the Reviewer Agent's assessment.
3. Click **Approve Deal** to authorize the agent to fund the escrow, or **Reject** to instruct the agent to renegotiate or cancel.

### Out-of-Band Email / Slack Approvals

- Designated supervisors receive an out-of-band notification with a secure HMAC-SHA256 link.
- Links are valid for 48 hours.
- Clicking the link opens a tamper-proof preview. Confirming via authenticated `POST` executes the transaction on Arc without requiring full desktop login.

---

## 7. Treasury Operations & Arc Escrow Settlement

Tavryn settles all agreements using Circle Smart Contract Account (SCA) wallets deployed on **Arc Testnet**:

### Understanding the Settlement Flow

1. **Creation & Funding:** The agent executes `ArcEscrow.createAgreement(...)` and deposits the negotiated USDC amount plus protocol fee.
2. **On-Chain Timelock:** Every escrow agreement specifies a deadline. If the vendor fails to deliver valid contract renewal terms, the depositor reclaims a 100% refund.
3. **Verification & Release:**
   - Once renewal confirmation documents are received and verified by the independent verifier service, the verifier executes `approveMilestone(...)`.
   - The smart contract releases `negotiatedPrice` directly to the vendor's wallet and transfers the protocol fee to `feeRecipient`.
   - The agent is cryptographically barred from approving its own milestones.

---

## 8. Cryptographic Audit Ledger & Savings Receipts

### Verifying Audit Integrity (`/audit`)

- Every agent invocation, policy decision, approval, and transaction writes an append-only row to `agent_actions`.
- Each entry stores a SHA-256 hash chaining back to the previous record.
- Visit `/audit` to run real-time cryptographic verification. A green shield confirms zero tampered records and uninterrupted chain integrity.

### Public Savings Receipts (`/r/[token]`)

- Celebrate procurement wins with your team or board using shareable savings receipts.
- Each receipt is accessible via an unguessable 128-bit cryptographic URL (`/r/:token`).
- Includes privacy toggles to mask sensitive vendor identifiers while preserving verified on-chain savings proof.

---

## 9. Ask Tavryn Command Bar (Cmd+K)

Press **Cmd+K** (or **Ctrl+K** on Windows/Linux) anywhere in the application to summon the **Ask Tavryn** command bar:

- **Natural Language Queries:**
  - _"Which software contracts renew in the next 30 days?"_
  - _"How much USDC did we save on Datadog?"_
  - _"Show all approvals pending CFO sign-off."_
- **Safety Boundary:**
  - The command bar operates strictly with **read-only tools**. It can never execute payments or alter policies directly through chat.

---

## 10. Frequently Asked Questions & Troubleshooting

### Q: Why did a renewal stop and request human approval?

**A:** Check `/approvals`. An agreement requires human sign-off if:

1. The total price exceeds `max_auto_transaction`.
2. The category budget would be breached.
3. The Reviewer Agent flagged unaddressed seat waste or an inadequate discount.
4. The vendor requested payout to a new, unregistered wallet address.

### Q: What blockchain does Tavryn use and why?

**A:** Tavryn settles on the **Arc Testnet** (Chain ID `5042002`). Arc uses Circle USDC as its native gas currency, ensuring zero token exchange friction and predictable, low transaction costs.

### Q: Where are my organization's private keys stored?

**A:** Private keys are never stored on Tavryn application servers. Wallets are managed using Circle Developer-Controlled Wallets, signed server-side via Circle's hardware-security-module (HSM) architecture.

---

_For technical architecture notes, refer to the [System Architecture Overview](../architecture/overview.md) and [Smart Contract Specification](../contracts/arc-escrow.md)._

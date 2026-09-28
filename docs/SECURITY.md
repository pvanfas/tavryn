# Security Architecture & Threat Model

**Project:** Tavryn (Autonomous B2B Procurement Agent on Arc + Circle USDC)  
**Status:** Hardened MVP  
**Last Updated:** September 2026

---

## 1. Threat Matrix: Threats, Mitigations, and Residual Risks

| Threat | Attack Vector | Mitigation in Tavryn | Residual Risk & Real-World Caveat |
| :--- | :--- | :--- | :--- |
| **Double Payment / Replay Attack** | Rapid retries, network timeouts, concurrent agent invocations, or cron re-runs executing duplicate payments for the same renewal. | 1. Deterministic SHA-256 idempotency key (`business_id + contract_id + negotiation_id + amount`).<br>2. Partial unique database index on `transactions(negotiation_id)` where `status != 'failed'`.<br>3. Atomic transaction lock catching Postgres `23505` uniqueness violation. | If an operator manually modifies the negotiation ID in the database before retry, a new transaction key would be derived. In production, transaction limits are bound to billing cycles. |
| **Cross-Tenant Data Leakage & Forgery** | An authenticated user from Business A attempts to read or mutate Business B's contracts, policies, treasury balances, or audit trail. | 1. Supabase PostgreSQL Row-Level Security (RLS) enabled on all 11 relational tables.<br>2. Tenant isolation via `get_user_business_ids()` helper bound to `business_members` and JWT claims.<br>3. `WITH CHECK` clauses preventing foreign insertion. | Supabase service-role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS for deterministic background tools. Key compromise leaks all tenants. Must be kept strictly server-side. |
| **Vendor Wallet Mutation / Interception** | Counterparty phishing, prompt injection, or malicious payload attempting to redirect escrow funds to an attacker's EVM wallet address. | 1. Tool-level wallet change detection comparing resolved address against registered `vendors.wallet_address` and historical transactions.<br>2. Any change immediately freezes auto-execution, logs to `agent_actions`, and escalates to human approval. | If a vendor genuinely changes banks/wallets, human supervisor intervention is required. Zero-day compromised vendor email or manual supervisor negligence could approve a bad address. |
| **Wrong Vendor Mismatch** | Agent attempts to fund an escrow for Contract X (e.g., Slack) using Vendor Y's account (e.g., Datadog). | Server-side assertion verifying `input.vendor` strictly matches contract vendor UUID and registered name before policy check or escrow creation. | Only defends against mismatched cross-vendor assignment; does not verify external vendor legal entity incorporation. |
| **LLM Self-Approval / Privilege Escalation** | LLM attempts to approve its own transaction, bypass spending ceilings, or alter policy parameters. | 1. LLM never writes to the database directly and cannot sign transactions.<br>2. Deterministic policy engine (`lib/policy.ts`) runs purely outside LLM context.<br>3. Server-side re-check inside tools: `create_escrow` calls `checkPolicy` internally and refuses if unauthorized. | Policy rules are as sound as the configured rules. If an administrator configures `max_auto_transaction: 1,000,000`, the agent will execute within that limit. |
| **Audit Log Tampering / Repudiation** | Insider threat or compromised credential attempts to delete or alter historical agent actions. | 1. Database trigger `prevent_agent_actions_mutation()` rejecting all `UPDATE` and `DELETE` queries with a PostgreSQL exception.<br>2. Cryptographic SHA-256 hash chaining: every row stores `prev_hash` and `hash` chaining back to genesis.<br>3. `/audit` verification UI and tool detect broken links or modified data. | Hashes are chained in PostgreSQL. If an attacker gains raw superuser access to drop the trigger and rewrite all hashes forward, the chain can be forged. True permanence requires anchoring root hashes to Arc L1/L2. |
| **Prompt Injection / Vendor LLM Manipulation** | Adversarial vendor messages during simulated or email negotiation attempting to force unapproved discounts or code execution. | 1. Vendor simulator responses are sanitized.<br>2. Negotiation strategy uses structured JSON schemas with constrained fields (`offer`, `commitment_months`).<br>3. Final agreement undergoes deterministic verification against contract terms. | In real-world email negotiation, multi-turn prompt injection could trick the LLM into making an unfavorable counteroffer. Hard floors in `policy.ts` prevent below-floor commitments. |
| **Unauthorized Cron Execution / DoS** | Unauthorized external bot triggers `/api/cron/daily` repeatedly, causing high LLM API costs or spam notifications. | 1. Protected with `CRON_SECRET` bearer header / `x-cron-secret`.<br>2. Sliding-window in-memory rate limiting (10 req/min).<br>3. Idempotency window (default 14 days) prevents duplicate negotiation rounds. | In a multi-instance serverless deployment, in-memory rate limits do not share state across regions. Redis/Upstash rate limiting is recommended for multi-region scale. |
| **Secret Exfiltration in Logs & Errors** | API keys, Circle entity secrets, private keys, or JWT tokens printed to stdout or returned in error payloads. | 1. Sanitized structured logger (`lib/logger.ts`) intercepting and redacting 64-char hex secrets, Circle API keys, and JWTs.<br>2. Standardized error wrapper (`lib/api-response.ts`) preventing raw stack traces in responses. | Does not protect against developer debugging statements directly using `console.log` bypassing `logger` in future pull requests. Requires CI lint rule. |

---

## 2. Honest Disclosures: What Is Real vs. What Is Stubbed / Simulated

As an autonomous agent system, Tavryn maintains absolute transparency on its boundaries:

### What Is Deterministic & Production-Enforced
1. **Database Immutability & Hash Chaining:**
   - Real PostgreSQL trigger `prevent_agent_actions_mutation` rejecting `UPDATE` and `DELETE`.
   - Real SHA-256 cryptographic chaining stored in Supabase Postgres.
   - Real verification engine `/audit` inspecting the chain live.
2. **Double-Payment Defense:**
   - Real database uniqueness index on `transactions(negotiation_id)`.
   - Atomic database rollback catching concurrent race conditions in `Promise.all`.
3. **Multi-Tenant Row-Level Security:**
   - Real PostgreSQL RLS policies isolating tenants, tested with genuine Supabase auth tokens.
4. **Deterministic Policy Engine:**
   - 100% deterministic TypeScript code (`lib/policy.ts`). The LLM cannot approve transactions.
5. **Contract vs Vendor Validation:**
   - Enforced server-side in `lib/tools/escrow.ts`.

### What Is Simulated or Stubbed
1. **Vendor Counterparty Simulator:**
   - Vendor personalities, concession curves, and agreement documents are simulated in `lib/vendor-simulator.ts` and `app/api/vendors/[id]/confirm/route.ts` to allow realistic end-to-end demonstrations without real counterparty email servers.
   - For real businesses (`is_real = true`), real contracts are loaded, but vendor responses remain simulated until email/webhook integrations are plugged in.
2. **Blockchain Escrow Settlement (Arc Testnet / Sandbox):**
   - Circle Developer-Controlled Wallets SDK is integrated for Arc Testnet.
   - When testnet credentials or wallet set IDs are unconfigured, `create_escrow` safely falls back to simulated Arc EVM transactions (`0xsimulated_arc_tx_hash_...`) so that demonstration flows succeed reliably.
3. **Counterparty OFAC / Compliance Screening:**
   - `screenAddress` in `lib/tools/escrow.ts` uses an offline heuristic table and mock blocklist (blocking known malicious addresses such as `0x9999999999999999999999999999999999999999`) rather than a live paid subscription to Chainalysis or Elliptic.
4. **In-Memory Rate Limiting:**
   - Rate limiting is managed in Node memory rather than distributed Redis, suitable for single-instance Next.js deployment.

---

## 3. Cryptographic Audit Chain Mechanics

Every agent action logs:
$$\text{Hash}_n = \text{SHA-256}(\text{Hash}_{n-1} + \text{action} + \text{business\_id} + \text{timestamp} + \text{canonical\_json}(\text{input}) + \text{canonical\_json}(\text{result}))$$

- **Genesis Block:** When no prior action exists, `prev_hash` is initialized to 64 zeroes (`0000000000000000000000000000000000000000000000000000000000000000`).
- **Chain Verification:** The `/audit` endpoint computes each row's expected hash from its predecessor and reports any broken link or modified timestamp.
- **Database Trigger:** Any attempt to execute `UPDATE agent_actions` or `DELETE FROM agent_actions` raises SQL state `integrity_constraint_violation` (`P0001: agent_actions is append-only`).

# Security Policy

Tavryn is an autonomous procurement system entrusted with organizational funds, policy enforcement, and counterparty settlement on Arc testnet using Circle USDC. We treat security as a first-class engineering invariant.

---

## Supported Versions

Only the latest release on the primary development branch receives active security updates:

| Version | Supported | Status |
| :--- | :--- | :--- |
| `0.1.x` (Main / MVP) | :white_check_mark: | Active |
| `< 0.1.0` | :x: | Deprecated |

---

## Reporting a Vulnerability

We encourage responsible security disclosure. If you discover a security vulnerability or potential exploit, please do **NOT** open a public GitHub issue.

### Disclosure Process

1. **Email us directly:** Send full vulnerability details to **`security@tavryn.network`**.
2. **Include in your report:**
   - Detailed description of the vulnerability and attack vector.
   - Proof-of-concept (PoC) script, HTTP payloads, or reproduction steps.
   - Affected files, tools, or API endpoints.
   - Any proposed mitigations or code patches.
3. **Response Timeline:**
   - **Initial acknowledgment:** Within 48 hours.
   - **Severity assessment and triage:** Within 5 business days.
   - **Remediation & advisory release:** Within 30 days of confirmed verification.

### Safe Harbor Policy

Any security research conducted in good faith under this policy will not face legal action. We ask that researchers allow reasonable time for remediation prior to public disclosure and avoid any actions that could disrupt live services or degrade data integrity.

---

## Architectural Security Invariants

Tavryn enforces zero-trust architecture across all autonomous workflows:

1. **Deterministic Policy Boundary:**  
   The LLM agent never approves its own actions and never writes directly to the database or blockchain. All policy checks (`lib/policy.ts`) are pure, deterministic TypeScript functions that execute outside model influence.
2. **Server-Side Enforcement & Escalation:**  
   Payment and escrow tools re-execute policy verification server-side immediately prior to execution. If a transaction exceeds the autonomous ceiling, it escalates to human approval.
3. **Double-Payment Defense:**  
   Deterministic SHA-256 idempotency keys (`business_id + contract_id + negotiation_id + amount`) combined with PostgreSQL unique constraints on `transactions(negotiation_id)` prevent race conditions and duplicate payouts.
4. **Append-Only Cryptographic Audit Ledger:**  
   Every agent action writes a row to `agent_actions` with chained SHA-256 hashes linking back to genesis. PostgreSQL engine-level triggers reject all `UPDATE` and `DELETE` operations.
5. **Vendor Wallet Mutation Detection:**  
   Any counterparty attempt to alter recipient wallet addresses from registered records freezes automated workflows and triggers an escalation alert for human supervisor review.
6. **Multi-Tenant Row-Level Security (RLS):**  
   PostgreSQL RLS policies isolate tenant contracts, policies, treasury balances, and audit records across all organizations.
7. **Sanitized Structured Logging:**  
   The structured logger (`lib/logger.ts`) redacts 64-character private keys, Circle API secrets, and JWT tokens to prevent secret exfiltration.

For an extensive threat matrix, attack vector breakdowns, and residual risk analysis, refer to [docs/SECURITY.md](docs/SECURITY.md).

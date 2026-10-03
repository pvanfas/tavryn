# Contributing to Tavryn

Thank you for your interest in contributing to **Tavryn** — the autonomous procurement agent that finds SaaS renewal savings, negotiates with counterparties, enforces deterministic organizational policy, escrows USDC on Arc, and cryptographically records outcomes.

We welcome contributions from developers, security researchers, and systems architects. To keep the platform secure, robust, and verifiable, please review these guidelines before submitting code.

---

## Core Architectural Invariants

All contributions must strictly adhere to the project's zero-trust architectural boundaries:

1. **The LLM Decides. Deterministic Code Acts.**  
   All actions must execute through explicit, strongly typed tools in `lib/tools/`. The LLM never writes to the database directly and never signs transactions.
2. **Deterministic Policy Boundary.**  
   The policy engine (`lib/policy.ts`) is pure TypeScript code with zero LLM involvement. The agent can never approve its own financial transactions or override spending ceilings.
3. **Server-Side Re-verification.**  
   Every payment, escrow, and release tool MUST execute `checkPolicy` internally server-side and refuse execution if unauthorized.
4. **Append-Only Cryptographic Audit Ledger.**  
   Every agent action writes a row to `agent_actions` (`action`, `reason`, `confidence`, `input`, `result`, `prev_hash`, `hash`). PostgreSQL engine-level triggers strictly forbid `UPDATE` and `DELETE` queries.
5. **Deterministic Payment Idempotency.**  
   Every financial transaction generates a deterministic SHA-256 idempotency key (`business_id + contract_id + negotiation_id + amount`) backed by a partial unique database index. Duplicate execution is strictly blocked.
6. **Arc Testnet & Circle Wallets.**  
   Money is testnet USDC on Arc. Gas on Arc is paid in USDC. Always handle gas accounting accordingly.
7. **Multi-Tenant Row-Level Security (RLS).**  
   All relational tables enforce strict PostgreSQL Row-Level Security. Tenant isolation must be tested with non-admin Supabase clients.

---

## Development Setup

### Prerequisites

- **Node.js**: `v20.x` or later (tested on Node 20 & Node 25)
- **Package Manager**: `npm`
- **Supabase**: Active Supabase project with PostgreSQL credentials
- **Circle Developer Console**: API key and Entity Secret for developer-controlled wallets (optional for simulated mode)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/tavryn/tavryn.git
cd tavryn
npm install
```

### 2. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Populate the required secrets:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous client key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-only).
- `ARC_RPC_URL`: Arc Testnet RPC URL (server-only).
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: Model provider key.
- `CRON_SECRET`: Secret token for proactive daily procurement routines.

### 3. Seed Database

Initialize default seed data (businesses, policies, vendors, and initial contracts):

```bash
npm run seed
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) in your browser.

---

## Quality & Testing Guidelines

All pull requests must pass the comprehensive test suite and static analysis checks:

```bash
# Run unit & integration tests
npm test

# Run deterministic policy engine unit tests
npm run test:unit

# Run linter and verify zero unused variables or syntax errors
npx eslint . --quiet

# Verify production Next.js compilation
npm run build
```

### Writing Tests

- Add unit tests for any new policy logic, mathematical heuristics, or idempotency calculations in `tests/`.
- Ensure tests verify both the happy path and adversarial/tampering edge cases.
- Do not introduce mock data into live operational paths; use deterministic seed scripts or verified test fixtures.

---

## Pull Request Protocol

1. **Create a Feature Branch:**  
   `git checkout -b feature/your-feature-name`
2. **Follow Clean Commit Conventions:**  
   Use descriptive, structured commit messages:
   ```
   [TAVRYN] Stage NNNN: <Title Case Name> — <concise summary of functionality>
   ```
3. **Run Checks Before Pushing:**  
   Ensure `npm test`, `npx eslint . --quiet`, and `npm run build` succeed with 0 errors.
4. **Document Decisions:**  
   Add non-obvious architecture or security decisions to `docs/DECISIONS.md`.
5. **Open a Pull Request:**  
   Provide a clear summary of what changed, reference relevant issues, and include test verification logs.

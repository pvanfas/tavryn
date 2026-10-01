# Stage 0002: Relational Schema & Executive Dashboard

_Sep 27, 2026 · From Postgres schema to real numbers on glass with zero mock data_

## What Tavryn can do now that it couldn't last time

Tavryn can now model real-world enterprise SaaS spend, mathematically spot renewal savings before an LLM ever touches a prompt, seed realistic test companies idempotently, and project live treasury numbers onto an executive glass dashboard. Instead of guessing with AI hallucinations, it deterministically surfaces unallocated seats and usage declines right alongside a live $42,850 USDC treasury balance.

## What actually got built

- **8-Table Relational Schema** in [0001_init.sql](../../supabase/migrations/0001_init.sql) covering `businesses`, `vendors`, `contracts`, `negotiations`, `policies`, `transactions`, `agent_actions`, and `approvals`
- **Immutable Agent Audit Log** with append-only database enforcement on `agent_actions` to maintain complete auditability
- **Server and Client Supabase Wrappers** in [lib/supabase.ts](../../lib/supabase.ts) with service-role security isolation
- **Deterministic Savings Engine** in [lib/heuristics.ts](../../lib/heuristics.ts) calculating exact unallocated seat waste and telemetry-based usage drop savings
- **Automated Test Suite** in [tests/heuristics.test.ts](../../tests/heuristics.test.ts) verifying mathematical edge cases and formulas
- **Idempotent Seed Runner** in [scripts/seed.ts](../../scripts/seed.ts) establishing `Demo Co`, spending policies, and 6 vendors (spanning simulated support and real providers like Slack, Datadog, AWS)
- **Live Executive Dashboard** in [app/page.tsx](../../app/page.tsx) rendering real-time metrics with zero client mocks, dynamic theme switching ([components/ThemeToggle.tsx](../../components/ThemeToggle.tsx)), and brand assets ([public/logo.png](../../public/logo.png))

## One decision worth explaining

Keeping opportunity detection strictly deterministic rather than prompt-engineered, paired with `idempotency_key` enforcement on every transaction and UUID primary keys. Autonomous agents shouldn't invent dollar targets out of thin air or risk executing duplicate contract payments during network hiccups. Math and database constraints guard the money; the LLM negotiates within those guardrails.

## The honest part

Row-Level Security (RLS) policies are deferred until multi-tenant auth lands, queries currently use the server-side service role, vendor wallet addresses are placeholder EVM hex strings pending Circle wallet integration, and the dashboard's "Run agent now" action buttons await the autonomous loop in milestone 2.

## Proof

Automated tests pass 100% via `npm test`, seed script runs idempotently with zero duplicates across consecutive runs (`npm run seed`), and the dashboard renders cleanly at `http://localhost:3000/dashboard` showing verified DB figures ($42,850 USDC treasury balance, $5,900/mo active spend, $12,776 discovered savings).

## Next up

Stage 0003 begins wiring the autonomous LLM agent loop (Observe -> Analyze -> Negotiate) with Arc USDC escrow and Circle developer-controlled wallets.

---

`Stage 0002` · [back to INDEX.md](./INDEX.md)

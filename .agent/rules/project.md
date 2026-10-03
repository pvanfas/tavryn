---
trigger: always_on
---

# Business Money Agent (Tameion Agents Hackathon, Arc + Circle)

## Product

An agent that finds SaaS/cloud renewal savings, negotiates with vendors, gets policy approval,
escrows USDC on Arc, verifies vendor confirmation, releases payment, and records the outcome.
Core loop: Observe -> Analyze -> Negotiate -> Decide -> Execute -> Learn.

## Architecture rules

- Single Next.js app (App Router, TypeScript, Tailwind) + Supabase Postgres. No microservices.
- The LLM decides. Deterministic code acts. All actions go through explicit tools in /lib/tools.
- The LLM never writes to the database directly and never signs transactions directly.
- Policy engine (/lib/policy.ts) is pure deterministic code. The LLM cannot approve its own actions.
- Payment/escrow tools MUST call checkPolicy server-side themselves and refuse if not approved.
- Every agent action writes a row to agent_actions (action, reason, confidence, input, result).
  agent_actions is append-only: never update or delete rows.
- Vendors may be simulated (is_simulated = true) but real businesses use real data.
- Money is testnet USDC on Arc unless I explicitly say otherwise.
- Every payment has an idempotency key. Never pay twice for the same negotiation.

## Process rules

- Always write an implementation plan artifact first, then build.
- Build in small slices. After each slice, run the app/tests and verify before continuing.
- For Arc, Circle, and Supabase APIs: read the current docs (ARC CLI bundled context,
  docs.arc.network, developers.circle.com) instead of guessing from memory. If unsure, say so.
- Never commit secrets. Use .env.local and keep .env.example up to date.
- Keep dependencies minimal. Explain any new dependency in one line.
- Write unit tests for policy, negotiation math, and idempotency.
- Keep a docs/DECISIONS.md log: one line per non-obvious decision.

## Update Log Protocol

At the end of every task, before your final summary to me:

1. Create docs/updates/NNNN-short-slug.md (4-digit stage number, kebab-case slug) using the
   structure in docs/updates/TEMPLATE.md. Fill every section. Do not leave placeholders.
2. Update docs/updates/INDEX.md: add a row at the top (newest first) with the stage number,
   title, one-line summary, and date.
3. Draft the commit message using this convention, and show it to me in your final summary
   as a fenced code block ready to copy:

```
   [TAVRYN] Stage NNNN: <Title Case Name> — <one witty, concrete line on what now works>

   <2-4 sentence body: what was built, one interesting decision, one honest caveat>

   Log: docs/updates/NNNN-short-slug.md
```

4. Do NOT run `git add`, `git commit`, `git push`, or any other git command that changes
   history or the remote. Leave the working tree with changes unstaged or staged at most —
   never committed. I will review the diff and commit myself.
5. One log entry and one drafted commit message per stage. Do not split a stage across
   multiple drafted commits unless I ask.

Tone for the log entries: write like a founder who is genuinely enjoying the build. Confident,
a little playful, never goofy. No corporate changelog voice ("Implemented feature X"). No
overclaiming ("production-ready", "enterprise-grade") for a hackathon MVP. Always name at least
one real trade-off or risk, in plain words, not buried in jargon.

## Arc context

- Arc/Circle docs and sample repos are at ~/.arc-canteen/context/ (run `arc-canteen context sync` to refresh).
  Read docs/docs.arc.network/ and samples/arc-escrow/ before writing any Arc or escrow code.
- Gas on Arc is USDC. Never assume a separate gas token.
- ARC*RPC_URL contains a personal key: server-only, never NEXT_PUBLIC*, never logged or committed.

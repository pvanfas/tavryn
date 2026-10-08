# Stage 0020: Reconcile Drift — Contract Address, Missing Tables & Explorer Domain

_Oct 08, 2026 · Settling the score on our live Arc escrow bytecode, hunting down three missing Postgres tables from Oct 2, and banishing phantom explorer domains once and for all._

---

## What Tavryn can do now that it couldn't last time

1. **One True Escrow Contract Address (`0x78e61ae7e8EeF34Add911FA3e41F3408a819c047`)**:
   - Reconciled every single escrow address reference across the codebase and database.
   - Verified on-chain via Arc Testnet JSON-RPC (`https://rpc.testnet.arc.network`): `0x78e61ae7e8EeF34Add911FA3e41F3408a819c047` holds **10,252 bytes** (20,506 hex nibbles) of deployed EVM bytecode.
   - Rooted out the stale placeholder `0xA6d1C5C50F3349942ff65f6f59C407b461876D80` (which had 0 bytes on-chain) from the auto-generated specification and generator script.
   - Cleared the dummy mock address `0x1A2B3C4D5E6F708192A3B4C5D6E7F8091A2B3C4D` from demo seed data and Postgres `transactions` rows, aligning all seeded records with the live Arc escrow contract.

2. **Authoritative Block Explorer Domain (`testnet.arcscan.app`)**:
   - Confirmed against official Arc network documentation at `~/.arc-canteen/context/docs/docs.arc.network/` that `testnet.arcscan.app` is the definitive block explorer.
   - Eradicated phantom occurrences of `arcscan.io` in `docs/spec.json` and `scripts/generate-spec.ts`.

3. **Reconciled Governance & Audit Tables (`reviews`, `approval_tokens`, `override_memory`)**:
   - Identified the root cause of the missing Oct 2 governance tables: migrations `0009_reviewer_agent.sql`, `0010_approvals_and_overrides.sql`, `0011_approval_amount_and_single_use.sql`, and `0014_contract_active_escrow_lock.sql` had been written and tested in code, but were never executed against the remote Supabase database during an earlier clean slate reset.
   - Executed migrations, created all missing tables and indexes, and enforced Row-Level Security with member access and service role bypass policies.
   - Updated `database_specification` in `scripts/generate-spec.ts` and regenerated `docs/spec.json` to accurately reflect all 16 public tables.

4. **Live Verified Proofs for One-Tap Approvals & Reviewer Agent**:
   - Built and ran a comprehensive live verification suite (`scripts/verify-stage-0020.ts`) directly hitting live Supabase and Arc Testnet RPC.
   - **One-Tap HMAC Approval**: Generated signed token, verified single-use storage in `approval_tokens`, validated payload signature, consumed token to transition status to `approved`, and proved replay attempts are strictly rejected.
   - **Reviewer Agent Execution**: Executed `runReviewerAgent()` on active Demo Co contracts, verified structured concern analysis and suggested action output, and confirmed persistence into the `reviews` database table.
   - **Supervisor Override Memory**: Recorded rejection feedback into `override_memory` and proved dynamic prompt retrieval in `getOverrideGuidancePrompt()`.

---

## What actually happened to the Oct 2 tables

When auditing `supabase/migrations/` vs the live database schema:
- `reviews` (Migration 0009): Existed in migration history and was called by `lib/agent/reviewer.ts`, but failed silently on insert via non-fatal catch blocks. It was neither dropped nor consolidated—it simply hadn't been applied to the remote DB.
- `approval_tokens` (Migration 0010): Existed in migration history and code (`lib/approval-tokens.ts`), but out-of-band email/Slack approvals failed token resolution because the table was absent on the remote database.
- `override_memory` (Migration 0010): Existed in migration history and code (`lib/override-memory.ts`), but feedback persistence hit catch blocks.

All three tables are now live in Postgres with full schema fidelity and RLS policies.

---

## Trade-offs & honest caveats

- Reconciling the historical seed transactions in Postgres to the deployed contract address (`0x78e61ae7e8EeF34Add911FA3e41F3408a819c047`) means historical seed transactions now point to the real contract address on ArcScan, but their historical mock transaction hashes will not exist on the explorer (since they were created in simulated mode prior to live chain deployment). Live on-chain transactions created through `app/api/demo/reset-and-run` continue to produce genuine, verified ArcScan transaction links.

---

## Files changed

| File | What |
| --- | --- |
| `supabase/migrations/0009_reviewer_agent.sql` | Applied to remote Supabase Postgres; added RLS policies |
| `supabase/migrations/0010_approvals_and_overrides.sql` | Applied to remote Supabase Postgres; added RLS policies |
| `supabase/migrations/0011_approval_amount_and_single_use.sql` | Applied to remote Supabase Postgres (added `amount` and `used_at` to `approvals`) |
| `supabase/migrations/0014_contract_active_escrow_lock.sql` | Applied to remote Supabase Postgres (added `idx_transactions_active_contract`) |
| `scripts/seed.ts` | Replaced mock escrow address with `DEFAULT_ARC_ESCROW_CONTRACT` (`0x78e61ae7e8EeF34Add911FA3e41F3408a819c047`) |
| `scripts/generate-spec.ts` | Updated explorer URL to `testnet.arcscan.app`, escrow address to `0x78e61ae7e8EeF34Add911FA3e41F3408a819c047`, and added `reviews`, `approval_tokens`, and `override_memory` |
| `docs/spec.json` | Regenerated 55.5 KB machine-readable specification with 16 tables and verified endpoints |
| `scripts/verify-stage-0020.ts` | Live proof suite verifying on-chain bytecode, HMAC approvals, reviewer verdicts, and override memory |
| `docs/updates/0020-reconcile-drift.md` | Stage 0020 build log |
| `docs/updates/INDEX.md` | Added Stage 0020 row to build index |

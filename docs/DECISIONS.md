# Architecture Decision Records (ADRs)

> **Notice:** The canonical Architecture Decision Records document is maintained in [docs/architecture/decisions.md](architecture/decisions.md).

## Quick Decision Log (one line per non-obvious decision)

- **ADR-001**: Deterministic policy engine executes outside the LLM context; AI proposes, code enforces.
- **ADR-002**: Settle on Arc L1 with native USDC gas; eliminates separate gas token volatility and conversion.
- **ADR-003**: Cryptographically chain every agent action with SHA-256 and lock with PostgreSQL append-only triggers.
- **ADR-004**: Enforce separation of duties via dual-role smart contract (verifier != agent).
- **ADR-005**: Secure out-of-band human approvals with HMAC-SHA256 signatures and idempotency keys.
- **ADR-006**: Prevent duplicate concurrent escrows via database-level partial unique index on active contracts.
- **ADR-007**: Decompose monolithic tools and components into single-responsibility domain submodules.
- **ADR-008**: Maintain honest labeling (`is_simulated = true`, `tx_hash = null`) and explicit test teardown to protect immutable ledgers.
- **ADR-009**: Arrange isolated test fixtures with `wallet_address: null` so authorization tests are decoupled from live testnet wallet balances.
- **ADR-010**: Wire landing page hero cards directly to live `getTractionMetrics()` telemetry with visible honest-labeling badges (`Live Verified` vs `Demo Data`) and zero caching (`revalidate = 0`).
- **ADR-011**: Calibrate mobile decision checklist badges to 11px font size with compact pill padding and register `--text-2xs` in Tailwind `@theme` to prevent unstyled layout degradation on small viewports.
- **ADR-012**: Atomically mute and re-enable immutable ledger triggers during transactional database cleanup to purge dangling CI test organizations while strictly protecting production tamper resistance.
- **ADR-013**: Wire Vercel AI Gateway with Gemini (`google/gemini-2.5-flash` for extraction/negotiation, `google/gemini-2.5-pro` for reviewer audits) and propagate rate-limit/verification errors without silent fallback.
- **ADR-014**: Commit a keccak256 `decisionHash` on-chain in `ArcEscrow.usedDecisions` before funds move — canonical JSON encoding of 9 decision fields, replay-rejected even for the owner. Inspired by STEWARD's `AllowanceManager.usedDecision` pattern.
- **ADR-015**: Document Circle USYC institutional KYC/minimum balance constraints in `docs/usyc-status.md` and preserve analytical yield modeling without phantom testnet contract calls.
- **ADR-016**: Expose public traction counts at `/api/stats` using an in-memory sliding-window rate limiter, and render client-side via `LiveStatsBar.tsx` for real-time judge visibility.
- **ADR-017**: Maintain a centralized adversarial verification document (`docs/ADVERSARIAL.md`) cross-referencing live passing tests for prompt injection, double payments, forged tokens, wallet mutations, and decision replays.
- **ADR-018**: Redesign `LiveStatsBar` into a 4-pillar bento telemetry console with glassmorphic styling, tactile manual sync, visual auto/escalated progress bar, and layout-matched hydration skeleton.
- **ADR-019**: Replace full-page loading spinners with a top-of-viewport progress line, and provide an organization deletion route that cascades through 11 child tables while respecting the PostgreSQL append-only audit invariant.
- **ADR-020**: Decompose monolithic `lib/circle/balances.ts` into single-responsibility domain submodules (`arc-client.ts`, `balances.ts`, `gateway.ts`, `usyc.ts`) with a unified, deduplicated `eth_call` RPC executor and full backwards-compatible re-exports.
- **ADR-021**: Route public demo CTAs directly to authentication login (`/auth/login?demo=true`) with pre-filled credentials rather than silently auto-authenticating into the executive dashboard, preserving human auditability and auth boundary visibility. Transition from multi-tenant workspace switching to a 1:1 authenticated account-to-business model: replace "Add Business" with "Import Bills" (`/import-bills`), strip organization dropdown switchers across sidebar and user menus, and redirect legacy `/onboard` paths.
- **ADR-022**: Pin single verified ArcEscrow contract address to on-chain bytecode (0x78e61ae7e8EeF34Add911FA3e41F3408a819c047) and block explorer to testnet.arcscan.app, while applying migrations for reviews, approval_tokens, and override_memory with complete RLS coverage.
- **ADR-023**: Reconcile primary font to Manrope per Stage 0002 design brief; restructure navigation into Act/Trust/Prove groupings with 4-tab mobile ceiling; replace disparate table implementations with a unified `<DataTable>` supporting in-memory sorting, sticky chips, and real/simulated badge columns.
- **ADR-024**: Enforce centralized server-side tenant boundary guards (`requireBusinessAccess`, `requireContractAccess`) that strictly verify caller membership in `business_members` before delegating to service-role database operations, guaranteeing zero cross-tenant leakage even across direct API requests and background agent tasks.
- **ADR-025**: Omit unbounded JSONB columns (conversation, usage_metric) from high-volume list and metrics queries, batch sequential notification inserts and entity lookups with `Promise.all`, add hot-path database indexes via migration 0015, and establish explicit dark-theme solid backgrounds to avoid washed-out gradient bleed.
- **ADR-026**: Centralize server-side active organization resolution (`getActiveBusiness()`) bound strictly to authenticated user membership in `business_members` (or Demo Co in demo mode); remove URL-based `?businessId=...` parameter pollution across all routes and provide a guided 2-step first-time onboarding modal for company profile and bill ingestion.
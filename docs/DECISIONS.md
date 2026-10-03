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

# Stage 0009: Agentic Governance & Protocol Economics

_Sep 30, 2026 · Adversarial second-opinion agent, on-chain protocol fees, out-of-band HMAC approvals, and a switching matrix so ruthless vendors will sweat their renewal calls._

## What Tavryn can do now that it couldn't last time

Tavryn is no longer just an agent that haggles over SaaS prices and locks USDC into smart contracts—it now operates with checks and balances. Before any negotiated deal reaches a human supervisor or triggers an escrow deposit, an independent Reviewer Agent audits the terms. If the primary agent was too quick to roll over on seat count or accepted a token 5% discount after one round, the reviewer challenges the deal and flags specific concerns on the executive decision card.

Meanwhile, enterprise supervisors don't need to stay logged in to sign off on big spends: they get tamper-proof, one-tap approval links via HMAC-SHA256 that verify policy server-side at the instant of click. When a vendor refuses to budge, Tavryn runs a realistic switching-cost analysis across migration engineering, employee retraining, and downtime risk. And every time savings are locked and released on Arc testnet, the smart contract takes a protocol success fee on-chain.

## What actually got built

- **Adversarial Reviewer Agent (`lib/agent/reviewer.ts`)**: An independent agent acting as an in-house procurement auditor. It parses round history, seat utilization, and vendor benchmark discounts to issue a verdict (`AGREE`, `CHALLENGE`, or `REJECT`) with structured concern cards, escalating suspicious concessions to human supervisors.
- **Switching Cost Decision Matrix (`lib/switching.ts`)**: A full net NPV model comparing renewing against switching to top competitors (e.g., Slack to Teams, Datadog to Grafana Cloud). Incorporates category-specific engineering friction, retraining hours, and downtime risk, with an invariant strictly requiring human sign-off before vendor migration.
- **On-Chain Protocol Success Fee (`contracts/contracts/ArcEscrow.sol`)**: Hardened the escrow smart contract to split an on-chain protocol fee (capped at 2,000 bps / 20%) to a fee recipient address upon milestone release. On agreement cancellation or dispute refund, 100% of escrowed principal is refunded to the depositor without penalty.
- **One-Tap HMAC Approvals (`lib/approval-tokens.ts`, `/approve/[token]`)**: Secure out-of-band links for Slack/email approvals using cryptographic HMAC-SHA256 tokens expiring in 48 hours. Enforces single-use consumption and deterministically re-runs `checkPolicy` server-side at the moment of click so revoked policies or depleted budgets cannot be bypassed.
- **Supervisor Override Memory (`lib/override-memory.ts`)**: When a supervisor rejects an agent's proposal, they can submit structured reason codes (`too_few_seats_cut`, `vendor_discount_insufficient`, `prefer_alternative_vendor`). These feedback signals are stored and automatically injected into future negotiation prompts for that vendor.
- **Live Arc USDC Balance Polling (`lib/circle.ts`, `components/AppHeader.tsx`)**: Directly queries the ERC-20 `balanceOf` precompile on Arc testnet RPC. If the treasury wallet dips below 100 USDC, a warning banner appears in the top navigation with a direct link to Circle's official testnet faucet.
- **Weekly Executive Digest Cron (`app/api/cron/weekly/route.ts`, `/digest/preview`)**: Automated ISO-week idempotent (`YYYY-Www`) cron endpoint aggregating 7-day realized savings, protocol fees collected, contracts audited, and reviewer challenge rates, paired with a web preview dashboard.
- **Approvals Auth Barrier (`app/api/decision/[contractId]/route.ts`)**: Authenticated session and authorization header guards protecting manual decision status updates against unauthorized external tampering.

## One decision worth explaining

We chose to make the Reviewer Agent dual-layered: pure deterministic heuristics run first, followed by an optional LLM qualitative pass if configured. Why? Because prompt-only reviewers are easily charmed by the primary agent's rationalizations. If a negotiation resulted in a 4% discount on round 1 with 35% idle seats, no amount of LLM prose should convince the system that this is a great deal. Deterministic rules catch blatant laziness instantly (setting a floor on challenge flags), while LLM evaluation adds context-aware nuance when evaluating complex multi-tier proposals.

## The honest part

Our switching cost matrix models real-world friction like engineer salaries and onboarding downtime, but it still relies on industry-standard baseline estimates rather than querying your company's actual GitHub velocity or Jira sprint logs. If your engineering team is unusually fast or slow at migrating message brokers, our 1-year payback calculation will be directional rather than precise to the dollar. It's a strategic hammer for the negotiation table, not an enterprise ERP migration planner.

## Proof

- **Full Test Suite**: 121 node tests passing, 27 vitest policy and recurrence tests passing, and 11/11 hardhat contract tests passing.
- **Smart Contract Verification**: Verified `ArcEscrow.sol` fee split math and 100% depositor refund guarantees in Hardhat test suite (`npm run test:contracts`).
- **Reviewer Agent & Switching Coverage**: Dedicated unit tests in `tests/reviewer.test.ts` (6 tests) and `tests/switching.test.ts` (4 tests) verifying discount threshold challenges, seat utilization rejections, and NPV calculations.
- **Token Security & Overrides**: Verified in `tests/approvals-and-overrides.test.ts` for token expiration, replay defense, and override prompt injection.
- **Zero Lint Errors & Zero Unused Exports**: `npm run lint:fix` exited cleanly with 0 errors; `npm run knip` reported no unused exports or dead dependencies.

## Next up

Package the final demo recording, polish the presentation deck, and walk judges through the live end-to-end loop: discovery, autonomous negotiation, reviewer audit, out-of-band supervisor approval, on-chain escrow funding on Arc, and receipt minting.

---

`Stage 0009` · [back to INDEX.md](./INDEX.md)

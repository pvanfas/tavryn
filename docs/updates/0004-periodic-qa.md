# Stage 0004: Periodic QA & Independent Verification

_Sep 30, 2026 · 104 tests passing across Node, Vitest, Hardhat, and Playwright, zero secrets in the client bundle, and verified Arc testnet escrow on glass._

## What Tavryn can do now that it couldn't last time

Tavryn now withstands a zero-context, independent evaluator inspection from fresh clone to smart contract settlement. A newcomer can clone the repository, run `npm install`, configure credentials from an exhaustive `.env.example`, execute all four test suites (Node test runner, Vitest, Hardhat, and dual-viewport Playwright) without a single red test, and click through every route with functional sidebar navigation, zero leaked client keys, and clear contract addresses.

## What actually got built

- **README & Setup Audit**: Fixed the failing `test:contracts` script in `contracts/package.json` by replacing an unconfigured placeholder with `hardhat test`, ensured Hardhat dependencies install cleanly, and updated `.env.example` with the optional server-only `ARC_RPC_URL` override.
- **Client Key Isolation & Security**: Audited git history and production client bundles in `.next/static`. Discovered and corrected a personal RPC node key leak risk by splitting private RPC node access into server-only `process.env.ARC_RPC_URL` while preserving `NEXT_PUBLIC_ARC_RPC_URL` as the public Arc testnet endpoint.
- **UI Route Polish & Anchor Navigation**: Linked sidebar navigation items directly to real section anchors on `/dashboard` (`#treasury`, `#negotiations`, `#contracts`) and routed Policy Engine to `/settings#policy`, eliminating dead clicks for users inspecting policies or contracts.
- **GoTrueClient Singleton Pattern**: Refactored `getBrowserSupabase` in `lib/auth.ts` to cache client instances, eliminating multi-instance warnings in the browser console.
- **Contract & Explorer Integrity**: Confirmed exact alignment for ArcEscrow (`0x78e61ae7e8EeF34Add911FA3e41F3408a819c047`), USDC precompile (`0x3600000000000000000000000000000000000000`), and live ArcScan links across all UI screens and verification tools.

## One decision worth explaining

We separated server-side JSON-RPC execution from client-side network metadata in `lib/circle.ts`. Arc node RPC URLs obtained through personal dev tunnels or Canteen swarms contain private keys that should never be broadcast to the browser bundle via `NEXT_PUBLIC_` prefixes. By allowing server tools to prefer `ARC_RPC_URL` while client components read `NEXT_PUBLIC_ARC_RPC_URL` pointing to the public testnet, we get high-throughput rate-limit-free RPC queries on the backend without leaking sensitive credentials to the browser.

## The honest part

Automated testing against live public blockchains is inherently susceptible to testnet node latency and faucet rate limits. While our unit tests and Hardhat local EVM contract tests complete in under a second, tests hitting live Arc Testnet JSON-RPC depend on external network health. We maintain a database-level snapshot fallback for treasury balances so users never see broken glass even if the public RPC stutters.

## Proof

- **Node Unit & Integration Runner**: 91/91 passing (covering RLS multi-tenancy, proactive cron, double-payment locks, vendor simulator, and business memory).
- **Vitest Policy Engine Suite**: 13/13 passing (covering deterministic ceilings, category budgets, and zero-LLM boundaries).
- **Hardhat Smart Contracts**: 7/7 passing (spending caps, category budgets, non-reentrant double release protection, verifier role checks).
- **Playwright Dual-Viewport E2E**: 8/8 passing across Chromium desktop and Pixel 7 mobile viewports.
- **Production Build**: `next build` compiled all 18 routes in under 2 seconds with zero lint or type errors.

## Next up

Stage 0005: Dead link audit and centralized navigation rebuild across sidebar, mobile drawer, and header.

---

`Stage 0004` · [back to INDEX.md](./INDEX.md)

# Stage 0008: Shareable Savings Receipts

_Sep 30, 2026 · Send a public cryptographic proof of realized savings that an auditor, board member, or judge can verify without creating an account._

## What Tavryn can do now that it couldn't last time

Every completed procurement negotiation on Tavryn can now generate a public, read-only proof page at `/r/[token]`. CFOs, founders can open this link in any browser without logging in to inspect the exact financial outcome: old vs. new contract pricing, annualized dollar savings, negotiation round count, agent reasoning, deterministic policy pass checklist, fulfillment confirmation verification, and direct links to the on-chain Arc testnet escrow release transaction.

## What actually got built

- **Receipt Storage & RLS Schema (`supabase/migrations/0007_receipts.sql`)**: Dedicated `receipts` table with cryptographically random 128-bit unguessable tokens, owner visibility toggles (`show_business_name`, `show_vendor_name`), soft revocation via `revoked_at`, and row-level security allowing authenticated tenant owners to manage receipts and anonymous public reads for unrevoked tokens.
- **Dedicated Allow-Listed View Model (`lib/receipt.ts`)**: Built from a strict whitelist (`PublicReceiptViewModel`) ensuring absolute zero leakage of internal UUIDs, user IDs, wallet addresses, API keys, approver names, or raw message transcripts.
- **Public Proof Route & Dynamic OG Image (`app/r/[token]/page.tsx` & `opengraph-image.tsx`)**: High-contrast, brand-aligned visual receipt featuring price comparisons, policy compliance badges, verification breakdown, live ArcScan links, and automated Open Graph social share image generation (`"Saved $X on <Service>"`).
- **Decision Detail Controls (`app/decision/[contractId]/page.tsx`)**: Explicit "Create Public Receipt" action available only after escrow payment is released on Arc, alongside an interactive receipts table with "Copy link", company/vendor name privacy toggles, and instant revocation.
- **Command Bar Integration (`lib/agent/command.ts`)**: Wired the `create_receipt` action to look up completed transactions and return instant verified receipt links directly through the Cmd+K command bar.
- **Traction Metrics & Landing Page Integration (`lib/metrics.ts`, `app/metrics/`, `app/page.tsx`)**: Added live "Public Savings Receipts Generated" tracking to governance analytics and linked active verified receipts from the landing page hero and README.

## One decision worth explaining

We chose to enforce a strict **allow-listed view model** instead of serializing database rows or returning sanitized partial records. When building public-facing proof pages for financial systems, sanitizing by removing blacklisted fields (`delete row.wallet_address`) is notorious for accidental data leaks when new database columns are introduced in future migrations.

By constructing `PublicReceiptViewModel` explicitly from a pure whitelist and verifying it in unit tests, we guarantee that no internal tenant metadata, approver identities, or private keys can ever escape over the wire. Furthermore, both non-existent and revoked tokens return an identical generic 404 response to completely prevent token enumeration.

## The honest part

Currently, social previews generated via `app/r/[token]/opengraph-image.tsx` render dynamically via Edge image response in Next.js. While this looks stunning when links are shared on Slack, Discord, or Twitter, local headless crawlers that do not support dynamic canvas rendering will fall back to default metadata tags.

## Proof

- **Unit Test Suite (`tests/receipts.test.ts`)**: 6/6 tests passing verifying 128-bit entropy generation, restriction to completed transactions, zero-leak allow-list validation, privacy toggles, and instant revocation to 404.
- **Full Test Suite (`npm test`)**: 105 Node tests + 27 Vitest unit tests (132 tests total) passing with 100% success.
- **Type Checking (`npx tsc --noEmit`)**: Exited with code 0 across the entire application.
- **Real Arc Deal Verification**: Created real receipt `/r/12dd9d181715dd61ccf700593ef2f2ce` for Slack ($2,688 realized annual savings, 28% reduction) with verified ArcScan release tx `0xe06277de...`.

## Next up

On-chain success fees enforced directly in the Arc escrow smart contract (`Stage 0009: On-chain success fee`).

---

`Stage 0008` · [back to INDEX.md](./INDEX.md)

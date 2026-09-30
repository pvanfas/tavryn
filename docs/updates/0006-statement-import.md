# Stage 0006: Statement and Invoice Import

_Sep 30, 2026 · Drop a bank statement or vendor PDF and onboard in under ninety seconds without typing a single row or exposing a card digit._

## What Tavryn can do now that it couldn't last time

A business no longer has to manually punch SaaS subscriptions, renewal dates, and annual spend into an onboarding form. Instead, finance teams can drag and drop raw bank or corporate card statement CSVs or vendor invoice PDFs/images directly into `/onboard`.

Statement charges are parsed, scrubbed of card numbers, and deterministically grouped by cadence (monthly vs. annual) with annualized amounts and projected next renewal dates computed through pure TypeScript math. Invoices are parsed into strict Zod schemas with per-field confidence scoring and prompt-injection defenses. Everything funnels into an interactive, editable preview table with confidence badges and include/exclude controls before committing through our unified Stage 0003 onboarding pipeline.

## What actually got built

- **Sensitive Financial Data Redactor (`lib/statement-detection.ts`)**: In-memory regex scrubbing of 13-19 digit card numbers, masked card tokens (`*4920`, `XXXX-...`), and bank routing/account numbers before any data hits logs, memory, or the LLM.
- **Deterministic Recurrence Engine (`lib/statement-detection.ts`)**: Groups transactions by normalized merchant key, evaluates day intervals (~25-35 days for monthly, ~350-385 days for annual) and amount variance within 8% tolerance, annualizes prices (12x or 1x), and computes the next renewal date deterministically.
- **Invoice Extraction with Prompt Immunity (`lib/invoice-extraction.ts`)**: Structured extraction schema with per-field confidence ratings (vendor, service, category, amount, renewal date, seat count). Explicit defensive boundary isolating untrusted invoice text so embedded prompt injections cannot alter agent tools or policies.
- **Single-Memory Import Route (`app/api/import/file/route.ts`)**: Enforces 10MB file limit, validates MIME types (CSV, PDF, PNG, JPG), runs extraction purely in RAM, and guarantees zero storage of raw files on disk or in the database.
- **Interactive Review Table (`app/onboard/page.tsx`)**: Unified ingestion UX supporting Statement/Invoice drops, pre-formatted CSVs, and manual entry. Review table features confidence badges, source tags, include/exclude toggles, and editable cells.
- **Approvals Header Component (`components/ApprovalsHeader.tsx`)**: Reusable executive governance hero component on `/approvals` with live pending authorization beacon, pending volume tracking in USDC, policy ceiling metric, and direct links to policy configuration.
- **Unit & E2E Test Suite (`tests/recurring-detection.spec.ts`)**: 14 Vitest unit tests verifying monthly/annual cadence detection, refund exclusion, irregular charge filtering, and sanitization alongside Playwright browser validation.

## One decision worth explaining

We chose to calculate subscription cadence and pricing **100% deterministically in TypeScript**, completely barring the LLM from calculating dates or dollar amounts. Bank statements follow consistent arithmetic: an expense recurring every 28 to 33 days with amount variance under 8% is monthly; multiplying the latest charge by twelve yields the annual commitment.

The LLM is only leveraged when parsing unstructured invoices or suggesting semantic categories (`software | cloud | contractors`). Allowing AI models to do financial math invites subtle rounding bugs and hallucinations. Math belongs in deterministic code; language understanding belongs in the LLM.

## The honest part

Bank statement descriptions from niche or regional vendors can occasionally lack obvious branding tokens (e.g. `TST* DRIFTWOOD CA`). While our noise-stripping rules handle payment gateways like Square, Stripe, and PayPal, uncommon long-tail vendors may receive a generic merchant key.

To mitigate this, every detected subscription is pre-populated in an editable review table where users can adjust names, categories, or renewal dates prior to committing to the database.

## Proof

- **Unit Tests**: 27/27 unit tests passing via Vitest (`tests/recurring-detection.spec.ts` + `tests/policy-engine.spec.ts`), verifying cadence math, refund exclusions, and card redaction.
- **E2E Tests**: 16/16 Playwright tests passing cleanly across desktop and mobile viewports.
- **Automated Verification Script (`scripts/verify-import.ts`)**: Successfully processed `public/samples/statement.csv` (detected 6 vendors with 0 leaked card digits) and `public/samples/invoice.pdf`, provisioning a real Arc treasury wallet and inserting 6 active contracts via `POST /api/onboard`.
- **Zero Raw File Storage**: Confirmed memory-only parsing with no uploads written to disk or Postgres storage.

## Next up

Autonomous multi-vendor renewal sweeps and scheduled proactive negotiation runs on live contracts.

---

`Stage 0006` · [back to INDEX.md](./INDEX.md)

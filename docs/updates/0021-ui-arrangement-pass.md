# Stage 0021: UI Arrangement & Shared Table Pass

_Oct 08, 2026 · Bringing structural elegance to the glass: Manrope typography locked in, hero savings up front, shared data tables across three core ledgers, a sleek tabbed decision flow, and a crisp Act/Trust/Prove navigation rhythm._

---

## What Tavryn can do now that it couldn't last time

1. **Brand Typography Reconciled (Manrope Live Throughout)**:
   - Diagnosed and resolved font drift where `Geist` had been accidentally assigned to `variable: "--font-sans"` in `app/layout.tsx`, unintentionally overriding the Tailwind `@theme` definition.
   - Restored **Manrope** as the sole sans-serif variable font across the entire interface per the original Stage 0002 design decision and `docs/design/typography.md`, preserving `Geist_Mono` for dense numeric and currency figures.

2. **Dashboard Reordered for Maximum Signal**:
   - Reordered `app/dashboard/page.tsx`:
     - **Hero Savings Number First**: Large display font (`text-4xl sm:text-5xl lg:text-6xl font-extrabold font-mono text-[#107e65]`) displaying net realized savings, paired with an inline real/demo badge (`Demo Co (Simulated)` or `Live Verified`).
     - **Activity Timeline Second**: Preserved direct visibility into autonomous agent loop execution (`Observe -> Analyze -> Negotiate -> Decide -> Execute -> Learn`).
     - **Opportunities Ledger Third**: Contextual prioritization of upcoming renewal cliffs and waste reduction.
     - **Collapsed Treasury Chip**: Removed the redundant full-width treasury panel from the primary dashboard flow, condensing it into a persistent header chip with a live Arc pulse indicator and one-click ArcScan link.

3. **Shared `<DataTable>` Component (`components/ui/data-table.tsx`)**:
   - Engineered a unified, enterprise-grade `<DataTable>` component featuring:
     - Leading execution mode badge column (`Real` vs `Simulated` with live pulsing indicators).
     - Interactive column header sorting (`asc` / `desc` with indicator chevrons).
     - Sticky filter chips with record counts.
     - Client-side search and predicate filtering.
     - Responsive dual-layout: rich tabular grid on desktop, custom card flow on mobile (`sm:hidden`).
   - Migrated three key ledgers to use the shared table, each configured with sensible default sorts:
     - **Contracts Ledger (`app/contracts/page.tsx`)**: Default sort by **Potential Savings descending**.
     - **Negotiations Ledger (`app/negotiations/page.tsx`)**: Default sort by **Realized Savings descending**.
     - **Recent Settlements Ledger (`app/metrics/components/RecentSettlementsTable.tsx`)**: Default sort by **Most Recent Timestamp descending**.

4. **Tabbed Decision Review Architecture (`app/decision/[contractId]/page.tsx`)**:
   - Converted the six stacked vertical sections into a clean horizontal tab bar in exact lifecycle order:
     1. `Timeline` (Autonomous Reasoning Tree & Runway Horizon)
     2. `Policy Checklist` (Deterministic Policy Rule Validations)
     3. `Reviewer Audit` (Dual-Agent Adversarial Second Opinion)
     4. `Vendor Verification` (Cryptographic Confirmation & Escrow Release)
     5. `Switching Alternatives` (NPV Switch vs Renegotiate Matrix)
     6. `Receipts` (Cryptographic Public Proofs)
   - **Pinned Header Action**: Pinned a persistent **"Copy Public Receipt Link"** action button in the top action row regardless of active tab. If a public receipt already exists, it copies the token URL instantly; if not, it generates the cryptographic receipt on demand.
   - Added `app/decision/page.tsx` server redirect to ensure navigating to `/decision` from the sidebar seamlessly resolves to the first contract decision.

5. **Visual Separation of Real vs Platform Metrics (`app/metrics/page.tsx`)**:
   - Rebuilt `app/metrics/TractionMetricsClient.tsx` to visually distinguish live production data from platform-wide test totals:
     - **Live Verified Real Metrics (`realOnly: true`)**: Highlighted in a prominent top block accented with emerald borders, a live reconciliation timestamp (`Reconciled HH:MM:SS AM · Arc Testnet`), pulsing green status, and production-only totals.
     - **Platform Totals (Including Simulated & Demo Co)**: Contained in a clearly labeled, muted slate card showing aggregate system numbers across benchmark tests and sandbox runs.

6. **Collapsed Sidebar & 4-Item Mobile Tab Bar**:
   - Structured `lib/nav.ts` and `components/AppSidebar.tsx` into three distinct action groups:
     - **Act**: Dashboard (`/dashboard`), Contracts (`/contracts`), Negotiations (`/negotiations`)
     - **Trust**: Approvals (`/approvals`), Audit Trail (`/audit`), Decision (`/decision`)
     - **Prove**: Metrics (`/metrics`)
   - Moved `Import Bills` and `Settings` into the bottom secondary section.
   - Enforced the mobile bottom navigation bar (`components/MobileTabBar.tsx`) to render strictly **4 primary tabs** (`Dashboard`, `Contracts`, `Approvals`, `Metrics`) plus the 5th **More** button, which houses the remaining pages in an accessible slide-over sheet.

---

## Interesting Decisions

- **Client-Side Sifting on Shared Tables**: Rather than forcing server-side page reloads on every tab or filter chip click, `<DataTable>` holds the full loaded contract and negotiation sets in memory and performs sorting and filtering client-side. Response times drop to 0ms for instant tab-switching while preserving data integrity.
- **On-Demand Public Receipt Generation in Header**: Rather than requiring the operator to click through to the Receipts tab, wait for generation, and then copy the URL, the pinned "Copy Public Receipt Link" button detects whether a token exists. If none does, it calls the receipt generation API silently in the background, updates state, and copies the signed link straight to the operator's clipboard in a single click.

---

## Trade-offs & honest caveats

- The decision page tabs unmount inactive sections rather than hiding them via CSS `display: none`. This keeps the DOM lightweight and ensures charts and cryptographic hash badges don't cause unnecessary repaints, but switching back to a tab with complex interactive forms (like the vendor confirmation tamper-simulator) resets local transient form states.
- By configuring the mobile tab bar with 4 primary items plus the More drawer, accessing Negotiations and Audit on mobile requires two taps instead of one. However, the four most critical real-time workflows (overview metrics, contract cliffs, pending approvals, and settlement volume) remain available in a single thumb tap.

---

## Files changed

| File | What |
| --- | --- |
| `app/layout.tsx` | Replaced `Geist` sans assignment with `Manrope` as the official font |
| `app/dashboard/page.tsx` | Reordered layout: hero savings first, timeline second, table third; collapsed treasury chip |
| `components/ui/data-table.tsx` | Created reusable `<DataTable>` with mode badges, configurable sorting, search, and filter chips |
| `components/contracts/ContractsDataTable.tsx` | Created contracts adapter using `<DataTable>` with potential savings desc default sort |
| `app/contracts/page.tsx` | Migrated to `<ContractsDataTable>` |
| `components/negotiations/NegotiationsDataTable.tsx` | Created negotiations adapter using `<DataTable>` with savings desc default sort |
| `app/negotiations/page.tsx` | Migrated to `<NegotiationsDataTable>` |
| `app/metrics/components/RecentSettlementsTable.tsx` | Migrated settlements ledger to `<DataTable>` with timestamp desc default sort |
| `app/decision/[contractId]/page.tsx` | Converted six sections to tabs; pinned "Copy Public Receipt Link" button in header |
| `app/decision/page.tsx` | Created server redirect to active contract decision |
| `app/metrics/TractionMetricsClient.tsx` | Visually separated Live Verified Real Metrics from Platform Totals |
| `lib/nav.ts` | Reorganized sections into Act, Trust, Prove; set mobile primary tab IDs to 4 items |
| `components/AppSidebar.tsx` | Added Scale icon support for Decision navigation |
| `components/MobileTabBar.tsx` | Added Scale icon support; validated 4 primary items + More sheet |
| `scripts/verify-ui-stage0021.ts` | Automated Playwright verification script with session auth |

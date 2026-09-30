# Stage 0006: Sidebar and Navigation Rebuild

_Sep 30, 2026 · A single typed configuration in lib/nav.ts now powers the entire workspace, collapsible desktop sidebar, and mobile bottom tab bar with zero dead hash links._

## What Tavryn can do now that it couldn't last time

You can effortlessly navigate across Tavryn's entire operational loop through a clean, hierarchical workspace structure: Overview, live agent Activity, policy Approvals with real-time pending badges, Negotiations, Contracts ledger, Audit trail, Metrics, and Settings. On mobile viewports below `md`, users get an iOS-grade fixed bottom tab bar with a dedicated "More" drawer, while desktop operators enjoy a collapsible icon sidebar with an integrated organization switcher and live ArcScan treasury balance chip.

## What actually got built

- **Single Source of Truth (`src/lib/nav.ts` & `lib/nav.ts`)**: Built a unified, strongly typed navigation config defining `WORKSPACE_NAV_SECTIONS` (Workspace, Records, Insights), `BOTTOM_NAV_ITEMS`, `MOBILE_PRIMARY_TAB_IDS`, and `MOBILE_MORE_ITEM_IDS`. Every navigation item is backed by a verified Next.js App Router route.
- **Minimal Real Workspace Pages**:
  - `/contracts`: Complete renewals ledger with status filter tabs (All, Active, Negotiating, Renewed, Cancelled), heuristic savings calculation, and empty state.
  - `/negotiations`: Active multi-round concession dialogues, pricing breakdowns, and direct inspection links to decision checklists.
  - `/activity`: Standalone live timeline feed of autonomous waste detection, negotiations, and on-chain escrow locks.
  - `/approvals`: Dedicated governance page displaying pending ceiling exceptions with live count badges.
- **Desktop Collapsible Sidebar (`AppSidebar.tsx`)**:
  - Top: Logo + Tavryn branding and active organization switcher with verified "Real" vs "Demo" badges.
  - Middle: Grouped navigation sections with active route highlights, badges (`CHAINED`, `LIVE`), and icon hover tooltips when collapsed.
  - Bottom: "Add business" (`/onboard`), "Settings" (`/settings`), and live Arc Testnet Treasury balance chip linking to smart contract wallets on `https://testnet.arcscan.app`.
- **Mobile Bottom Tab Bar & More Sheet (`MobileTabBar.tsx`)**:
  - Fixed bottom tab bar below `md` with Overview, Activity, Approvals (live badge), Metrics, and "More".
  - Slide-up bottom sheet with Negotiations, Contracts, Audit trail, Add business, Settings, and ArcScan treasury access.
- **Top Header Modernization (`AppHeader.tsx`)**:
  - Prominent "Run agent now" button for immediate autonomous procurement runs, dark mode toggle, and notification bell.
- **Resilient Route Guards & Not-Found Page**:
  - `app/page.tsx` renders `DashboardPage` (Overview) directly for authenticated sessions while preserving the marketing landing page for logged-out visitors.
  - `app/not-found.tsx` provides clean 404 recovery with "Return to Overview" linking to `/`.
- **Playwright Test Suite (`tests/e2e/nav-links.spec.ts`)**:
  - Automated crawl of all routes in `nav.ts` asserting HTTP 200, visible headings, active `aria-current="page"` highlight verification, and zero dead `#` or empty hrefs across Chromium and Mobile (Pixel 7).

## One decision worth explaining

Rather than forcing complex multi-level nested menus on mobile screens, we adopted a hybrid mobile navigation pattern: the 4 highest-frequency daily routes (Overview, Activity, Approvals, Metrics) live directly on a thumb-friendly bottom tab bar, while secondary workflows (Negotiations, Contracts, Audit trail, Settings, and Organization Switching) slide up in an accessible "More" sheet. This keeps the primary agent observation and approval loop accessible within a single tap.

## The honest part

When switching organizations in the mobile sheet or desktop sidebar, the entire application context reloads to guarantee that Supabase Row-Level Security session filters and cached heuristics re-evaluate cleanly. While a client-side context switch would feel marginally faster, full URL query parameter synchronization (`/?businessId=...`) ensures zero stale-state cross-contamination between simulated and real business treasuries.

## Proof

- **Playwright Navigation Spec**: 8/8 tests passing in `tests/e2e/nav-links.spec.ts` across Chromium and Mobile (Pixel 7).
- **Full E2E Suite**: 16/16 tests passing in `npm run test:e2e`.
- **Deterministic Policy Unit Tests**: 13/13 unit tests passing in `npm run test:unit`.
- **Arc Escrow Contract Tests**: 7/7 smart contract tests passing in `npm run test:contracts`.
- **Visual Evidence**: Captured visual screenshots of expanded desktop sidebar (`sidebar-desktop-expanded.png`), collapsed desktop sidebar (`sidebar-desktop-collapsed.png`), and mobile bottom tab bar with the More sheet (`mobile-tab-bar-more-sheet.png`).

## Next up

Autonomous multi-agent orchestration, Slack/webhook real-time notification dispatch, and public hackathon showcase presentation.

---

`Stage 0005` · [back to INDEX.md](./INDEX.md)

# Stage 0018: UI Polish, Auth Governance, and Stacking Harmony

_Oct 04, 2026 · Fixed 15 core UI/UX and governance items: ring stroke animation with live percentage in the agent timeline, dynamic phase loop, official logo restoration, active org sidebar persistence in Settings, seamless SPA transitions, metadata & favicon, radar beacon redesign, proxy auth protection for dashboard routes, harmonized border radii, single demo org isolation, and modal overlay stacking context fixes._

---

## What Tavryn can do now that it couldn't last time

1. **Precision Timeline Animation & Percentage of Full Loop Completed** (`components/ActivityTimeline.tsx`):
   - The Autonomous Agent Execution timeline now animates with a rotating SVG stroke circle encircling a static, upright agent icon rather than rotating the icon itself.
   - The percentage strictly displays the **percentage of Full loop completed** (`Math.round(completedSteps / totalSteps * 100)`), advancing monotonically as each pipeline step finishes, without arbitrary modulo wrapping.
2. **Autonomous Timeline States & Live Loop Badge** (`components/ActivityTimeline.tsx`):
   - When idle (not running), the timeline displays a steady *"Live Loop"* badge and static text (*"Observe → Analyze → Negotiate → Decide → Execute → Learn for Demo Co"*), eliminating background interval jitter.
   - When running, the badge and subtitle dynamically cycle through the active execution phases (*"Observing"*, *"Analyzing"*, *"Negotiating"*, *"Deciding"*, *"Executing"*, and *"Learning"*) aligned with the active pipeline step.
3. **Contracts Ledger Status Badge Font Sizing** (`components/opportunities/DesktopOpportunitiesTable.tsx`, `components/opportunities/MobileOpportunitiesList.tsx`, `app/contracts/page.tsx`):
   - Reduced font size of the status badge from `text-xs` (12px) to `text-[10px] font-bold uppercase tracking-wider` with proportional `px-2 py-0.5` padding, creating a sleeker, higher-density table row aesthetic.
4. **Official Brand Logo Consistency** (`app/r/[token]/page.tsx`, `app/r/[token]/opengraph-image.tsx`):
   - Eliminated the fallback green square with letter "T", replacing it with the official Tavryn logo (`/logo.png`) on public savings receipts and in generated OpenGraph receipt cards.
5. **Active Organization Persistence in Settings** (`app/settings/page.tsx`, `app/api/business/route.ts`):
   - Created `/api/business` to supply the active organization registry. The Settings page now hydrates `AppShell` with the active business name, ID, live USDC treasury balance, and wallet address.
6. **Fluid Native Page Transitions** (Removed `app/loading.tsx`):
   - Deleted the global root loading page that previously caused full-viewport blank white flashes during client-side navigation. Route changes now feel like a smooth single-page application with the animated top progress bar.
7. **Polished Spend Terminology** (`app/page.tsx`, `components/ActivityTimeline.tsx`, `tests/e2e/demo-flow.spec.ts`):
   - Rephrased colloquial "finds the waste" phrasing across the landing page and execution stream to professional enterprise terminology: *"uncovers spend inefficiencies"*.
8. **Comprehensive Metadata & Favicon Assets** (`app/layout.tsx`, `app/icon.png`, `public/favicon.ico`):
   - Configured high-resolution `favicon.png` across `app/icon.png` and `public/favicon.ico`.
   - Populated standard OpenGraph, Twitter, and SEO metadata with title `Tavryn | Procurement & Treasury Ledger`.
9. **Layered Radar Beacon Indicator** (`components/ActivityTimeline.tsx`):
   - Rebuilt the Autonomous Agent live pulse with a concentric radar beacon featuring a solid core dot and radiating outer glow.
10. **Direct Root Access & Strict Dashboard Route Protection** (`app/page.tsx`, `proxy.ts`):
   - Removed eager cookie-redirect on the root URL `/`, enabling users to inspect the public landing page freely.
   - Configured Next 16 `proxy.ts` to require authentication for all dashboard routes (`/dashboard`, `/contracts`, `/activity`, `/negotiations`, `/audit`, `/metrics`, `/settings`) while leaving landing, public receipts, and static assets accessible.
11. **Proportional Border Radius System**:
    - Replaced mismatched `rounded-xl` and `rounded-2xl` pill shapes on compact buttons and table actions with clean `rounded-lg` borders across all navigation headers, filters, and mobile cards.
12. **Single Demo Organization Isolation** (`scripts/quarantine-demo-co.ts`):
    - Cleaned up ephemeral test organizations from the database, isolating the demo environment strictly to `Demo Co` (`b655fb94-fc62-4e3c-8898-2c5f88068159`), and added query guards (`.not("name", "ilike", "[Deleted%")`) across all pages.
13. **Modal Backdrop Stacking Context Fix** (`components/AppShell.tsx`, `components/AnalysisModal.tsx`, `app/audit/AuditTableClient.tsx`, `app/settings/page.tsx`):
    - Removed `relative z-10` from `AppShell` main container to eliminate trapped stacking contexts. Elevated modal backdrops to `z-[60]` with backdrop-blur, ensuring sidebars and headers remain strictly underneath modal overlays.
14. **Organization Switching Loaders** (`components/BusinessSwitcher.tsx`, `components/AppSidebar.tsx`, `components/UserDropdown.tsx`, `components/MobileTabBar.tsx`):
    - Wired `startTopLineLoader()` and localized animated spinners (`<Loader2 className="animate-spin" />`) into all organization selectors. Switching tenants now provides immediate visual feedback via the top-line progress bar and disabled inputs during route transitions.
15. **Instant Settings Server Component & Real Business Support** (`app/settings/page.tsx`, `app/settings/SettingsClient.tsx`):
    - Converted `/settings` from a client-side component with sequential fetch waterfalls into a high-performance async Server Component. Data fetches directly from Supabase on the server, eliminating client loading delays and blank states.
    - Fixed real organization support by eliminating the hardcoded fallback to Demo Co (`b655fb94-fc62-4e3c-8898-2c5f88068159`). Real businesses now inspect and configure their deterministic spending caps, category budgets, Arc treasury wallets, and webhooks seamlessly.
16. **Route & Tenant Context Preservation** (`components/BusinessSwitcher.tsx`, `components/AppSidebar.tsx`, `components/UserDropdown.tsx`, `components/MobileTabBar.tsx`):
    - Switching active organizations now preserves the current route (e.g. staying on `/settings?businessId=...`) rather than blindly redirecting users to `/dashboard`.
    - Main and bottom sidebar navigation links now retain `?businessId=${activeBusinessId}`, preventing unintended loss of active tenant context across tabs.

## Trade-offs & honest caveats

- The Next.js 16 App Router Turbopack convention uses `proxy.ts` rather than `middleware.ts`. Renaming it would break route interception under Turbopack.
- `agent_actions` is strictly append-only by database trigger constraint. Ephemeral test businesses with action logs were safely soft-quarantined and filtered out rather than violating ledger immutability.

## Files changed

| File | What |
| --- | --- |
| `components/ActivityTimeline.tsx` | Stroke ring animation, live progress %, idle Live Loop badge & static text, dynamic phase loop, radar beacon |
| `app/r/[token]/page.tsx` | Swapped placeholder "T" with official `/logo.png` |
| `app/r/[token]/opengraph-image.tsx` | Embedded official logo into OpenGraph receipt images |
| `app/layout.tsx` | Standardized metadata, title, description, and icons |
| `app/page.tsx` | Rephrased copy, removed root auto-redirect |
| `app/loading.tsx` | Removed blank-screen transition loader |
| `app/api/business/route.ts` | New endpoint returning active businesses for sidebar hydration |
| `app/settings/page.tsx` | Converted to async Server Component with direct Supabase querying and real business resolution |
| `app/settings/SettingsClient.tsx` | Extracted client-side policy editing, webhooks, and org deletion with instant hydration |
| `components/AppShell.tsx` | Removed restrictive z-index context on main container |
| `components/AnalysisModal.tsx` | Elevated modal dialog overlay to `z-[60]` |
| `app/audit/AuditTableClient.tsx` | Elevated modal dialog overlay to `z-[60]` and refined button radii |
| `proxy.ts` | Enforced dashboard route protection and public static whitelist |
| `components/AppHeader.tsx` | Refined button border radii |
| `components/BusinessSwitcher.tsx` | Refined button border radii, added inline spinner and route preservation on switch |
| `components/AppSidebar.tsx` | Added inline spinner and route preservation on switch, appended activeBusinessId to nav links |
| `components/UserDropdown.tsx` | Connected top-line loader and route preservation on switch |
| `components/MobileTabBar.tsx` | Added inline spinner, route preservation, and activeBusinessId link retention |
| `components/ThemeToggle.tsx` | Refined button border radii |
| `components/opportunities/*` | Refined button border radii and reduced status badge font size to 10px |
| `app/approvals/page.tsx` | Filtered out quarantined organizations |
| `app/audit/page.tsx` | Filtered out quarantined organizations |
| `app/contracts/page.tsx` | Filtered out quarantined organizations and refined button radii |
| `app/metrics/page.tsx` | Filtered out quarantined organizations |
| `app/negotiations/page.tsx` | Filtered out quarantined organizations and refined button radii |
| `scripts/quarantine-demo-co.ts` | Script to quarantine non-demo organizations safely |

## Verification

```bash
# 1. Verify ESLint (0 errors)
npx eslint --quiet .

# 2. Verify Next.js 16 Turbopack production build (0 errors)
npm run build
```

Both commands pass with 0 errors.

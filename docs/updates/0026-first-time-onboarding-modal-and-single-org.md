# Stage 0026: First-Time Onboarding Modal, Hash Fragment Auth Sync & Canonical Single-Org URLs

_Oct 09, 2026 · Caught email confirmation URL hash fragments across all routes with `AuthHashListener`, created a guided 2-step first-time login modal for company name, industry type, and bill ingestion, and removed `?businessId=...` URL parameter pollution by centralizing session-bound single organization resolution in `getActiveBusiness()`._

---

## What Tavryn can do now that it couldn't last time

1. **Seamless Email Confirmation Hash Handling**:
   - When users click Supabase confirmation links in their email, GoTrue redirects to `http://localhost:3000/#access_token=...&refresh_token=...&type=signup`.
   - Since HTTP servers never receive client-side URL hash fragments (`#...`), users previously remained on the marketing landing page unauthenticated.
   - We created and mounted `AuthHashListener` in `app/layout.tsx`. It automatically intercepts auth hash fragments anywhere in the application, synchronizes `sb-tavryn-auth-token` session cookies eagerly, and routes operators to `/auth/callback`.
   - Enhanced `app/auth/callback/page.tsx` to extract hash tokens, call `supabase.auth.setSession()`, write the session cookie, and transition operators into `/dashboard`.
   - Updated `app/auth/register/page.tsx` to set `emailRedirectTo` directly to `/auth/callback?next=/dashboard`.

2. **First-Time Login Onboarding Modal (`components/FirstTimeOnboardingModal.tsx`)**:
   - Whenever a newly registered or unonboarded operator logs in and lands on `/dashboard`, a guided 2-step modal activates automatically:
     - **Step 1 (Company Profile)**: Captures Company Name and Industry Type (SaaS, FinTech, AI, Healthcare, E-Commerce, Professional Services, etc.) alongside primary Arc USDC currency confirmation.
     - **Step 2 (Import Bills & Contracts)**: Offers document ingestion (drag-and-drop PDF invoices, bank CSV statements, or subscriptions CSV parsed via `/api/import/file`) or a 1-click **Load Benchmark Stack** button (Salesforce, Slack, Datadog, AWS, GitHub with benchmark usage declines).
     - **Automated Provisioning**: Submits to `/api/onboard`, inserting the organization, establishing `owner` role in `business_members`, provisioning a dedicated Arc Treasury wallet, and writing contracts in an atomic transaction before refreshing the dashboard.
     - Includes a non-blocking "Explore with Demo Co first" skip option for hackathon evaluators.

3. **Canonical Single-Org URLs (Elimination of `?businessId=...` Query Pollution)**:
   - Previously, navigating the app appended `?businessId=4daa24d8-771e-4` to every route because the frontend passed explicit IDs to distinguish multiple simulated businesses.
   - Since each authenticated user now has strictly one organization (or Demo Co for demo evaluators), we centralized organization resolution into `getActiveBusiness()` in `lib/active-business.ts`.
   - All server routes (`/dashboard`, `/approvals`, `/contracts`, `/decision`, `/metrics`, `/negotiations`, `/activity`, `/settings`) now determine the tenant context server-side from session cookies and `business_members` table lookups.
   - Cleaned all navigation links, sidebar items, approvals filter tabs, and switcher components to use canonical routes (`/dashboard`, `/approvals?filter=pending`, `/settings`) without URL query bloat.

4. **Resilient Database Schema Support for Industry**:
   - Added migration `0008_industry_column.sql` adding `industry text` to the `businesses` table.
   - Added `industry: z.string().trim().optional()` to `OnboardBusinessPayloadSchema` in `lib/schemas.ts`.
   - Upgraded `/api/onboard` with schema-safe fallback execution: if the remote database hasn't applied the migration yet, the route gracefully retries the insert without failing the onboarding process.

---

## Detailed File Changes Matrix

| File | Change | Rationale |
|---|---|---|
| `components/AuthHashListener.tsx` | Created global client component to detect Supabase hash fragment tokens (`#access_token=...`) | Catches email confirmation links arriving at `/` or any route and synchronizes cookies. |
| `app/layout.tsx` | Mounted `AuthHashListener` inside `RootLayout` body | Ensures email confirmation redirects work immediately from any landing path. |
| `app/auth/callback/page.tsx` | Added explicit hash fragment parsing (`access_token`, `refresh_token`, `error_description`) and defaulted next destination to `/dashboard` | Establishes Supabase session and session cookie cleanly for hash-based GoTrue redirects. |
| `app/auth/register/page.tsx` | Updated `emailRedirectTo` to `/auth/callback?next=/dashboard` | Points future registration confirmation emails directly to the callback handler. |
| `components/FirstTimeOnboardingModal.tsx` | Built guided 2-step modal for Company Name + Industry Type and Bill Ingestion | Onboards first-time logged-in users smoothly with upload and benchmark options. |
| `components/AppShell.tsx` | Mounted `FirstTimeOnboardingModal` with `currentBusinessIsReal` prop | Displays onboarding prompt on first login when user has no real business yet. |
| `lib/active-business.ts` | Created centralized server-side `getActiveBusiness()` resolution helper | Determines active tenant from session cookies and `business_members` without needing URL params. |
| `app/dashboard/page.tsx` | Replaced manual fallback business selection with `getActiveBusiness(businessId)` | Ensures logged-in users see their own business on `/dashboard` without `?businessId=...`. |
| `app/approvals/page.tsx` | Used `getActiveBusiness(businessId)` and stripped `businessId` from filter tab URLs | Clean tab navigation (`/approvals?filter=rejected`) without tenant UUID pollution. |
| `app/contracts/page.tsx` | Used `getActiveBusiness(businessId)` | Consistent tenant scoping on the contracts ledger. |
| `app/settings/page.tsx` | Used `getActiveBusiness(businessId)` | Unifies settings page organization resolution with active-business helper. |
| `app/metrics/page.tsx` | Used `getActiveBusiness(businessId)` | Scopes traction metrics to the session's active business. |
| `app/decision/page.tsx` | Used `getActiveBusiness(businessId)` | Scopes decision redirection to the session's active business. |
| `app/negotiations/page.tsx` | Used `getActiveBusiness(businessId)` | Scopes negotiations list to the session's active business. |
| `app/activity/page.tsx` | Used `getActiveBusiness(businessId)` | Scopes activity ledger to the session's active business. |
| `components/BusinessSwitcher.tsx` | Removed obsolete `router.push(?businessId=...)` code and unused imports | Matches 1:1 single-business model where logged user has one organization. |
| `components/ApprovalsHeader.tsx` | Restored `hasPending` and cleaned `settingsUrl` to `/settings` | Removes `?businessId=...` query from settings link while keeping alert ping badge. |
| `app/import-bills/components/FundingResultCard.tsx` | Changed completion CTA to `/dashboard` | Removes UUID query parameter from post-onboarding redirect. |
| `app/onboard/components/FundingResultCard.tsx` | Changed completion CTA to `/dashboard` | Removes UUID query parameter from legacy onboard redirect. |
| `lib/schemas.ts` | Added `industry: z.string().trim().optional()` to `OnboardBusinessPayloadSchema` | Supports industry classification during onboarding. |
| `app/api/onboard/route.ts` | Added `industry` column support with graceful schema fallback retry | Stores industry safely even if remote DB migration is pending. |
| `supabase/migrations/0008_industry_column.sql` | Created migration adding `industry text` to `businesses` | Adds industry metadata field to database schema. |
| `docs/DECISIONS.md` | Recorded ADR-026 | Logs single-business server resolution and onboarding modal architecture. |

---

## Verification & Integrity

1. **Unit Tests**:
   - `npm run test:unit`: All 42 unit tests passing across email templates, recurring detection, and policy engine.
2. **TypeScript Compilation**:
   - `npx tsc --noEmit`: Exited with code 0 (zero errors across all pages, components, and server actions).
3. **Session Verification**:
   - Demo session (`demo-tavryn-session-token`) strictly maps to **Demo Co**.
   - Authenticated user sessions strictly map to their owned record in `business_members`.
   - New user without an onboarded business triggers the First-Time Onboarding Modal with Company Name & Industry Type, followed by Bill Ingestion.

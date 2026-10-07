# Stage 0019: Import Bills & Single-Account Organization Model

_Oct 08, 2026 · Streamlined workspace navigation by rebranding "Add Business" to "Import Bills" (/import-bills), tearing out multi-tenant switcher dropdowns across sidebar and user menus, and transitioning to a clean 1:1 business-to-authenticated-account model._

---

## What Tavryn can do now that it couldn't last time

1. **"Import Bills" Rebrand & Dedicated Route (`/import-bills`)**:
   - The sidebar bottom navigation now prominently displays **"Import Bills"** (backed by Lucide's `FileSpreadsheet` icon) pointing directly to `/import-bills`.
   - The user profile dropdown replaces the old "Onboard New Business" action with a direct **"Import Bills"** menu option.
   - The dedicated page (`/import-bills`) features clean breadcrumbs (`Overview / Import Bills`), updated headers, and quick-import accelerators for invoice PDFs and statement CSVs.
   - The legacy `/onboard` route now cleanly issues a Next.js server redirect to `/import-bills`, guaranteeing zero broken bookmarks or dangling links.

2. **Total Removal of Business Switcher Logic**:
   - Removed the `<select>` organization dropdowns previously embedded in `components/AppSidebar.tsx` and the mobile drawer (`components/MobileTabBar.tsx`).
   - Purged the multi-tenant "Switch Business" button list and switching handlers (`handleSwitchBusiness`) from `components/UserDropdown.tsx`.
   - Converted active organization displays into sleek, static, read-only identity chips (showing the business name with "Real" or "Demo" badges) that cleanly reflect the current authenticated tenant.

3. **Single-Account Business Architecture**:
   - Every authenticated account now corresponds 1:1 with its business organization.
   - Removed URL query parameter pollution (`?businessId=...`) across sidebar links, mobile tab bar links, and navigation items. Routes remain clean, canonical (`/dashboard`, `/contracts`, `/import-bills`), and resilient across tab reloads.

4. **Synchronized App-Wide References**:
   - Updated opportunities header quick-add button (`components/opportunities/OpportunitiesHeader.tsx`), contracts ledger actions (`app/contracts/page.tsx`), and the 404 resource page (`app/not-found.tsx`) to link straight to `/import-bills`.
   - Updated magic-link authentication defaults in `lib/auth.ts` to redirect freshly authenticated users to `/import-bills`.

---

## Trade-offs & honest caveats

- By eliminating organization switching from the UI, power users or multi-entity accountants cannot hot-swap between multiple client workspaces in a single active session; each business must log in with its dedicated authenticated credentials.
- The underlying API (`/api/onboard`) still handles backend contract ingestion and treasury provisioning under its existing endpoint name so existing test fixtures continue to function seamlessly without invasive database migrations.

---

## Files changed

| File | What |
| --- | --- |
| `lib/nav.ts` | Changed `onboard` to `import-bills` in `BOTTOM_NAV_ITEMS` and `MOBILE_MORE_ITEM_IDS`, added `FileSpreadsheet` icon type |
| `components/UserDropdown.tsx` | Removed "Switch Business" list, switcher logic, and router pushes; added "Import Bills" menu item |
| `components/AppSidebar.tsx` | Replaced `<select>` switcher with static organization badge; simplified nav hrefs to clean canonical routes |
| `components/MobileTabBar.tsx` | Replaced sheet switcher with static organization badge; simplified bottom tabs and drawer nav hrefs |
| `components/BusinessSwitcher.tsx` | Replaced interactive select dropdown with static badge and "Import Bills" button |
| `app/import-bills/page.tsx` | Created dedicated page with updated breadcrumbs, headers, and file upload dropzones |
| `app/import-bills/components/*` | Re-exported ingestion cards, review tables, and funding summaries |
| `app/onboard/page.tsx` | Replaced with Next.js redirect to `/import-bills` |
| `components/opportunities/OpportunitiesHeader.tsx` | Updated primary action link to `/import-bills` |
| `app/contracts/page.tsx` | Updated header and empty-state action links to `/import-bills` |
| `app/not-found.tsx` | Updated secondary navigation CTA to `/import-bills` |
| `lib/auth.ts` | Updated default `signInWithOtp` redirect destination to `/import-bills` |
| `tests/e2e/mobile-views.spec.ts` | Updated viewport audit route list from `/onboard` to `/import-bills` |
| `docs/DECISIONS.md` | Logged ADR-024 for 1:1 business-to-account tenancy and navigation rebrand |

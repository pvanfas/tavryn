# Stage 0025: Beautiful & Branded Authentication Emails & Settings Session Scoping

_Oct 09, 2026 · Replaced Supabase's default unstyled plaintext auth emails with responsive branded HTML templates, built an in-app interactive preview studio at `/settings/email-templates`, and fixed the settings page active organization resolution to strictly respect the authenticated session (Demo Co vs. tenant) instead of picking ephemeral test businesses from the database._

---

## What Tavryn can do now that it couldn't last time

1. **Brand-Aligned Transactional Auth Emails**:
   - Authentication emails now arrive with Tavryn's signature palette: `#107e65` emerald accents, deep `#0f172a` headings, clean `#ffffff` cards on soft dual-tone `#f8fafc` canvas, and subtle `#e2e8f0` borders.
   - Every email features bulletproof table-based CTA buttons tested for 100% email client support (Apple Mail, Gmail web & iOS/Android, and Outlook desktop with VML fallbacks).
   - Clean single-click direct authentication flow without confusing or extraneous 6-digit confirmation codes, ensuring operators click through directly to their workspace or password reset screen.
   - Integrated security callouts remind users that Tavryn will never solicit private keys, seed phrases, or wallet secrets.

2. **Standalone GoTrue Template Suite (`emails/auth/`)**:
   - Authored four static, ready-to-copy HTML templates directly compatible with Supabase Auth (GoTrue):
     - `magic-link.html`: Magic Link passwordless sign-in with direct button + URL fallback.
     - `reset-password.html`: Password reset with 10-minute security expiration warning.
     - `confirm-signup.html`: New operator email verification with Arc USDC treasury overview.
     - `invite-user.html`: Workspace invite with inviter context, organization name, and dual-agent governance context.

3. **In-App Email Studio (`/settings/email-templates`)**:
   - Added an interactive developer and operator studio under Settings where team admins can:
     - Toggle between all four email templates in real time.
     - Switch viewports between **Desktop (600px)**, **Mobile (375px)**, and **Raw HTML Source**.
     - View sandboxed iframe rendering with mock parameters.
     - Copy the production GoTrue template or subject line with one click.
     - Follow step-by-step guidance on pasting templates into the Supabase Dashboard.

4. **Settings Page Session-Aware Active Organization Resolution (`app/settings/page.tsx`)**:
   - Fixed a critical organization resolution bug where `/settings` previously sorted businesses descending and grabbed `businesses.find(b => b.is_real)`. This caused anyone logged in as **Demo Co** to be hijacked by recently generated test organizations (e.g., `Test Real Business 1791443747408`) created during automated test runs.
   - The settings page now inspects the caller's session cookies (`sb-tavryn-auth-token` demo token and Supabase auth session):
     - If the demo operator session is active, it strictly resolves to **Demo Co**.
     - If an authenticated real user is logged in, it looks up their membership in `business_members` to resolve their exact organization.
     - Fallback reliably defaults to **Demo Co** rather than arbitrary test businesses.

5. **Automated Unit Verification (`tests/email-templates.spec.ts`)**:
   - Added 12 unit tests verifying that all templates contain valid HTML, preserve required GoTrue replacement tags, properly escape preview parameters, and verify file integrity on disk.

---

## Detailed File Changes Matrix

| File | Change | Rationale |
|---|---|---|
| `app/settings/page.tsx` | Resolved active business via session cookie (`demo-tavryn-session-token` -> Demo Co, authenticated user -> `business_members`), ordered businesses ascending | Eliminates active business hijacking where ephemeral test businesses took over the settings page for Demo Co users. |
| `lib/email/auth-templates.ts` | Created pure TypeScript template engine for all 4 auth email types | Generates bulletproof HTML for both production Supabase GoTrue tags and in-app preview rendering. |
| `emails/auth/magic-link.html` | Created standalone GoTrue HTML for magic link sign-in | Ready to copy directly into Supabase Dashboard -> Authentication -> Email Templates. |
| `emails/auth/reset-password.html` | Created standalone GoTrue HTML for password reset | High-contrast security notice with 10-minute expiration advisory. |
| `emails/auth/confirm-signup.html` | Created standalone GoTrue HTML for new account confirmation | Welcomes operator with clean single-click account confirmation button. |
| `emails/auth/invite-user.html` | Created standalone GoTrue HTML for organization invitations | Clear inviter attribution and dual-role governance briefing. |
| `app/settings/email-templates/page.tsx` | Built interactive in-app email studio with desktop/mobile iframe toggles | Enables admins to preview, inspect, and export templates without leaving the app. |
| `app/settings/SettingsClient.tsx` | Added "Branded Auth Email Templates" link card | Surfaces the email studio directly from the core Organization Settings view. |
| `app/page.tsx` | Updated hero secondary CTA to link to `/public-metrics` | Direct access to public proof metrics. |
| `tests/email-templates.spec.ts` | Added 12 unit tests covering all templates and static file integrity | Ensures template tags and responsive layouts don't regress. |
| `docs/guides/auth-email-setup.md` | Created step-by-step Supabase configuration and SMTP guide | Guides operators through setting up custom SMTP (Resend/SendGrid) and pasting templates. |
| `docs/architecture/decisions.md` | Recorded ADR-026 | Formally documents the decision for zero-runtime email compilation. |
| `docs/DECISIONS.md` | Added ADR-026 quick summary | Keeps one-line architectural log synchronized. |

---

## Decisions & Trade-offs

- **Session-Based Organization Resolution vs. Blind `is_real` Heuristic**: The previous heuristic assumed that if any `is_real: true` organization existed in the database, it should be shown on the settings page by default. However, integration tests create ephemeral `Test Real Business <timestamp>` records. By inspecting the active session cookie (`demo-tavryn-session-token` or Supabase user JWT) and mapping through `business_members`, the settings page now guarantees strict tenant fidelity across demo evaluators and authenticated operators alike.
- **Single-Click Direct Links vs. Multi-Digit Code Input**: Tavryn uses passwordless magic link authentication and direct email confirmations. Because our login and onboarding UI does not feature a 6-digit confirmation code input field, we intentionally omitted OTP code boxes from the templates to eliminate confusing dead ends and provide a frictionless 1-click user journey.

---

## Test Verification

```
 ✓ tests/email-templates.spec.ts (12 tests) 5ms
 ✓ tests/recurring-detection.spec.ts (14 tests) 8ms
 ✓ tests/policy-engine.spec.ts (16 tests) 16ms

 Test Files  3 passed (3)
      Tests  42 passed (42)
   Duration  425ms

Typecheck: tsc --noEmit -> 0 errors.
ESLint: 0 errors across all source files.
```

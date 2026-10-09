# Tavryn Branded Authentication Emails Setup Guide

> **Official Guide:** Complete walkthrough for setting up responsive, high-fidelity branded authentication emails for Tavryn in Supabase Auth.

---

## Table of Contents

1. [Overview & Design System](#1-overview--design-system)
2. [Included Auth Email Templates](#2-included-auth-email-templates)
3. [In-App Email Studio (`/settings/email-templates`)](#3-in-app-email-studio-settingsemail-templates)
4. [Step-by-Step Supabase Configuration](#4-step-by-step-supabase-configuration)
5. [GoTrue Template Variables Reference](#5-gotrue-template-variables-reference)
6. [SMTP & Deliverability Best Practices](#6-smtp--deliverability-best-practices)

---

## 1. Overview & Design System

By default, Supabase sends unstyled plaintext emails. Tavryn provides production-grade, responsive HTML email templates designed to match the protocol's signature visual identity:

- **Primary Accent:** Tavryn Emerald (`#107e65`) with hover accent `#0d6b55`
- **Surface & Canvas:** Dual-tone canvas with crisp `#ffffff` card, `#f8fafc` outer canvas, and `#e2e8f0` structural borders
- **Typography:** Universal system font stack (`-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`) with high-contrast `#0f172a` headings
- **Bulletproof CTA Buttons:** Table-based buttons with Microsoft Outlook VML fallbacks for 100% email client compatibility (Apple Mail, Gmail, Outlook Desktop/Web, iOS Mail, Android)
- **Direct Link Fallbacks:** Monospace word-break URL fallbacks for corporate environments where buttons or image loading are restricted

---

## 2. Included Auth Email Templates

All templates are located in [`emails/auth/`](file:///Users/chris/Documents/GitHub/tavryn/emails/auth/) as standalone files ready to paste:

| Template | File Path | Default Subject Line | Supabase Tab |
| :--- | :--- | :--- | :--- |
| **Magic Link Sign-In** | [`emails/auth/magic-link.html`](file:///Users/chris/Documents/GitHub/tavryn/emails/auth/magic-link.html) | `Your Tavryn sign-in link` | **Magic Link** |
| **Password Reset** | [`emails/auth/reset-password.html`](file:///Users/chris/Documents/GitHub/tavryn/emails/auth/reset-password.html) | `Reset your Tavryn password` | **Reset Password** |
| **Confirm Sign-Up** | [`emails/auth/confirm-signup.html`](file:///Users/chris/Documents/GitHub/tavryn/emails/auth/confirm-signup.html) | `Verify your email to activate Tavryn` | **Confirm signup** |
| **Workspace Invite** | [`emails/auth/invite-user.html`](file:///Users/chris/Documents/GitHub/tavryn/emails/auth/invite-user.html) | `You've been invited to join Tavryn` | **Invite user** |

---

## 3. In-App Email Studio (`/settings/email-templates`)

Tavryn includes a live interactive studio built directly into the app at [`/settings/email-templates`](file:///Users/chris/Documents/GitHub/tavryn/app/settings/email-templates/page.tsx):

- **Live Device Preview:** Toggle between **Desktop (600px)**, **Mobile (375px)**, and **Raw HTML Source** views.
- **One-Click Export:** Copy the production GoTrue template or subject line directly to your clipboard.
- **Sandboxed Rendering:** Live iframe rendering isolated from dashboard CSS.
- **Access Point:** Navigate to **Settings** (`/settings`) &rarr; click **Open Studio** under the **Branded Auth Email Templates** section.

---

## 4. Step-by-Step Supabase Configuration

Follow these steps to apply the branded templates to your Supabase project:

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project and select **Authentication** from the left navigation.
3. Click **Email Templates** under the **Configuration** menu.
4. For each email template:
   - Click the template tab (e.g. **Magic Link**).
   - In the **Subject** field, paste the recommended subject line.
   - In the **Message Body** field, delete the default unstyled markup and paste the corresponding HTML from [`emails/auth/`](file:///Users/chris/Documents/GitHub/tavryn/emails/auth/) (or from the Tavryn Email Studio).
   - Click **Save changes** at the bottom.
5. Repeat for **Reset Password**, **Confirm signup**, and **Invite user**.

---

## 5. GoTrue Template Variables Reference

The templates leverage Supabase GoTrue variables that are automatically substituted at send time:

| Variable | Description | Used In |
| :--- | :--- | :--- |
| `{{ .ConfirmationURL }}` | Single-use authentication or reset redirection link | All templates |
| `{{ .Email }}` | Recipient's registered email address | All templates (footer & disclaimer) |
| `{{ .SiteURL }}` | Base site URL configured in Supabase Auth settings | Global redirects |
| `{{ .Data }}` | Custom metadata object passed during user invite or creation | Invite User (`{{ .Data.org_name }}`) |

---

## 6. SMTP & Deliverability Best Practices

For production deployments (such as `tavryn.space`), configure a custom SMTP provider in Supabase to eliminate rate limits and ensure maximum inbox deliverability:

1. In Supabase Dashboard, go to **Authentication** &rarr; **SMTP Settings**.
2. Enable **Custom SMTP**.
3. Configure your provider (e.g., **Resend**, **SendGrid**, or **Postmark**):
   - **Sender Email:** `auth@tavryn.space` or `notifications@tavryn.space`
   - **Sender Name:** `Tavryn Procurement`
   - **Host:** `smtp.resend.com` (port `465` or `587`)
4. Verify your sending domain's **SPF**, **DKIM**, and **DMARC** DNS records.

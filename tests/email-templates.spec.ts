import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AUTH_EMAIL_METADATA,
  AuthEmailType,
  generateConfirmSignupEmail,
  generateInviteUserEmail,
  generateMagicLinkEmail,
  generateResetPasswordEmail,
  renderAuthEmail,
} from "@/lib/email/auth-templates";

describe("Tavryn Auth Email Templates", () => {
  describe("Metadata Registry", () => {
    it("defines metadata for all 4 required auth email types", () => {
      const types: AuthEmailType[] = [
        "magic_link",
        "reset_password",
        "confirm_signup",
        "invite_user",
      ];
      for (const t of types) {
        const meta = AUTH_EMAIL_METADATA[t];
        expect(meta).toBeDefined();
        expect(meta.title).toBeTruthy();
        expect(meta.defaultSubject).toBeTruthy();
        expect(meta.supabaseTemplateName).toBeTruthy();
      }
    });
  });

  describe("Magic Link Email", () => {
    it("generates GoTrue template containing Supabase tags", () => {
      const html = generateMagicLinkEmail({ mode: "gotrue" });
      expect(html).toContain("{{ .ConfirmationURL }}");
      expect(html).toContain("{{ .Email }}");
      expect(html).toContain("Tavryn");
      expect(html).toContain("Autonomous Procurement");
      expect(html).toContain("#107e65");
      expect(html).toContain("Sign In to Tavryn");
      expect(html).not.toContain("{{ .Token }}");
    });

    it("renders preview mode with mock values without unescaped GoTrue tags", () => {
      const html = generateMagicLinkEmail({
        mode: "preview",
        email: "test@finance.co",
        confirmationUrl: "https://tavryn.space/auth/callback?code=mock123",
      });
      expect(html).not.toContain("{{ .ConfirmationURL }}");
      expect(html).not.toContain("{{ .Token }}");
      expect(html).toContain("test@finance.co");
      expect(html).toContain("https://tavryn.space/auth/callback?code=mock123");
    });
  });

  describe("Password Reset Email", () => {
    it("generates password reset email with security expiration notice", () => {
      const html = generateResetPasswordEmail({ mode: "gotrue" });
      expect(html).toContain("{{ .ConfirmationURL }}");
      expect(html).toContain("{{ .Email }}");
      expect(html).toContain("Reset your password");
      expect(html).toContain("Reset Password");
      expect(html).toContain("Expiration notice");
    });

    it("renders preview mode cleanly", () => {
      const html = generateResetPasswordEmail({
        mode: "preview",
        email: "operator@tavryn.io",
      });
      expect(html).toContain("operator@tavryn.io");
      expect(html).not.toContain("{{ .Email }}");
    });
  });

  describe("Confirm Sign-Up Email", () => {
    it("generates confirm sign-up email with confirmation URL", () => {
      const html = generateConfirmSignupEmail({ mode: "gotrue" });
      expect(html).toContain("{{ .ConfirmationURL }}");
      expect(html).not.toContain("{{ .Token }}");
      expect(html).toContain("Welcome to Tavryn");
      expect(html).toContain("Confirm Account");
    });
  });

  describe("Workspace Invite Email", () => {
    it("generates team invite template with organization context", () => {
      const html = generateInviteUserEmail({
        mode: "preview",
        orgName: "Stripe Treasury Corp",
        inviterName: "Alice Baker",
        email: "invited@member.com",
      });
      expect(html).toContain("Stripe Treasury Corp");
      expect(html).toContain("Alice Baker");
      expect(html).toContain("invited@member.com");
      expect(html).toContain("Join your team on Tavryn");
    });
  });

  describe("renderAuthEmail Dispatcher", () => {
    it("dispatches all supported template types correctly", () => {
      const types: AuthEmailType[] = [
        "magic_link",
        "reset_password",
        "confirm_signup",
        "invite_user",
      ];
      for (const t of types) {
        const output = renderAuthEmail(t, { mode: "preview" });
        expect(output).toContain("Tavryn");
        expect(output).toContain("<!DOCTYPE html");
      }
    });
  });

  describe("Standalone Static Email Templates on Disk", () => {
    const templatesDir = path.join(process.cwd(), "emails", "auth");

    it("ensures magic-link.html exists and is valid GoTrue markup", () => {
      const file = path.join(templatesDir, "magic-link.html");
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, "utf8");
      expect(content).toContain("{{ .ConfirmationURL }}");
      expect(content).not.toContain("{{ .Token }}");
      expect(content).toContain("#107e65");
    });

    it("ensures reset-password.html exists and is valid GoTrue markup", () => {
      const file = path.join(templatesDir, "reset-password.html");
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, "utf8");
      expect(content).toContain("{{ .ConfirmationURL }}");
      expect(content).toContain("#107e65");
    });

    it("ensures confirm-signup.html exists and is valid GoTrue markup", () => {
      const file = path.join(templatesDir, "confirm-signup.html");
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, "utf8");
      expect(content).toContain("{{ .ConfirmationURL }}");
      expect(content).not.toContain("{{ .Token }}");
    });

    it("ensures invite-user.html exists and is valid GoTrue markup", () => {
      const file = path.join(templatesDir, "invite-user.html");
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, "utf8");
      expect(content).toContain("{{ .ConfirmationURL }}");
      expect(content).toContain("Join your team on Tavryn");
    });
  });
});

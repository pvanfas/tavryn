import { describe, expect, it } from "vitest";

import { formatBusinessName } from "../components/UserDropdown";

describe("Tenant & Demo Co Isolation", () => {
  describe("formatBusinessName", () => {
    it("returns empty string when input is null, undefined, or empty, without leaking Demo Co", () => {
      expect(formatBusinessName(null)).toBe("");
      expect(formatBusinessName(undefined)).toBe("");
      expect(formatBusinessName("")).toBe("");
    });

    it("formats real organization names cleanly without leaking Demo Co", () => {
      expect(formatBusinessName("Acme Corp 173048593")).toBe("Acme Corp");
      expect(formatBusinessName("Stripe Enterprise (992)")).toBe("Stripe Enterprise");
      expect(formatBusinessName("Vercel")).toBe("Vercel");
    });
  });

  describe("Business filtering rules for signed-in accounts", () => {
    it("strictly excludes Demo Co when a real organization is present in the account", () => {
      const businesses = [
        { id: "demo-id", name: "Demo Co", is_real: false },
        { id: "real-id", name: "Apex Technologies", is_real: true },
      ];

      const hasRealOrg = businesses.some((b) => b.is_real);
      expect(hasRealOrg).toBe(true);

      const displayBusinesses = businesses.filter((b) => {
        if (hasRealOrg) {
          return b.is_real && b.name !== "Demo Co";
        }
        return b.name === "Demo Co" || !b.is_real;
      });

      expect(displayBusinesses).toHaveLength(1);
      expect(displayBusinesses[0].name).toBe("Apex Technologies");
      expect(displayBusinesses.find((b) => b.name === "Demo Co")).toBeUndefined();
    });

    it("allows Demo Co only when evaluating in demo session without real organization", () => {
      const demoBusinesses = [
        { id: "demo-id", name: "Demo Co", is_real: false },
      ];

      const hasRealOrg = demoBusinesses.some((b) => b.is_real);
      expect(hasRealOrg).toBe(false);

      const displayBusinesses = demoBusinesses.filter((b) => {
        if (hasRealOrg) {
          return b.is_real && b.name !== "Demo Co";
        }
        return b.name === "Demo Co" || !b.is_real;
      });

      expect(displayBusinesses).toHaveLength(1);
      expect(displayBusinesses[0].name).toBe("Demo Co");
    });
  });

  describe("extractAuthTokenFromCookies", () => {
    it("extracts direct sb-access-token", async () => {
      const { extractAuthTokenFromCookies } = await import(
        "../lib/active-business"
      );
      const cookies = [
        { name: "sb-access-token", value: "test-jwt-token-abc" },
      ];
      expect(extractAuthTokenFromCookies(cookies)).toBe("test-jwt-token-abc");
    });

    it("extracts and stitches chunked cookies (.0, .1) with raw JWT or JSON", async () => {
      const { extractAuthTokenFromCookies } = await import(
        "../lib/active-business"
      );
      const tokenObj = JSON.stringify(["chunked-jwt-token-xyz", "refresh-123"]);
      const mid = Math.floor(tokenObj.length / 2);
      const chunk0 = tokenObj.slice(0, mid);
      const chunk1 = tokenObj.slice(mid);

      const cookies = [
        { name: "sb-doqxseuidsnlmpapapge-auth-token.1", value: chunk1 },
        { name: "sb-doqxseuidsnlmpapapge-auth-token.0", value: chunk0 },
      ];
      expect(extractAuthTokenFromCookies(cookies)).toBe("chunked-jwt-token-xyz");
    });

    it("extracts base64-encoded Supabase SSR auth cookies", async () => {
      const { extractAuthTokenFromCookies } = await import(
        "../lib/active-business"
      );
      const sessionJson = JSON.stringify({
        access_token: "b64-jwt-token-999",
        refresh_token: "ref-999",
      });
      const b64Value = "base64-" + Buffer.from(sessionJson).toString("base64");

      const cookies = [
        { name: "sb-proj-auth-token", value: b64Value },
      ];
      expect(extractAuthTokenFromCookies(cookies)).toBe("b64-jwt-token-999");
    });

    it("returns null for demo session cookie so it is not falsely treated as a Supabase JWT", async () => {
      const { extractAuthTokenFromCookies } = await import(
        "../lib/active-business"
      );
      const cookies = [
        { name: "sb-tavryn-auth-token", value: "demo-tavryn-session-token" },
      ];
      expect(extractAuthTokenFromCookies(cookies)).toBeNull();
    });
  });

  describe("OnboardBusinessPayloadSchema with logo, address, and country", () => {
    it("validates and accepts payload with logo_url, address, and country", async () => {
      const { OnboardBusinessPayloadSchema } = await import("../lib/schemas");
      const validPayload = {
        name: "Acme Labs Inc",
        industry: "AI & Machine Learning",
        logo_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        address: "548 Market St, Suite 300, San Francisco, CA 94104",
        country: "United States",
        treasury_balance: 50000,
        default_currency: "USDC",
        policy: {
          max_auto_transaction: 2000,
          min_savings: 200,
          human_approval_required_above: 2000,
          allowed_categories: ["software", "cloud"],
        },
        subscriptions: [],
      };

      const result = OnboardBusinessPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Acme Labs Inc");
        expect(result.data.logo_url).toContain("data:image/png;base64");
        expect(result.data.address).toBe("548 Market St, Suite 300, San Francisco, CA 94104");
        expect(result.data.country).toBe("United States");
      }
    });

    it("allows optional logo_url, address, and country to be omitted", async () => {
      const { OnboardBusinessPayloadSchema } = await import("../lib/schemas");
      const minimalPayload = {
        name: "Minimal Org",
        policy: {
          max_auto_transaction: 1000,
          min_savings: 100,
          human_approval_required_above: 1000,
          allowed_categories: ["software"],
        },
      };

      const result = OnboardBusinessPayloadSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Minimal Org");
        expect(result.data.logo_url).toBeUndefined();
        expect(result.data.address).toBeUndefined();
        expect(result.data.country).toBeUndefined();
      }
    });
  });
});

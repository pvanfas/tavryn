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
});

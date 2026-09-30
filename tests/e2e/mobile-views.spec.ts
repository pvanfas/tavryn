import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Mobile Viewport Auditing & Responsiveness Across All Core Pages", () => {
  const screenshotDir = path.resolve(
    process.cwd(),
    "public/screenshots/mobile",
  );

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  const routes = [
    { name: "landing", path: "/" },
    { name: "dashboard", path: "/dashboard" },
    { name: "contracts", path: "/contracts" },
    { name: "negotiations", path: "/negotiations" },
    { name: "activity", path: "/activity" },
    { name: "approvals", path: "/approvals" },
    { name: "audit", path: "/audit" },
    { name: "metrics", path: "/metrics" },
    { name: "settings", path: "/settings" },
    { name: "onboard", path: "/onboard" },
  ];

  for (const route of routes) {
    test(`Mobile audit: ${route.name} (${route.path}) renders without horizontal overflow`, async ({
      page,
      isMobile,
    }) => {
      // Authenticate session first
      await page.goto("/api/demo/session");
      await page.waitForURL(/\/(dashboard)?/);

      // Navigate to target route
      const response = await page.goto(route.path, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status()).toBe(200);

      // Wait for page to stabilize
      await page.waitForTimeout(600);

      // Verify no horizontal overflow on mobile
      if (isMobile) {
        const hasHorizontalScroll = await page.evaluate(() => {
          return (
            document.documentElement.scrollWidth > window.innerWidth + 2 ||
            document.body.scrollWidth > window.innerWidth + 2
          );
        });
        expect(
          hasHorizontalScroll,
          `Route ${route.path} should not have horizontal scrollbar on mobile`,
        ).toBe(false);

        // Capture screenshot
        await page.screenshot({
          path: path.join(screenshotDir, `${route.name}.png`),
          fullPage: false,
        });
      }
    });
  }

  test("Mobile interaction: Ask Tavryn command bar and Mobile Navigation Sheet", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile specific interaction test");

    await page.goto("/api/demo/session");
    await page.waitForURL(/\/(dashboard)?/);

    // 1. Open mobile Ask Tavryn button
    const mobileAskBtn = page.locator("#mobile-ask-tavryn-btn");
    await expect(mobileAskBtn).toBeVisible();
    await mobileAskBtn.click();

    // Verify modal appears
    const modalInput = page.locator("input[placeholder*='Ask Tavryn']");
    await expect(modalInput).toBeVisible();

    // Verify modal width fits nicely on screen
    const modalBox = await modalInput.boundingBox();
    expect(modalBox?.width).toBeGreaterThan(150);

    // Close modal
    const closeBtn = page.getByTitle("Close (Esc)");
    await closeBtn.click();
    await expect(modalInput).not.toBeVisible();

    // 2. Open Mobile Tab Bar 'More' sheet
    const moreTab = page.locator(
      "nav[aria-label='Mobile Bottom Navigation'] button",
      {
        hasText: /More/i,
      },
    );
    if (await moreTab.isVisible()) {
      await moreTab.click();
      await page.waitForTimeout(300);

      // Verify sheet menu links are visible
      const recordsHeader = page.getByText("Additional Workspaces & Records", {
        exact: false,
      });
      await expect(recordsHeader).toBeVisible();
    }
  });
});

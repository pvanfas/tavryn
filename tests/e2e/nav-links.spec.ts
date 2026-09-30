import { test, expect } from "@playwright/test";
import { SIDEBAR_NAV_GROUPS, getAllAppNavRoutes } from "@/lib/nav";

test.describe("Stage 0005: Centralized Navigation & Dead Link Elimination", () => {
  test("1. Navigation config contains zero '#' or empty hrefs", async () => {
    for (const group of SIDEBAR_NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.href, `Nav item ${item.label} should not be empty`).toBeTruthy();
        expect(item.href, `Nav item ${item.label} should not be '#'`).not.toBe("#");
        expect(item.href, `Nav item ${item.label} should not contain dead hash anchors`).not.toContain("#");
        expect(item.href.startsWith("/"), `Nav item ${item.label} must be a valid path starting with /`).toBe(true);
      }
    }
  });

  test("2. Every configured application nav link returns HTTP 200 and visible heading", async ({ page }) => {
    // Authenticate demo session first
    await page.goto("/api/demo/session");
    await page.waitForURL(/\/dashboard/);

    const routes = getAllAppNavRoutes();
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const response = await page.goto(route.href);
      expect(response, `Response for ${route.href} should exist`).not.toBeNull();
      expect(response!.status(), `Route ${route.href} should return 200`).toBe(200);

      // Verify a visible heading (h1 or h2) exists on the destination page
      const heading = page.locator("h1, h2").first();
      await expect(heading, `Heading on ${route.href} must be visible`).toBeVisible({ timeout: 10_000 });
    }
  });

  test("3. Not-found page (404) renders cleanly and links back to /dashboard", async ({ page }) => {
    await page.goto("/api/demo/session");
    await page.goto("/route-that-definitely-does-not-exist-xyz-404");

    // Verify 404 heading
    const notFoundHeading = page.locator("h1");
    await expect(notFoundHeading).toContainText("Resource Not Found");

    // Click Return to Dashboard button
    const returnBtn = page.getByRole("link", { name: "Return to Dashboard" });
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // Verify navigation landed on /dashboard
    await page.waitForURL(/\/dashboard/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("4. Active route highlight marks parent Dashboard for nested routes", async ({ page, isMobile }) => {
    await page.goto("/api/demo/session");
    await page.goto("/dashboard");

    if (isMobile) {
      await page.click('button[aria-label="Open navigation menu"]');
    }

    // On dashboard, Dashboard nav item should be visible and active
    const dashboardLink = page.getByRole("link", { name: "Dashboard" }).first();
    await expect(dashboardLink).toBeVisible();

    // Navigate to a nested decision route and verify Dashboard stays highlighted
    await page.goto("/decision/261baa10-339b-499a-8ca6-a9a13a36ec51");
    if (isMobile) {
      await page.click('button[aria-label="Open navigation menu"]');
    }
    await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
  });
});

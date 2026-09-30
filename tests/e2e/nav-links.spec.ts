import { expect, test } from "@playwright/test";

import {
  BOTTOM_NAV_ITEMS,
  getAllAppNavRoutes,
  WORKSPACE_NAV_SECTIONS,
} from "@/lib/nav";

test.describe("Stage 0005: Sidebar & Navigation Rebuild", () => {
  test("1. Navigation config contains zero '#' or empty hrefs", async () => {
    const allItems = [
      ...WORKSPACE_NAV_SECTIONS.flatMap((s) => s.items),
      ...BOTTOM_NAV_ITEMS,
    ];

    for (const item of allItems) {
      expect(
        item.href,
        `Nav item ${item.label} should not be empty`,
      ).toBeTruthy();
      expect(item.href, `Nav item ${item.label} should not be '#'`).not.toBe(
        "#",
      );
      expect(
        item.href,
        `Nav item ${item.label} should not contain dead hash anchors`,
      ).not.toContain("#");
      expect(
        item.href.startsWith("/"),
        `Nav item ${item.label} must be a valid path starting with /`,
      ).toBe(true);
    }
  });

  test("2. Every configured application nav link returns HTTP 200 and visible heading", async ({
    page,
    isMobile,
  }) => {
    // Authenticate demo session first
    await page.goto("/api/demo/session");
    await page.waitForURL(/\/(dashboard)?/);

    const routes = getAllAppNavRoutes();
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const response = await page.goto(route.href);
      expect(
        response,
        `Response for ${route.href} should exist`,
      ).not.toBeNull();
      expect(response!.status(), `Route ${route.href} should return 200`).toBe(
        200,
      );

      // Verify a visible heading (h1 or h2) exists on the destination page
      const heading = page.locator("h1, h2").first();
      await expect(
        heading,
        `Heading on ${route.href} must be visible`,
      ).toBeVisible({ timeout: 10_000 });

      // Verify active navigation item has aria-current="page"
      if (!isMobile) {
        const activeLink = page.locator(`aside nav a[href="${route.href}"]`);
        if ((await activeLink.count()) > 0) {
          await expect(activeLink.first()).toHaveAttribute(
            "aria-current",
            "page",
          );
        }
      } else {
        // On mobile, check tab bar or more sheet
        const mobileTab = page.locator(
          `nav[aria-label="Mobile Bottom Navigation"] a[href="${route.href}"]`,
        );
        if ((await mobileTab.count()) > 0) {
          await expect(mobileTab.first()).toHaveAttribute(
            "aria-current",
            "page",
          );
        }
      }
    }
  });

  test("3. Not-found page (404) renders cleanly and links back to Overview", async ({
    page,
  }) => {
    await page.goto("/api/demo/session");
    await page.goto("/route-that-definitely-does-not-exist-xyz-404");

    // Verify 404 heading
    const notFoundHeading = page.locator("h1");
    await expect(notFoundHeading).toContainText("Resource Not Found");

    // Click Return to Overview button
    const returnBtn = page.getByRole("link", { name: "Return to Overview" });
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // Verify navigation landed on Overview (/)
    await page.waitForURL(/\/(dashboard)?/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("4. Active route highlight marks parent Negotiations for nested routes", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/api/demo/session");

    // Navigate to a nested decision route
    await page.goto("/decision/261baa10-339b-499a-8ca6-a9a13a36ec51");
    await page.waitForLoadState("domcontentloaded");

    if (!isMobile) {
      // On desktop, the Negotiations sidebar item should have aria-current="page"
      const negotiationsLink = page.locator('aside a[href="/negotiations"]');
      await expect(negotiationsLink).toHaveAttribute("aria-current", "page");
    }

    // Navigate to a nested negotiation route
    await page.goto("/negotiate/261baa10-339b-499a-8ca6-a9a13a36ec51");
    await page.waitForLoadState("domcontentloaded");

    if (!isMobile) {
      const negotiationsLink = page.locator('aside a[href="/negotiations"]');
      await expect(negotiationsLink).toHaveAttribute("aria-current", "page");
    }
  });
});

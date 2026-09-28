import { test, expect } from "@playwright/test";

test.describe("Tavryn Autonomous Procurement Demo Walkthrough", () => {
  test("1. Landing page displays pitch, 3-step loop, metrics, and CTAs", async ({ page }) => {
    await page.goto("/");

    // 1. Verify exact one-line pitch
    const pitchHeading = page.locator("h1");
    await expect(pitchHeading).toContainText(
      "An agent that finds the waste, negotiates it away, and executes the financial decision"
    );

    // 2. Verify 3-step loop
    const step1 = page.locator("text=Detect Waste & Renewal Cliffs");
    const step2 = page.locator("text=Autonomous Multi-Round Negotiation");
    const step3 = page.locator("text=Policy Check & Arc Escrow Release");
    await expect(step1).toBeVisible();
    await expect(step2).toBeVisible();
    await expect(step3).toBeVisible();

    // 3. Verify Hero savings metrics
    await expect(page.locator("text=$28,800+")).toBeVisible();
    await expect(page.locator("text=28% Avg")).toBeVisible();

    // 4. Verify CTAs
    const tryDemoBtn = page.locator("#landing-try-demo-btn");
    const videoBtn = page.locator("#hero-video-cta");
    const githubBtn = page.locator("#hero-github-cta");

    await expect(tryDemoBtn).toBeVisible();
    await expect(videoBtn).toBeVisible();
    await expect(githubBtn).toBeVisible();
  });

  test("2. 'Try the demo' logs into Demo Co and loads dashboard", async ({ page }) => {
    await page.goto("/");

    // Click "Try the demo" button
    await page.click("#landing-try-demo-btn");

    // Must navigate to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Dashboard headers and Demo Co business context must be visible
    await expect(page.locator("main").getByText("Demo Co").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Autonomous Agent Timeline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contracts Ledger" })).toBeVisible();
  });

  test("3. 'Run full demo' resets Demo Co and executes 7-step loop in timeline", async ({ page }) => {
    // Navigate straight to dashboard via session route
    await page.goto("/api/demo/session");
    await page.waitForURL(/\/dashboard/);

    const runDemoBtn = page.locator("#run-full-demo-btn");
    await expect(runDemoBtn).toBeVisible();

    // Click Run full demo
    await runDemoBtn.click();

    // Wait for the full demo loop to conclude and the success notice to appear
    const successBanner = page.locator("text=Full loop executed:");
    await expect(successBanner).toBeVisible({ timeout: 30_000 });

    // Verify step badges in the activity timeline
    await expect(page.locator("text=Detect Renewal Waste")).toBeVisible();
    await expect(page.locator("text=Autonomous Negotiation")).toBeVisible();
    await expect(page.locator("text=Deterministic Policy Check")).toBeVisible();
    await expect(page.locator("text=Arc Escrow Creation")).toBeVisible();
    await expect(page.locator("text=Vendor Fulfillment Verification")).toBeVisible();
    await expect(page.locator("text=Escrow Fund Release")).toBeVisible();
    await expect(page.locator("text=Vendor Memory & Reputation")).toBeVisible();
  });

  test("4. Cryptographic audit page verifies zero chain breaks", async ({ page }) => {
    await page.goto("/api/demo/session");
    await page.goto("/audit");

    // Verify audit page loaded and chain verified
    await expect(page.locator("text=Cryptographic Audit Chain: 100% Verified")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=Sound")).toBeVisible();
    await expect(page.locator("text=Immutable Action Blocks")).toBeVisible();
  });
});

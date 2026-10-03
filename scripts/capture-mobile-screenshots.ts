import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

// Destination directories
const BASE_OUTPUT_DIR = path.resolve(process.cwd(), "public/screenshots");
const ARTIFACT_BASE_DIR = path.resolve(
  "/Users/chris/.gemini/antigravity-ide/brain/192429dd-d2cc-4d10-baf4-8d071cc1716b/screenshots",
);

interface RouteConfig {
  name: string;
  path: string;
  title: string;
  action?: (page: any, isDesktop: boolean) => Promise<void>;
  waitForSelector?: string;
  delayMs?: number;
}

const routes: RouteConfig[] = [
  {
    name: "01_landing_page",
    path: "/",
    title: "Landing Page (Full Marketing & Product Overview)",
    delayMs: 1200,
  },
  {
    name: "02_dashboard",
    path: "/dashboard",
    title: "Executive Dashboard, Spend Telemetry & Treasury",
    delayMs: 1200,
  },
  {
    name: "03_contracts",
    path: "/contracts",
    title: "Contracts & Vendor Repository",
    delayMs: 1200,
  },
  {
    name: "04_negotiations",
    path: "/negotiations",
    title: "Autonomous Negotiations Pipeline",
    delayMs: 1200,
  },
  {
    name: "05_negotiation_detail",
    path: "/negotiate/37448d59-445c-4e43-bc7e-aad1215986bd",
    title: "Negotiation Detail (Datadog AI Loop & Concession Curve)",
    delayMs: 1500,
  },
  {
    name: "06_decision_review",
    path: "/decision/37448d59-445c-4e43-bc7e-aad1215986bd",
    title: "Decision Review, Reasoning Timeline & Reviewer Audit",
    delayMs: 1500,
  },
  {
    name: "07_activity",
    path: "/activity",
    title: "Real-Time Agent Activity & Telemetry Feed",
    delayMs: 1200,
  },
  {
    name: "08_approvals",
    path: "/approvals",
    title: "Supervisor Approvals & Escalation Queue",
    delayMs: 1200,
  },
  {
    name: "09_approve_token",
    path: "/approve/demo",
    title: "Out-of-Band 1-Tap Cryptographic HMAC Approval",
    delayMs: 1500,
  },
  {
    name: "10_audit_trail",
    path: "/audit",
    title: "Immutable SHA-256 Audit Trail & Tamper Verification",
    delayMs: 1200,
  },
  {
    name: "11_metrics",
    path: "/metrics",
    title: "Financial Metrics & Real Arc Testnet Settlements",
    delayMs: 1500,
  },
  {
    name: "12_settings",
    path: "/settings",
    title: "Enterprise Governance, Policy Ceilings & Circle Wallet",
    delayMs: 1200,
  },
  {
    name: "13_onboarding",
    path: "/onboard",
    title: "Self-Service Business & Policy Onboarding",
    delayMs: 1200,
  },
  {
    name: "14_digest_preview",
    path: "/digest/preview",
    title: "Weekly Executive Digest Email Preview",
    delayMs: 1500,
  },
  {
    name: "15_receipt_onchain",
    path: "/r/5e00674ab8e2b86cdfedb78214f38672",
    title: "Public Proof of Savings (Live Arc Testnet On-Chain)",
    delayMs: 1200,
  },
  {
    name: "16_receipt_simulated",
    path: "/r/5af64a561a009ece45b8895f7a44ebdf",
    title: "Public Proof of Savings (Simulated Mock Escrow)",
    delayMs: 1200,
  },
  {
    name: "17_verify_labeling",
    path: "/verify-labeling",
    title: "Honest Transaction Labeling: Side-by-Side Proof",
    delayMs: 1200,
  },
  {
    name: "18_auth_login",
    path: "/auth/login",
    title: "Supervisor Sign-In Portal",
    delayMs: 1000,
  },
  {
    name: "19_auth_register",
    path: "/auth/register",
    title: "Enterprise Organization Registration",
    delayMs: 1000,
  },
  {
    name: "20_auth_forgot_password",
    path: "/auth/forgot-password",
    title: "Password Recovery Request",
    delayMs: 1000,
  },
  {
    name: "21_auth_reset_password",
    path: "/auth/reset-password",
    title: "Password Reset Confirmation",
    delayMs: 1000,
  },
  {
    name: "22_auth_change_password",
    path: "/auth/change-password",
    title: "Authenticated Supervisor Password Management",
    delayMs: 1000,
  },
  {
    name: "23_auth_callback",
    path: "/auth/callback?error_description=Sample+OAuth+Session+State",
    title: "OAuth Callback Handler & Security Sync",
    delayMs: 1000,
  },
  {
    name: "24_not_found",
    path: "/not-found-demo-404",
    title: "Custom 404 Not Found Page",
    delayMs: 1000,
  },
  {
    name: "25_command_bar_modal",
    path: "/dashboard",
    title: "Ask Tavryn AI Command Bar Modal",
    delayMs: 800,
    action: async (page, isDesktop) => {
      if (isDesktop) {
        const desktopBtn = page.locator("#header-ask-tavryn-btn");
        if (await desktopBtn.isVisible()) {
          await desktopBtn.click();
          await page.waitForTimeout(600);
        } else {
          await page.keyboard.press("Meta+k");
          await page.waitForTimeout(600);
        }
      } else {
        const askBtn = page.locator("#mobile-ask-tavryn-btn");
        if (await askBtn.isVisible()) {
          await askBtn.click();
          await page.waitForTimeout(600);
        }
      }
    },
  },
];

interface MatrixTarget {
  platform: "desktop" | "mobile";
  theme: "light" | "dark";
  viewport: { width: number; height: number };
  isMobile: boolean;
  hasTouch: boolean;
  deviceScaleFactor: number;
}

const matrices: MatrixTarget[] = [
  {
    platform: "desktop",
    theme: "light",
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 2,
  },
  {
    platform: "desktop",
    theme: "dark",
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 2,
  },
  {
    platform: "mobile",
    theme: "light",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  {
    platform: "mobile",
    theme: "dark",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
];

async function captureMatrix(browser: any, matrix: MatrixTarget, urlObj: URL) {
  const dirName = `${matrix.platform}/${matrix.theme}`;
  const outDir = path.join(BASE_OUTPUT_DIR, dirName);
  const artifactDir = path.join(ARTIFACT_BASE_DIR, dirName);

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  if (matrix.platform === "mobile" && matrix.theme === "light") {
    fs.mkdirSync(path.join(BASE_OUTPUT_DIR, "mobile"), { recursive: true });
  }

  console.log(`\n======================================================`);
  console.log(
    `📸 Running Matrix: ${matrix.platform.toUpperCase()} [${matrix.theme.toUpperCase()}]`,
  );
  console.log(
    `   Viewport: ${matrix.viewport.width}x${matrix.viewport.height} | Dir: ${dirName}`,
  );
  console.log(`======================================================`);

  const context = await browser.newContext({
    viewport: matrix.viewport,
    isMobile: matrix.isMobile,
    hasTouch: matrix.hasTouch,
    deviceScaleFactor: matrix.deviceScaleFactor,
    colorScheme: matrix.theme,
  });

  // Inject theme preference into localStorage and html class
  await context.addInitScript((currentTheme: string) => {
    try {
      localStorage.setItem("tavryn-theme", currentTheme);
      if (currentTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {}
  }, matrix.theme);

  // Set demo authorization cookie on context
  await context.addCookies([
    {
      name: "sb-tavryn-auth-token",
      value: "demo-tavryn-session-token",
      domain: urlObj.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  // Initialize demo session
  try {
    await page.goto(`${BASE_URL}/api/demo/session`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.waitForTimeout(500);
  } catch (err) {
    console.warn("Session init warning:", (err as Error).message);
  }

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const targetUrl = `${BASE_URL}${route.path}`;
    const filename = `${route.name}.png`;
    const outputPath = path.join(outDir, filename);
    const artifactPath = path.join(artifactDir, filename);

    console.log(`  [${i + 1}/${routes.length}] ${route.name} ...`);

    try {
      if (route.name === "01_landing_page") {
        await context.clearCookies();
      } else {
        await context.addCookies([
          {
            name: "sb-tavryn-auth-token",
            value: "demo-tavryn-session-token",
            domain: urlObj.hostname,
            path: "/",
            httpOnly: false,
            secure: false,
            sameSite: "Lax",
          },
        ]);
      }

      await page
        .goto(targetUrl, {
          waitUntil: "networkidle",
          timeout: 25000,
        })
        .catch(async () => {
          await page.goto(targetUrl, {
            waitUntil: "load",
            timeout: 15000,
          });
        });

      if (route.waitForSelector) {
        await page
          .waitForSelector(route.waitForSelector, { timeout: 5000 })
          .catch(() => {});
      }

      // Hide mobile navbar on mobile, dev portal badges, etc.
      await page.addStyleTag({
        content: `
          ${
            matrix.isMobile
              ? `
          nav[aria-label="Mobile Bottom Navigation"],
          nav[aria-label="Mobile Bottom Navigation"] *,
          .mobile-tab-bar,
          [data-mobile-navbar] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          main {
            padding-bottom: 2rem !important;
          }
          `
              : ""
          }
          nextjs-portal,
          [data-nextjs-toast],
          [data-nextjs-dev-overlay-portal],
          #__next-build-watcher {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `,
      });

      // Enforce theme classes
      await page.evaluate((themeMode: string) => {
        try {
          localStorage.setItem("tavryn-theme", themeMode);
          if (themeMode === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }

          // Remove Next.js dev portals
          const portals = document.querySelectorAll(
            "nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-overlay-portal], #__next-build-watcher",
          );
          portals.forEach((p) => p.remove());
        } catch {}
      }, matrix.theme);

      if (route.action) {
        await route.action(page, !matrix.isMobile);
      }

      await page.waitForTimeout(route.delayMs || 600);

      // Re-apply theme classes right before screenshot
      await page.evaluate((themeMode: string) => {
        try {
          if (themeMode === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        } catch {}
      }, matrix.theme);

      // Capture fullPage
      await page.screenshot({
        path: outputPath,
        fullPage: true,
      });

      // Copy to artifact directory
      try {
        fs.copyFileSync(outputPath, artifactPath);
      } catch {}

      // Backward-compatible copy for mobile light
      if (matrix.platform === "mobile" && matrix.theme === "light") {
        try {
          fs.copyFileSync(
            outputPath,
            path.join(BASE_OUTPUT_DIR, "mobile", filename),
          );
        } catch {}
      }

      const stats = fs.statSync(outputPath);
      const sizeKb = Math.round(stats.size / 1024);
      console.log(`    ✓ Saved (${sizeKb} KB)`);
    } catch (err) {
      console.error(`    ✗ Error on ${route.name}:`, (err as Error).message);
    }
  }

  await context.close();
}

async function main() {
  console.log(
    "📸 Starting Full Application Multi-Viewport & Multi-Theme Screenshot Engine",
  );
  console.log(`Target URL: ${BASE_URL}`);

  const urlObj = new URL(BASE_URL);
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    for (const matrix of matrices) {
      await captureMatrix(browser, matrix, urlObj);
    }
  } finally {
    await browser.close();
  }

  console.log("\n🎉 ALL SCREENSHOT MATRICES COMPLETED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

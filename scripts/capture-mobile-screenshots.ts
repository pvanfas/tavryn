import { chromium, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";
const OUTPUT_DIR = path.resolve(process.cwd(), "public/screenshots/mobile");
const ARTIFACT_DIR = path.resolve(
  "/Users/chris/.gemini/antigravity-ide/brain/016d287b-974c-4a79-a9d6-c9bd6bdf5e3a/screenshots",
);
const ROOT_ARTIFACT_DIR = path.resolve(
  "/Users/chris/.gemini/antigravity-ide/brain/016d287b-974c-4a79-a9d6-c9bd6bdf5e3a",
);

interface RouteConfig {
  name: string;
  path: string;
  title: string;
  action?: (page: any) => Promise<void>;
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
    title: "Executive Dashboard & Spend Telemetry",
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
    title: "Decision Review & Dual-Agent Reviewer Audit",
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
    title: "Financial Metrics & ROI Analytics",
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
    title: "Mobile Ask Tavryn AI Command Bar Modal",
    delayMs: 800,
    action: async (page) => {
      const askBtn = page.locator("#mobile-ask-tavryn-btn");
      if (await askBtn.isVisible()) {
        await askBtn.click();
        await page.waitForTimeout(600);
      }
    },
  },
  {
    name: "26_mobile_nav_sheet",
    path: "/dashboard",
    title: "Mobile Bottom Navigation 'More' Drawer Menu",
    delayMs: 800,
    action: async (page) => {
      const moreBtn = page.locator(
        "nav[aria-label='Mobile Bottom Navigation'] button",
        {
          hasText: /More/i,
        },
      );
      if (await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.waitForTimeout(600);
      }
    },
  },
];

async function main() {
  console.log("📸 Starting Mobile Screenshot Capture Suite...");
  console.log(`Target URL: ${BASE_URL}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const pixel7 = devices["Pixel 7"];
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    ...pixel7,
    colorScheme: "light",
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });

  // Inject light mode preference into localStorage for every navigation
  await context.addInitScript(() => {
    try {
      localStorage.setItem("tavryn-theme", "light");
      document.documentElement.classList.remove("dark");
    } catch {}
  });

  // Set demo authorization cookie on the context
  const urlObj = new URL(BASE_URL);
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

  // Initialize session by visiting /api/demo/session
  console.log("--> Initializing demo session...");
  try {
    await page.goto(`${BASE_URL}/api/demo/session`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(1000);
  } catch (err) {
    console.warn("Session init warning:", err);
  }

  const results: Array<{
    name: string;
    path: string;
    title: string;
    filePath: string;
    artifactPath: string;
    sizeKb: number;
    status: "ok" | "error";
    error?: string;
  }> = [];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const targetUrl = `${BASE_URL}${route.path}`;
    const filename = `${route.name}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);

    console.log(
      `[${i + 1}/${routes.length}] Capturing ${route.name} (${route.path})...`,
    );

    try {
      if (route.name === "01_landing_page") {
        await context.clearCookies();
      } else {
        // Ensure auth cookie is present for protected routes
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

      await page.goto(targetUrl, {
        waitUntil: "networkidle",
        timeout: 30000,
      }).catch(async () => {
        // Fallback to load event if networkidle times out
        await page.goto(targetUrl, {
          waitUntil: "load",
          timeout: 20000,
        });
      });

      if (route.waitForSelector) {
        await page.waitForSelector(route.waitForSelector, { timeout: 8000 }).catch(() => {});
      }

      if (route.action) {
        await route.action(page);
      }

      // Ensure dark class is removed and light mode theme is active
      await page.evaluate(() => {
        try {
          localStorage.setItem("tavryn-theme", "light");
          document.documentElement.classList.remove("dark");
        } catch {}
      });

      await page.waitForTimeout(route.delayMs || 1000);

      // Capture full-page screenshot from top to bottom
      await page.screenshot({
        path: outputPath,
        fullPage: true,
      });

      // Copy to artifact directories
      fs.copyFileSync(outputPath, artifactPath);
      fs.copyFileSync(outputPath, path.join(ROOT_ARTIFACT_DIR, filename));

      const stats = fs.statSync(outputPath);
      const sizeKb = Math.round(stats.size / 1024);

      console.log(`  ✓ Saved: ${filename} (${sizeKb} KB)`);
      results.push({
        name: route.name,
        path: route.path,
        title: route.title,
        filePath: outputPath,
        artifactPath,
        sizeKb,
        status: "ok",
      });
    } catch (err) {
      console.error(`  ✗ Failed ${route.name}:`, (err as Error).message);
      results.push({
        name: route.name,
        path: route.path,
        title: route.title,
        filePath: outputPath,
        artifactPath,
        sizeKb: 0,
        status: "error",
        error: (err as Error).message,
      });
    }
  }

  await browser.close();

  console.log("\n=================================");
  console.log("📸 Screenshot Capture Summary:");
  console.log(`Total Routes: ${routes.length}`);
  console.log(`Success: ${results.filter((r) => r.status === "ok").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "error").length}`);
  console.log(`Output Directory: ${OUTPUT_DIR}`);
  console.log(`Artifact Directory: ${ARTIFACT_DIR}`);
  console.log("=================================\n");
}

main().catch((err) => {
  console.error("Fatal capture error:", err);
  process.exit(1);
});

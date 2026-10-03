import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { POST as decisionApprovePost } from "../app/api/decision/[contractId]/approve/route";
import { POST as decisionDirectPost } from "../app/api/decision/[contractId]/route";
import { getTractionMetrics } from "../lib/metrics";

describe("Landing Page Metrics & Approvals Endpoint", () => {
  test("1. app/page.tsx exports revalidate = 0 and dynamic = 'force-dynamic'", async () => {
    const pageContent = fs.readFileSync(
      path.join(process.cwd(), "app/page.tsx"),
      "utf8",
    );
    assert.ok(
      pageContent.includes('export const dynamic = "force-dynamic";'),
      "Must export dynamic = force-dynamic",
    );
    assert.ok(
      pageContent.includes("export const revalidate = 0;"),
      "Must export revalidate = 0",
    );
    assert.ok(
      pageContent.includes("getTractionMetrics({ realOnly: false })"),
      "Must fetch all metrics",
    );
    assert.ok(
      pageContent.includes("getTractionMetrics({ realOnly: true })"),
      "Must fetch real metrics",
    );
  });

  test("2. /api/decision/[contractId]/approve exports POST identical to /api/decision/[contractId]", async () => {
    assert.equal(
      typeof decisionApprovePost,
      "function",
      "/api/decision/[contractId]/approve must export POST function",
    );
    assert.equal(
      decisionApprovePost,
      decisionDirectPost,
      "approve POST must re-export parent decision POST handler",
    );
  });

  test("3. components/ui/text.tsx H1 and H2 include responsive font sizes for mobile", async () => {
    const textContent = fs.readFileSync(
      path.join(process.cwd(), "components/ui/text.tsx"),
      "utf8",
    );
    assert.ok(
      textContent.includes("text-xl sm:text-2xl md:text-h1"),
      "H1 must include responsive text classes for smaller screens",
    );
    assert.ok(
      textContent.includes("text-base sm:text-h2"),
      "H2 must scale to text-base on mobile screens",
    );
  });

  test("4. getTractionMetrics provides numbers matching landing page card mapping", async () => {
    const [metricsAll, metricsReal] = await Promise.all([
      getTractionMetrics({ realOnly: false }),
      getTractionMetrics({ realOnly: true }),
    ]);

    // Card 1: Waste / Savings Identified
    const realSavings =
      metricsReal.savings.realized > 0
        ? metricsReal.savings.realized
        : metricsReal.savings.negotiated;
    assert.ok(
      realSavings > 0,
      "Real savings should be > 0 for verified badge display",
    );

    // Card 2: Negotiation Yield (aggregated demo yield if real is negligible)
    assert.ok(metricsAll.savings.savingsRatePct > 0);

    // Card 3: Deterministic Policy
    assert.ok(metricsReal.governance.agentDecisionsCount > 0);

    // Card 4: Arc Escrow
    assert.ok(metricsReal.usdcVolume.escrowed > 0);
  });

  test("5. Mobile checklist badges and design system define 11px font sizes cleanly", async () => {
    const checklistContent = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/decision/[contractId]/components/PolicyChecklistSection.tsx",
      ),
      "utf8",
    );
    assert.ok(
      checklistContent.includes("text-[11px] font-semibold leading-none"),
      "Policy checklist mobile badges must use text-[11px] font-semibold leading-none",
    );
    assert.ok(
      !checklistContent.includes("text-2xs"),
      "Policy checklist must not use naked text-2xs without explicit utility",
    );

    const globalsCss = fs.readFileSync(
      path.join(process.cwd(), "app/globals.css"),
      "utf8",
    );
    assert.ok(
      globalsCss.includes("--text-2xs: 0.6875rem;"),
      "globals.css must define --text-2xs at 11px (0.6875rem) in @theme",
    );
  });
});


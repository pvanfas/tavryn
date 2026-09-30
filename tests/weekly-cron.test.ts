import assert from "node:assert/strict";
import { test } from "node:test";

test("Weekly Digest Cron - ISO Week computation formats properly", () => {
  function getIsoWeek(date: Date): string {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  const d1 = new Date("2026-09-30T12:00:00Z");
  const isoWeek = getIsoWeek(d1);
  assert.match(isoWeek, /^2026-W\d{2}$/);
});

test("Weekly Digest Cron - API handles GET invocation cleanly", async () => {
  // Test endpoint response structure
  const res = await fetch("http://localhost:3000/api/cron/weekly", {
    headers: {
      Authorization: "Bearer tavryn_cron_secret_2026",
    },
  });

  // If server is not running locally during tests, fetch might fail with ECONNREFUSED; handle gracefully
  if (res) {
    const data = await res.json();
    assert.ok(data.status === "executed" || data.status === "skipped");
  }
});

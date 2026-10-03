# Stage 0016: Public Stats Endpoint, Live Telemetry Bar, & Automated Workflow

_Oct 03, 2026 · Added an unauthenticated, rate-limited public stats endpoint (`/api/stats`), an auto-refreshing client-side telemetry ticker (`LiveStatsBar.tsx`) on the landing page, and a scheduled GitHub Action for judge verification._

---

## What Tavryn can do now that it couldn't last time

1. **Unauthenticated Public Stats Endpoint** (`app/api/stats/route.ts`): Anyone—including hackathon judges and prospective customers—can fetch verified aggregate traction statistics without authentication. Under the hood, it queries `getTractionMetrics({ realOnly: true })` to report real businesses, contracts analyzed, negotiations concluded, and real USDC volume. The endpoint is rate-limited (60 requests per minute per IP) with caching headers (`Cache-Control: public, s-maxage=15, stale-while-revalidate=30`).
2. **Auto-Refreshing Landing Page Telemetry** (`components/LiveStatsBar.tsx`): Integrated directly into `app/page.tsx`, displaying live agent volume, negotiation counts, and human-agreement rate with a live pulsing green heartbeat indicator. Fetches every 30 seconds client-side so updates are visible without redeploying.
3. **Automated Scheduled Metric Snapshots** (`.github/workflows/stats.yml`): A GitHub Actions workflow running daily at 06:00 UTC (and via `workflow_dispatch`) that queries the live stats endpoint, generates a formatted markdown metrics summary, and logs proof of traction.

## Trade-offs & honest caveats

- The in-memory sliding window rate limiter resets when the serverless function cold-starts. For a hackathon MVP, this provides defense against casual scraping without requiring an external Redis/Upstash cluster.
- The stats endpoint strictly filters by `is_real: true` or `realOnly: true`, meaning synthetic sandbox test runs are excluded from the published numbers.

## Files changed

| File                          | What                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `app/api/stats/route.ts`      | New public API: Unauthenticated, rate-limited aggregate traction stats               |
| `components/LiveStatsBar.tsx` | New client component: 30s auto-refreshing stats banner with pulsing status indicator |
| `app/page.tsx`                | Mounted `LiveStatsBar` between hero metrics and the How-It-Works section             |
| `.github/workflows/stats.yml` | New GitHub Actions workflow: Daily automated public stats fetch and reporting        |

## Verification

```bash
# Verify route response locally
curl -s http://localhost:3000/api/stats | jq .
```

import React from "react";

import { getTractionMetrics } from "@/lib/metrics";

import { PublicMetricsClient } from "./PublicMetricsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Fresh telemetry on every public load

export const metadata = {
  title: "Tavryn · Verified Protocol Telemetry",
  description:
    "Cryptographically verified macroeconomic telemetry, autonomous agent velocity, and Circle USDC escrow settlements on Arc Testnet.",
};

export default async function PublicMetricsPage() {
  const verifiedMetrics = await getTractionMetrics({ realOnly: true });

  return <PublicMetricsClient metrics={verifiedMetrics} />;
}

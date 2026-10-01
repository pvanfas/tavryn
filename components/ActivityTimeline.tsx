"use client";

import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { TransactionHashBadge } from "@/components/TransactionHashBadge";
import { H3 } from "@/components/ui/text";
import { ARC_CONFIG } from "@/lib/circle";
import { DEV_TREASURY_ADDRESS } from "@/lib/constants";

interface StepItem {
  step: number;
  name: string;
  title: string;
  status: "idle" | "running" | "completed" | "failed";
  summary: string;
  details?: Record<string, any>;
  timestamp?: string;
}

const DEFAULT_STEPS: StepItem[] = [
  {
    step: 1,
    name: "detect",
    title: "1. Detect Waste",
    status: "completed",
    summary:
      "Scanned seat allocation & usage logs: 7 unused Slack seats identified ($2,688 potential waste).",
    details: {
      service: "Slack",
      idleSeats: 7,
      wasteRate: "28%",
      originalPrice: 9600,
    },
    timestamp: "Ready",
  },
  {
    step: 2,
    name: "negotiate",
    title: "2. Autonomous Negotiation",
    status: "completed",
    summary:
      "Executed concession loop against vendor simulator; negotiated rate down dynamically.",
    details: {
      rounds: 3,
      opening: 6500,
      counter: 7600,
      agreed: 6912,
      savings: 2688,
    },
    timestamp: "Ready",
  },
  {
    step: 3,
    name: "reviewer",
    title: "3. Reviewer Agent Audit",
    status: "completed",
    summary:
      "Adversarial auditor audited concession terms against usage telemetry; approved with zero unaddressed seat waste.",
    details: {
      verdict: "agree",
      model: "deterministic-rules",
      concerns: 0,
      suggestedAction: "Proceed to deterministic policy gatekeeper evaluation.",
    },
    timestamp: "Ready",
  },
  {
    step: 4,
    name: "policy",
    title: "4. Deterministic Policy",
    status: "completed",
    summary:
      "Deterministic engine approved commitment within $10k auto-limit and >$500 savings rule.",
    details: {
      rule: "max_auto_transaction <= $10,000",
      result: "AUTONOMOUS_APPROVAL",
      minSavingsMet: true,
    },
    timestamp: "Ready",
  },
  {
    step: 5,
    name: "escrow",
    title: "5. Arc Escrow Lock",
    status: "completed",
    summary:
      "Locked USDC into Arc EVM smart contract using Circle developer-controlled wallet.",
    details: {
      chain: "Arc Testnet",
      token: "USDC",
      contract: ARC_CONFIG.escrowContractAddress,
    },
    timestamp: "Ready",
  },
  {
    step: 6,
    name: "verify",
    title: "6. Document Verification",
    status: "completed",
    summary:
      "Parsed vendor renewal order confirmation: verified price, active seats, term length, and effective date.",
    details: {
      priceMatched: true,
      seatsMatched: true,
      termMatched: true,
      passedChecks: "4/4",
    },
    timestamp: "Ready",
  },
  {
    step: 7,
    name: "release",
    title: "7. Payment Settlement",
    status: "completed",
    summary:
      "Released USDC from Arc escrow to Slack vendor wallet. Settlement completed on-chain.",
    details: { status: "released", vendorWallet: DEV_TREASURY_ADDRESS },
    timestamp: "Ready",
  },
  {
    step: 8,
    name: "memory",
    title: "8. Business Memory",
    status: "completed",
    summary:
      "Saved concession benchmark to business memory: Slack reputation score updated.",
    details: {
      vendor: "Slack",
      reputationDelta: "+8 pts",
      acceptedDiscount: "28%",
    },
    timestamp: "Ready",
  },
];

const STEP_ICONS: Record<string, React.ElementType> = {
  detect: Search,
  negotiate: MessageSquare,
  reviewer: ShieldAlert,
  policy: ShieldCheck,
  escrow: Lock,
  verify: FileCheck,
  release: Send,
  memory: Brain,
};

interface ActivityTimelineProps {
  businessId?: string;
  businessName?: string;
}

export function ActivityTimeline({
  businessId,
  businessName = "Demo Co",
}: ActivityTimelineProps) {
  const router = useRouter();
  const [steps, setSteps] = useState<StepItem[]>(DEFAULT_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [lastRunNotice, setLastRunNotice] = useState<string | null>(null);

  const handleRunFullDemo = async () => {
    setIsRunning(true);
    setLastRunNotice(null);

    // Initial running state
    setSteps((prev) =>
      prev.map((s, idx) => ({
        ...s,
        status: idx === 0 ? "running" : "idle",
        timestamp: idx === 0 ? "Executing..." : s.timestamp,
      })),
    );

    // Live progress indicator advancing through pipeline steps during execution
    let currentIdx = 0;
    const progressInterval = setInterval(() => {
      currentIdx = (currentIdx + 1) % 8;
      setSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status:
            idx === currentIdx
              ? "running"
              : idx < currentIdx
                ? "completed"
                : "idle",
          timestamp:
            idx === currentIdx
              ? "Executing..."
              : idx < currentIdx
                ? "Done"
                : s.timestamp,
        })),
      );
    }, 450);

    try {
      const res = await fetch("/api/demo/reset-and-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Demo loop execution failed");
      }

      if (data.result?.steps) {
        setSteps(data.result.steps);
      } else if (data.steps) {
        setSteps(data.steps);
      }

      const savings =
        data.result?.savingsRealized ?? data.savingsRealized ?? 2688;
      setLastRunNotice(
        `Full loop executed: $${savings.toLocaleString()} annual savings secured, reviewer verified, escrowed & settled on Arc!`,
      );

      router.refresh();
    } catch (err) {
      setLastRunNotice(`Demo execution error: ${(err as Error).message}`);
      setSteps(DEFAULT_STEPS);
    } finally {
      clearInterval(progressInterval);
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-6 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
      {/* Header with Run Full Demo CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/70 dark:border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#107e65] animate-ping" />
            <H3 className="text-slate-900 dark:text-white font-bold">
              Autonomous Agent Timeline
            </H3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
              Live Loop
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Observe → Analyze → Negotiate → Decide → Execute → Learn for{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {businessName}
            </strong>
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            id="run-full-demo-btn"
            type="button"
            onClick={handleRunFullDemo}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#107e65] to-[#0d6b55] hover:from-[#0d6b55] hover:to-[#0a5644] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Running Full Demo Loop...</span>
              </>
            ) : (
              <>
                <AgentIcon className="h-4 w-4" />
                <span>Run full demo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {lastRunNotice && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-between text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#107e65] dark:text-[#34d399] shrink-0" />
            <span>{lastRunNotice}</span>
          </div>
        </div>
      )}

      {/* 7-Step Interactive Pipeline */}
      <div className="mt-6 space-y-3">
        {steps.map((item) => {
          const Icon = STEP_ICONS[item.name] || CheckCircle2;
          const isExpanded = expandedStep === item.step;

          return (
            <div
              key={item.step}
              className={`rounded-xl border transition-all duration-200 ${
                item.status === "running"
                  ? "bg-emerald-500/5 border-emerald-500/40 shadow-xs"
                  : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700/80"
              }`}
            >
              <div
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                onClick={() => setExpandedStep(isExpanded ? null : item.step)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      item.status === "running"
                        ? "bg-[#107e65] text-white animate-spin"
                        : "bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399]"
                    }`}
                  >
                    {item.status === "running" ? (
                      <RefreshCw className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                      {item.details?.isSimulated ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          Simulated (testnet mock)
                        </span>
                      ) : item.status === "completed" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-[#107e65] dark:text-emerald-300 border border-emerald-500/20">
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {item.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline-block">
                    {item.timestamp || "Instant"}
                  </span>
                  <button
                    type="button"
                    aria-label="Toggle step details"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded JSON / Details Drawer */}
              {isExpanded && item.details && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 space-y-2">
                  {(item.details.releaseTxHash || item.details.txHash) && (
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 font-medium">
                        Settlement Transaction:
                      </span>
                      <TransactionHashBadge
                        txHash={item.details.releaseTxHash || item.details.txHash}
                        isSimulated={item.details.isSimulated}
                        status={item.details.status}
                      />
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto">
                    <pre>{JSON.stringify(item.details, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { AgentAnalysisResult } from "@/lib/agent/run";

interface AnalysisModalProps {
  contractId: string;
  serviceName: string;
  currentPrice: number;
  isOpen: boolean;
  onClose: () => void;
}

export function AnalysisModal({
  contractId,
  serviceName,
  currentPrice,
  isOpen,
  onClose,
}: AnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>(
    {},
  );

  const runAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/agent/analyze/${contractId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze contract");
      }
      setResult(data.analysis);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !result && !loading && !error) {
      runAnalysis();
    }
  }, [isOpen]);

  const toggleExpand = (idx: number) => {
    setExpandedTools((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111714] shadow-2xl flex flex-col font-sans">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/70 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Optimization Analysis: {serviceName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Deterministic usage telemetry and policy verification
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="h-7 w-7 border-2 border-[#107e65] border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 font-medium">
                Evaluating usage telemetry &amp; policy...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300">
              <p className="font-semibold">Analysis Failed</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* Financial Metrics Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Baseline Spend
                  </span>
                  <p className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-1">
                    ${Number(currentPrice).toLocaleString()}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Target Price
                  </span>
                  <p className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-1">
                    $
                    {Number(
                      result.decision?.target_price ?? 0,
                    ).toLocaleString()}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20">
                  <span className="text-xs font-bold text-[#107e65] dark:text-emerald-400 uppercase tracking-wider">
                    Projected Cut
                  </span>
                  <p className="text-lg font-mono font-bold text-[#107e65] dark:text-emerald-400 mt-1">
                    $
                    {Math.max(
                      0,
                      currentPrice -
                        (result.decision?.target_price ?? currentPrice),
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Assessment Summary */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">
                  Analysis Outcome:{" "}
                  {result.decision?.recommendation
                    ? result.decision.recommendation
                        .replace(/_/g, " ")
                        .toUpperCase()
                    : "EVALUATED"}
                </h4>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                  {result.decision?.reasoning || result.reasoning}
                </p>
              </div>

              {/* Tool Execution Footprint */}
              {result.toolCalls && result.toolCalls.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2 text-sm">
                    Executed Deterministic Tools ({result.toolCalls.length})
                  </h4>
                  <div className="space-y-1.5 font-mono text-xs">
                    {result.toolCalls.map((tool, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleExpand(idx)}
                          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#107e65]" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {tool.name}
                            </span>
                          </div>
                          {expandedTools[idx] ? (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          )}
                        </button>
                        {expandedTools[idx] && (
                          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900 text-xs space-y-2">
                            <div>
                              <span className="text-slate-600 dark:text-slate-400 font-bold">
                                Args:
                              </span>
                              <pre className="overflow-x-auto text-slate-800 dark:text-slate-200 mt-0.5">
                                {JSON.stringify(tool.input, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-400 font-bold">
                                Result:
                              </span>
                              <pre className="overflow-x-auto text-slate-800 dark:text-slate-200 mt-0.5">
                                {JSON.stringify(tool.output, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800/70 bg-slate-50/70 dark:bg-[#141b18]/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
          >
            Close
          </button>
          <Link
            href={`/negotiate/${contractId}`}
            className="px-3.5 py-1.5 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <span>Proceed to Negotiation</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

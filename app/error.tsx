"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled App Router error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f7f9f8] dark:bg-[#0b100e] text-slate-900 dark:text-slate-100 antialiased">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(239,68,68,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(239,68,68,0.12),transparent_70%)]"
      />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#121915] border border-rose-200 dark:border-rose-900/40 rounded-2xl p-8 shadow-xl text-center space-y-6">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center shadow-sm text-rose-600 dark:text-rose-400">
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
            Application Error
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed break-words">
            {error.message || "An unexpected error occurred during execution."}
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-600">
              Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <button
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="w-full inline-flex items-center justify-center h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>

      <footer className="relative z-10 mt-8 text-center text-xs text-slate-400 dark:text-slate-600 font-medium">
        © {new Date().getFullYear()} Tavryn · Arc &bull; Circle
      </footer>
    </div>
  );
}

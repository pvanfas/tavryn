import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f7f9f8] dark:bg-[#0b100e] text-slate-900 dark:text-slate-100 antialiased">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(16,126,101,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(16,126,101,0.15),transparent_70%)]"
      />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#121915] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 shadow-xl text-center space-y-6">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm overflow-hidden p-2">
          <Image src="/logo.png" alt="Tavryn" width={32} height={32} className="object-contain" priority />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            404 Error
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Resource Not Found
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            The contract, negotiation, or page you are looking for does not exist or has been relocated.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            Return to Dashboard
          </Link>
          <Link
            href="/onboard"
            className="w-full inline-flex items-center justify-center h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-colors"
          >
            Onboard New Subscriptions
          </Link>
        </div>
      </div>

      <footer className="relative z-10 mt-8 text-center text-xs text-slate-400 dark:text-slate-600 font-medium">
        © {new Date().getFullYear()} Tavryn · Arc &bull; Circle
      </footer>
    </div>
  );
}

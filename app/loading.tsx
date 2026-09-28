import React from "react";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-600 animate-spin" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 animate-pulse">
        Loading Tavryn...
      </p>
    </div>
  );
}

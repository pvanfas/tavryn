"use client";

import { Check, Copy } from "lucide-react";
import React, { useState } from "react";

export function CopyReceiptButton({ url }: { url?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const link = url || window.location.href;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-300 font-bold">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-slate-400" />
          <span>Copy link</span>
        </>
      )}
    </button>
  );
}

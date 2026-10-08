"use client";

import { Check, Copy } from "lucide-react";
import React, { useState } from "react";

export function CopyReceiptButton({ url }: { url?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const link = url || (typeof window !== "undefined" ? window.location.href : "");
    if (!link) return;

    let successful = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        successful = true;
      }
    } catch {
      // Fallback below
    }

    if (!successful && typeof document !== "undefined") {
      try {
        const el = document.createElement("textarea");
        el.value = link;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        el.style.top = "-9999px";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        successful = document.execCommand("copy");
        document.body.removeChild(el);
      } catch {
        successful = false;
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

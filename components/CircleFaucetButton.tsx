"use client";

import { Droplets, ExternalLink, Loader2 } from "lucide-react";
import React, { useState } from "react";

import { ARC_CONFIG } from "@/lib/circle/config";

interface CircleFaucetButtonProps {
  businessId?: string;
  walletAddress?: string | null;
  currentBalance?: number;
  className?: string;
}

export function CircleFaucetButton({
  businessId,
  walletAddress,
  currentBalance,
  className = "",
}: CircleFaucetButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRequestFaucet = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/wallet/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          address: walletAddress || undefined,
          amount: 1000,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("+1,000 USDC Funded!");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setMessage("Request failed");
      }
    } catch {
      setMessage("Error contacting faucet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={handleRequestFaucet}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
        title="Request +1,000 testnet USDC from Circle Faucet"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Droplets className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        )}
        <span>{message || "1-Click Circle Faucet (+1,000 USDC)"}</span>
      </button>

      <a
        href={ARC_CONFIG.faucetUrl || "https://faucet.circle.com"}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center gap-0.5"
        title="Official Circle Testnet Faucet"
      >
        <span>Circle Faucet</span>
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}

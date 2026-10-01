"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import React, { useState } from "react";

import { ARC_CONFIG } from "@/lib/circle";

export interface TransactionHashBadgeProps {
  txHash: string | null | undefined;
  isSimulated?: boolean | null;
  status?: string | null;
  compact?: boolean;
  className?: string;
  showCopyButton?: boolean;
  explorerUrl?: string;
}

/**
 * Reusable honest transaction hash badge.
 *
 * Requirements:
 * - Real chain-confirmed tx hashes get a working ArcScan link (https://testnet.arcscan.app/tx/...).
 * - Simulated or mock-mode hashes render a clearly labeled "Simulated (testnet mock)" badge
 *   with the hash shown as copyable text, NEVER as a link to an explorer.
 */
export function TransactionHashBadge({
  txHash,
  isSimulated = false,
  status,
  compact = false,
  className = "",
  showCopyButton = true,
  explorerUrl: explorerUrlProp,
}: TransactionHashBadgeProps) {
  const [copied, setCopied] = useState(false);

  if (!txHash) {
    return (
      <span
        className={`font-mono text-[11px] text-slate-400 dark:text-slate-500 ${className}`}
      >
        N/A
      </span>
    );
  }

  const isSim =
    Boolean(isSimulated) ||
    status === "simulation-only" ||
    txHash.startsWith("0xsimulated");

  const displayText = compact
    ? `${txHash.slice(0, 8)}...`
    : txHash.length > 20
      ? `${txHash.slice(0, 10)}...${txHash.slice(-6)}`
      : txHash;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (isSim) {
    return (
      <div
        data-testid="transaction-simulated-badge"
        className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
      >
        <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0">
          Simulated (testnet mock)
        </span>
        <span
          className="font-mono text-xs text-slate-600 dark:text-slate-300 select-all cursor-text"
          title={txHash}
        >
          {displayText}
        </span>
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={copied ? "Copied!" : "Copy simulated hash"}
            aria-label="Copy simulated transaction hash"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="h-3 w-3 shrink-0" />
            )}
          </button>
        )}
      </div>
    );
  }

  const explorerUrl =
    explorerUrlProp || `${ARC_CONFIG.explorerUrl}/tx/${txHash}`;

  return (
    <div
      data-testid="transaction-real-link"
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-[#107e65] dark:text-[#34d399] hover:underline inline-flex items-center gap-1 shrink-0"
        title={`View on ArcScan: ${txHash}`}
      >
        <span>{displayText}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
      {showCopyButton && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          title={copied ? "Copied!" : "Copy transaction hash"}
          aria-label="Copy transaction hash"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500 shrink-0" />
          ) : (
            <Copy className="h-3 w-3 shrink-0" />
          )}
        </button>
      )}
    </div>
  );
}

"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Receipt,
  Trash2,
} from "lucide-react";
import React from "react";

import { ReceiptItem } from "./types";

interface PublicReceiptsSectionProps {
  receipts: ReceiptItem[];
  creatingReceipt: boolean;
  receiptCopiedToken: string | null;
  isTransactionCompleted: boolean;
  onCreateReceipt: () => void;
  onCopyReceipt: (token: string, url: string) => void;
  onToggleReceipt: (
    token: string,
    updates: {
      showBusinessName?: boolean;
      showVendorName?: boolean;
      revoke?: boolean;
    },
  ) => void;
}

export function PublicReceiptsSection({
  receipts,
  creatingReceipt,
  receiptCopiedToken,
  isTransactionCompleted,
  onCreateReceipt,
  onCopyReceipt,
  onToggleReceipt,
}: PublicReceiptsSectionProps) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111714] p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Public Savings Receipts</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Arc Verified
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate an unguessable, read-only proof page for customers or
              auditors without logging in.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateReceipt}
          disabled={
            creatingReceipt || (!isTransactionCompleted && receipts.length === 0)
          }
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          <Receipt className="h-3.5 w-3.5" />
          <span>
            {creatingReceipt ? "Generating Proof..." : "Create Public Receipt"}
          </span>
        </button>
      </div>

      {/* Receipts List */}
      {receipts.length > 0 ? (
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
          {receipts.map((rcpt) => {
            const receiptUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${rcpt.token}`;
            const isRevoked = Boolean(rcpt.revoked_at);

            return (
              <div
                key={rcpt.id}
                className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isRevoked
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                    }`}
                  >
                    {isRevoked ? "Revoked" : "Active Proof"}
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs">
                    /r/{rcpt.token}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isRevoked && (
                    <>
                      <a
                        href={`/r/${rcpt.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
                      >
                        <span>Open Proof</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>

                      <button
                        type="button"
                        onClick={() => onCopyReceipt(rcpt.token, receiptUrl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium cursor-pointer"
                      >
                        {receiptCopiedToken === rcpt.token ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-600 font-bold">
                              Copied
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 text-slate-400" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onToggleReceipt(rcpt.token, {
                            showBusinessName: !rcpt.show_business_name,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          rcpt.show_business_name
                            ? "border-emerald-500/30 text-[#107e65] dark:text-[#34d399] bg-emerald-500/5"
                            : "border-slate-200 dark:border-slate-700 text-slate-400 bg-slate-50 dark:bg-slate-800"
                        }`}
                      >
                        {rcpt.show_business_name ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                        <span>Co Name</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onToggleReceipt(rcpt.token, {
                            showVendorName: !rcpt.show_vendor_name,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          rcpt.show_vendor_name
                            ? "border-emerald-500/30 text-[#107e65] dark:text-[#34d399] bg-emerald-500/5"
                            : "border-slate-200 dark:border-slate-700 text-slate-400 bg-slate-50 dark:bg-slate-800"
                        }`}
                      >
                        {rcpt.show_vendor_name ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                        <span>Vendor Name</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to revoke this public receipt? It will immediately return 404.",
                            )
                          ) {
                            onToggleReceipt(rcpt.token, { revoke: true });
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Revoke</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
          {isTransactionCompleted
            ? "No public receipts generated yet. Click 'Create Public Receipt' above to share cryptographic proof."
            : "Receipts become available once escrow payment has been released on Arc."}
        </div>
      )}
    </div>
  );
}

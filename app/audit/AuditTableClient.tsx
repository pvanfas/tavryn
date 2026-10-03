"use client";

import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileCode,
  Search,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";

import { Caption, H3 } from "@/components/ui/text";
import { AuditBlock } from "@/lib/tools/audit";

interface AuditTableClientProps {
  blocks: AuditBlock[];
  isValid?: boolean;
}

export function AuditTableClient({ blocks }: AuditTableClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;
  const [selectedBlock, setSelectedBlock] = useState<AuditBlock | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Distinct action names for filter
  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    blocks.forEach((b) => set.add(b.action));
    return Array.from(set).sort();
  }, [blocks]);

  // Filtered blocks
  const filtered = useMemo(() => {
    return blocks.filter((b) => {
      const matchesSearch =
        searchQuery === "" ||
        b.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.reason || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.hash || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAction = actionFilter === "all" || b.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [blocks, searchQuery, actionFilter]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = filtered.slice(startIndex, startIndex + rowsPerPage);

  const formatHashShort = (hash: string | null) => {
    if (!hash) return "null";
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  return (
    <>
      <div className="w-full max-w-full overflow-hidden rounded-xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] p-4 sm:p-6 transition-colors font-sans">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/70">
          <div>
            <H3 as="h2" className="text-slate-900 dark:text-white">
              Immutable Action Blocks
            </H3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cryptographically chained append-only ledger ({blocks.length}{" "}
              total blocks loaded)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input Box */}
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search action, hash, reason..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-7 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#107e65]/20 focus:border-[#107e65] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-0.5"
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Action Filter Dropdown */}
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#107e65]/20 focus:border-[#107e65]"
            >
              <option value="all">All Actions ({blocks.length})</option>
              {actionOptions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Ledger Table */}
        <div className="hidden sm:block overflow-x-auto mt-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Caption
                  as="th"
                  scope="col"
                  className="py-3.5 px-3.5 w-12 text-center"
                >
                  #
                </Caption>
                <Caption
                  as="th"
                  scope="col"
                  className="py-3.5 px-4 min-w-[160px]"
                >
                  Action &amp; Detail
                </Caption>
                <Caption
                  as="th"
                  scope="col"
                  className="py-3.5 px-4 min-w-[150px]"
                >
                  Previous Hash
                </Caption>
                <Caption
                  as="th"
                  scope="col"
                  className="py-3.5 px-4 min-w-[150px]"
                >
                  Block Hash
                </Caption>
                <Caption
                  as="th"
                  scope="col"
                  className="py-3.5 px-3.5 min-w-[110px] text-center"
                >
                  Chain
                </Caption>
                <Caption
                  as="th"
                  scope="col"
                  className="py-3.5 px-3.5 min-w-[90px] text-center"
                >
                  Inspect
                </Caption>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-xs text-slate-400 dark:text-slate-500"
                  >
                    No matching action blocks found in audit ledger.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((block, idx) => {
                  const absoluteIndex = startIndex + idx;
                  const isGenesis = absoluteIndex === 0;

                  return (
                    <tr
                      key={block.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Block Index */}
                      <td className="py-3.5 px-3.5 text-center font-mono font-bold text-slate-400 text-xs">
                        {absoluteIndex + 1}
                      </td>

                      {/* Action & Reason */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                            {block.action}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(block.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                        {block.reason && (
                          <div
                            className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm truncate"
                            title={block.reason}
                          >
                            {block.reason}
                          </div>
                        )}
                      </td>

                      {/* Prev Hash */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span title={block.prev_hash || "Genesis"}>
                            {isGenesis
                              ? "0000... (Genesis)"
                              : formatHashShort(block.prev_hash)}
                          </span>
                          {block.prev_hash && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(block.prev_hash!)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                              title="Copy Prev Hash"
                            >
                              {copiedHash === block.prev_hash ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Block Hash */}
                      <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span title={block.hash || ""}>
                            {formatHashShort(block.hash)}
                          </span>
                          {block.hash && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(block.hash!)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                              title="Copy Block Hash"
                            >
                              {copiedHash === block.hash ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Chain Integrity Indicator */}
                      <td className="py-3.5 px-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Linked</span>
                        </span>
                      </td>

                      {/* Inspect Payload */}
                      <td className="py-3.5 px-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedBlock(block)}
                          className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          Payload
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden mt-4 space-y-2.5">
          {paginatedRows.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
              No matching action blocks found in audit ledger.
            </div>
          ) : (
            paginatedRows.map((block, idx) => {
              const absoluteIndex = startIndex + idx;
              const isGenesis = absoluteIndex === 0;

              return (
                <div
                  key={block.id}
                  className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-white/80 dark:bg-[#111714]/80 p-4 space-y-2.5 overflow-hidden min-w-0 max-w-full"
                >
                  {/* Header: Block # + Action + Chain Badge */}
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-xs font-bold text-slate-400 shrink-0">
                        #{absoluteIndex + 1}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 truncate">
                        {block.action}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      Linked
                    </span>
                  </div>

                  {/* Timestamp & Reason */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                    <div>
                      {new Date(block.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                    {block.reason && (
                      <p className="mt-1 text-slate-600 dark:text-slate-300 break-words line-clamp-2">
                        {block.reason}
                      </p>
                    )}
                  </div>

                  {/* Block Hash (monospace, truncated, with copy) */}
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Block Hash
                      </span>
                      {block.hash && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(block.hash!)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          title="Copy Block Hash"
                        >
                          {copiedHash === block.hash ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="font-mono text-[11px] font-bold text-slate-900 dark:text-white break-all">
                      {block.hash || "null"}
                    </div>
                  </div>

                  {/* Inspect Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedBlock(block)}
                    className="w-full text-center px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    Inspect Block Payload
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-medium text-slate-600 dark:text-slate-400">
          <div>
            Showing{" "}
            <span className="font-bold text-slate-900 dark:text-white">
              {totalRecords > 0 ? startIndex + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-bold text-slate-900 dark:text-white">
              {Math.min(startIndex + rowsPerPage, totalRecords)}
            </span>{" "}
            of{" "}
            <span className="font-bold text-slate-900 dark:text-white">
              {totalRecords}
            </span>{" "}
            action blocks
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Block Payload Modal */}
      {selectedBlock && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl bg-white dark:bg-[#111714] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Action Block: {selectedBlock.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBlock(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
                  Block Hash
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white break-all">
                  {selectedBlock.hash}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
                  Previous Hash
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 break-all">
                  {selectedBlock.prev_hash}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
                  Input Arguments
                </span>
                <pre className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(selectedBlock.input, null, 2) || "{}"}
                </pre>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
                  Result Output
                </span>
                <pre className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(selectedBlock.result, null, 2) || "{}"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

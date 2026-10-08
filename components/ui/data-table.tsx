"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Search,
} from "lucide-react";
import React, { useMemo, useState } from "react";

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  sortAccessor?: (row: T) => number | string | Date | null | undefined;
  accessor?: (row: T) => number | string | Date | null | undefined;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
}

export interface FilterChipOption {
  id: string;
  label: string;
  count?: number;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T, index: number) => string;
  /** Extractor for row execution mode (real vs simulated) */
  getSimulatedState?: (row: T) => { isSimulated: boolean; label?: string };
  /** Configurable initial sorting */
  defaultSort?: {
    columnKey: string;
    direction: "asc" | "desc";
  };
  /** Sticky filter chips configuration */
  filterChips?: FilterChipOption[];
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  /** Filter predicate if client-side filtering is preferred */
  clientFilterPredicate?: (row: T, activeFilter: string) => boolean;
  /** Optional search query filter */
  searchFilter?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  /** Optional custom mobile card renderer */
  renderMobileCard?: (row: T, index: number) => React.ReactNode;
  /** Optional search or custom header slot next to filter chips */
  headerActions?: React.ReactNode;
  /** Empty state customization */
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
  };
  className?: string;
  badgeColumnHeader?: string;
  showBadgeColumn?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  getSimulatedState,
  defaultSort,
  filterChips,
  activeFilter: controlledFilter,
  onFilterChange,
  clientFilterPredicate,
  searchFilter,
  searchPlaceholder = "Search records...",
  renderMobileCard,
  headerActions,
  emptyState,
  className = "",
  badgeColumnHeader = "Mode",
  showBadgeColumn = true,
}: DataTableProps<T>) {
  const [internalFilter, setInternalFilter] = useState<string>(
    filterChips && filterChips.length > 0 ? filterChips[0].id : "all",
  );
  const [searchQuery, setSearchQuery] = useState<string>("");

  const activeFilter =
    controlledFilter !== undefined ? controlledFilter : internalFilter;

  const [sortState, setSortState] = useState<{
    columnKey: string;
    direction: "asc" | "desc";
  } | null>(defaultSort || null);

  const handleSort = (columnKey: string) => {
    setSortState((prev) => {
      if (!prev || prev.columnKey !== columnKey) {
        return { columnKey, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { columnKey, direction: "asc" };
      }
      return null;
    });
  };

  const handleFilterClick = (filterId: string) => {
    if (onFilterChange) {
      onFilterChange(filterId);
    } else {
      setInternalFilter(filterId);
    }
  };

  // 1. Filter rows (chips + optional search)
  const filteredData = useMemo(() => {
    let result = data;

    if (clientFilterPredicate && activeFilter !== "all") {
      result = result.filter((row) => clientFilterPredicate(row, activeFilter));
    }

    if (searchFilter && searchQuery.trim() !== "") {
      result = result.filter((row) => searchFilter(row, searchQuery));
    }

    return result;
  }, [data, clientFilterPredicate, activeFilter, searchFilter, searchQuery]);

  // 2. Sort rows
  const sortedData = useMemo(() => {
    if (!sortState) return filteredData;

    const col = columns.find((c) => c.key === sortState.columnKey);
    if (!col) return filteredData;

    const accessor = col.sortAccessor || col.accessor;

    return [...filteredData].sort((a, b) => {
      let valA: unknown = accessor ? accessor(a) : (a as Record<string, unknown>)[col.key];
      let valB: unknown = accessor ? accessor(b) : (b as Record<string, unknown>)[col.key];

      if (valA === null || valA === undefined) valA = "";
      if (valB === null || valB === undefined) valB = "";

      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();

      let cmp = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }

      return sortState.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortState, columns]);

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#111714]/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] overflow-hidden font-sans ${className}`}
    >
      {/* Sticky Filter Chips & Search Bar */}
      {(filterChips || headerActions || searchFilter) && (
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-3.5 bg-white/95 dark:bg-[#111714]/95 backdrop-blur-xs border-b border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
          {filterChips && filterChips.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
              <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1.5 shrink-0">
                <Filter className="h-3 w-3" />
                <span className="hidden sm:inline">Filter</span>
              </div>
              {filterChips.map((chip) => {
                const isActive = activeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleFilterClick(chip.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                        : "bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    <span>{chip.label}</span>
                    {chip.count !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive
                            ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                            : "bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {chip.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
            {searchFilter && (
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#0c120f] border border-slate-200/80 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}
            {headerActions}
          </div>
        </div>
      )}

      {/* Main Table or Empty State */}
      {sortedData.length === 0 ? (
        <div className="p-12 text-center space-y-4">
          {emptyState?.icon && (
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mx-auto flex items-center justify-center text-slate-400">
              {emptyState.icon}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {emptyState?.title || "No records found"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {emptyState?.description ||
                "There are no items matching the current filter criteria."}
            </p>
          </div>
          {emptyState?.action && (
            <div className="pt-2">{emptyState.action}</div>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card Layout if provided */}
          {renderMobileCard && (
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
              {sortedData.map((row, index) => (
                <div
                  key={keyExtractor(row, index)}
                  className="p-3.5 space-y-3 bg-white dark:bg-[#121915] rounded-xl mb-2 border border-slate-100 dark:border-slate-800"
                >
                  {renderMobileCard(row, index)}
                </div>
              ))}
            </div>
          )}

          {/* Desktop Table Layout */}
          <div className={`${renderMobileCard ? "hidden sm:block" : "block"} overflow-x-auto`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {/* Leading Real/Simulated Badge Column */}
                  {showBadgeColumn && (
                    <th className="py-3.5 px-4 w-28 whitespace-nowrap">
                      {badgeColumnHeader}
                    </th>
                  )}

                  {columns.map((col) => {
                    const isSorted = sortState?.columnKey === col.key;
                    const alignClass =
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left";

                    return (
                      <th
                        key={col.key}
                        className={`py-3.5 px-4 whitespace-nowrap ${alignClass} ${col.headerClassName || ""}`}
                      >
                        {col.sortable ? (
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className={`inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${
                              isSorted
                                ? "text-slate-900 dark:text-white font-black"
                                : ""
                            }`}
                          >
                            <span>{col.header}</span>
                            {isSorted ? (
                              sortState.direction === "asc" ? (
                                <ArrowUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {sortedData.map((row, index) => {
                  const rowKey = keyExtractor(row, index);
                  const modeInfo = getSimulatedState ? getSimulatedState(row) : null;

                  return (
                    <tr
                      key={rowKey}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Leading Real/Simulated Badge Cell */}
                      {showBadgeColumn && (
                        <td className="py-3.5 px-4 align-middle">
                          {modeInfo ? (
                            modeInfo.isSimulated ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                <span>{modeInfo.label || "Simulated"}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{modeInfo.label || "Real"}</span>
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">—</span>
                          )}
                        </td>
                      )}

                      {columns.map((col) => {
                        const alignClass =
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left";
                        return (
                          <td
                            key={col.key}
                            className={`py-3.5 px-4 align-middle ${alignClass} ${col.className || ""}`}
                          >
                            {col.cell(row, index)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

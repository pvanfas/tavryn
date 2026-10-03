"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";

interface OpportunitiesPaginationProps {
  totalRecords: number;
  startIndex: number;
  rowsPerPage: number;
  setRowsPerPage: (n: number) => void;
  currentPage: number;
  totalPages: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export function OpportunitiesPagination({
  totalRecords,
  startIndex,
  rowsPerPage,
  setRowsPerPage,
  currentPage,
  totalPages,
  setCurrentPage,
}: OpportunitiesPaginationProps) {
  return (
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
        records
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 font-bold focus:outline-none"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="flex items-center gap-1 font-bold">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-700/60">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

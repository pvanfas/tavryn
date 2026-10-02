"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
} from "lucide-react";
import React from "react";

import { SubscriptionCategory } from "@/lib/schemas";

import { IngestMode } from "./types";

interface IngestionMethodSelectorProps {
  ingestMode: IngestMode;
  setIngestMode: (mode: IngestMode) => void;
  fileName: string | null;
  isFileUploading: boolean;
  uploadProgress: number;
  importError: string | null;
  importSuccess: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  manualVendor: string;
  setManualVendor: (s: string) => void;
  manualService: string;
  setManualService: (s: string) => void;
  manualCategory: SubscriptionCategory;
  setManualCategory: (c: SubscriptionCategory) => void;
  manualPrice: string;
  setManualPrice: (s: string) => void;
  manualDate: string;
  setManualDate: (s: string) => void;
  manualSeats: string;
  setManualSeats: (s: string) => void;
  manualErrors: Record<string, string>;
  onAddManual: (e: React.FormEvent) => void;
}

export function IngestionMethodSelector({
  ingestMode,
  setIngestMode,
  fileName,
  isFileUploading,
  uploadProgress,
  importError,
  importSuccess,
  onFileUpload,
  manualVendor,
  setManualVendor,
  manualService,
  setManualService,
  manualCategory,
  setManualCategory,
  manualPrice,
  setManualPrice,
  manualDate,
  setManualDate,
  manualSeats,
  setManualSeats,
  manualErrors,
  onAddManual,
}: IngestionMethodSelectorProps) {
  return (
    <div className="space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setIngestMode("statement_invoice")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            ingestMode === "statement_invoice"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Import from Statement or Invoice
        </button>
        <button
          type="button"
          onClick={() => setIngestMode("subscriptions_csv")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            ingestMode === "subscriptions_csv"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Pre-formatted CSV
        </button>
        <button
          type="button"
          onClick={() => setIngestMode("manual")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            ingestMode === "manual"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Manual Row Entry
        </button>
      </div>

      {/* Mode 1: Import Statement CSV or Invoice PDF/Image */}
      {ingestMode === "statement_invoice" && (
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors text-center relative overflow-hidden group">
            <UploadCloud className="h-9 w-9 text-[#107e65] mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {fileName
                ? `File Selected: ${fileName}`
                : "Drop your bank statement (CSV) or invoice (PDF, PNG, JPG) here"}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Max 10 MB &bull; Card digits and account numbers are strictly
              scrubbed in-memory
            </span>
            <input
              type="file"
              accept=".csv,.pdf,.png,.jpg,.jpeg,text/csv,application/pdf,image/*"
              onChange={onFileUpload}
              className="hidden"
            />

            {isFileUploading && (
              <div className="absolute inset-0 bg-white/90 dark:bg-[#111714]/90 flex flex-col items-center justify-center p-6 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-[#107e65]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Analyzing recurring charges and extracting fields...
                </span>
                <div className="w-48 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#107e65] h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </label>

          {importError && (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {importSuccess && (
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{importSuccess}</span>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Pre-formatted CSV */}
      {ingestMode === "subscriptions_csv" && (
        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors">
          <FileSpreadsheet className="h-8 w-8 text-[#107e65] mb-2" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {fileName
              ? `Loaded: ${fileName}`
              : "Click to select pre-formatted CSV file"}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Columns: vendor, service, category, annual_price, renewal_date,
            seats, active_seats
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={onFileUpload}
            className="hidden"
          />
        </label>
      )}

      {/* Mode 3: Manual Entry Form */}
      {ingestMode === "manual" && (
        <form
          onSubmit={onAddManual}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vendor *
              </label>
              <input
                type="text"
                placeholder="e.g., Salesforce"
                value={manualVendor}
                onChange={(e) => setManualVendor(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              {manualErrors.vendor && (
                <p className="text-xs font-bold text-rose-600 mt-0.5">
                  {manualErrors.vendor}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Service *
              </label>
              <input
                type="text"
                placeholder="e.g., Sales Cloud"
                value={manualService}
                onChange={(e) => setManualService(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              {manualErrors.service && (
                <p className="text-xs font-bold text-rose-600 mt-0.5">
                  {manualErrors.service}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={manualCategory}
                onChange={(e) =>
                  setManualCategory(e.target.value as SubscriptionCategory)
                }
                className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="software">Software</option>
                <option value="cloud">Cloud</option>
                <option value="contractors">Contractors</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Annual Price ($) *
              </label>
              <input
                type="number"
                placeholder="12000"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
              />
              {manualErrors.annual_price && (
                <p className="text-xs font-bold text-rose-600 mt-0.5">
                  {manualErrors.annual_price}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Renewal Date *
              </label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              {manualErrors.renewal_date && (
                <p className="text-xs font-bold text-rose-600 mt-0.5">
                  {manualErrors.renewal_date}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Seat Count
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={manualSeats}
                onChange={(e) => setManualSeats(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              Add Row
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

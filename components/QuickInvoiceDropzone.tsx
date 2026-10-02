"use client";

import { CheckCircle2, FileUp, Loader2, Sparkles, Upload, X } from "lucide-react";
import React, { useRef, useState } from "react";

interface QuickInvoiceDropzoneProps {
  businessId: string;
  className?: string;
}

export function QuickInvoiceDropzone({
  businessId,
  className = "",
}: QuickInvoiceDropzoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedItem, setParsedItem] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setError(null);
    setParsedItem(null);
    setSavedSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/file", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to parse document");
      }

      const detected = data.detected?.[0];
      if (!detected) {
        throw new Error("No subscription or invoice data detected in document");
      }

      setParsedItem({
        vendor: detected.vendor || "Enterprise Vendor",
        service: detected.service || `${detected.vendor} License`,
        category: detected.category || "software",
        annualPrice: Number(detected.annual_price) || 12000,
        renewalDate: detected.renewal_date || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
        seats: detected.seats || null,
        activeSeats: detected.active_seats || null,
        confidence: detected.confidence || 0.95,
      });
    } catch (err: any) {
      setError(err.message || "Failed to process invoice file");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSaveContract = async () => {
    if (!parsedItem) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          vendor: parsedItem.vendor,
          service: parsedItem.service,
          category: parsedItem.category,
          currentPrice: parsedItem.annualPrice,
          renewalDate: parsedItem.renewalDate,
          seatCount: parsedItem.seats,
          activeSeats: parsedItem.activeSeats,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save contract");
      }
      setSavedSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to save contract");
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors shadow-2xs cursor-pointer ${className}`}
        title="Drag & Drop PDF invoice or CSV statement"
      >
        <FileUp className="h-3.5 w-3.5 text-slate-400" />
        <span>Drop PDF Invoice</span>
      </button>
    );
  }

  return (
    <div className={`p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#121915]/95 shadow-md ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Instant PDF Invoice / Statement Parser
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Drag and drop any PDF invoice, receipt, or CSV statement to extract contract terms.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setIsOpen(false);
            setParsedItem(null);
            setError(null);
          }}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!parsedItem ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-3 p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-emerald-500 bg-emerald-50/20"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
          {isParsing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Extracting vendor telemetry and rates...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Upload className="h-6 w-6 text-slate-400" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Click to browse or drop PDF Invoice here
              </p>
              <p className="text-[10px] text-slate-400">
                Supports PDF, CSV, PNG, JPG (up to 10MB)
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Detected Vendor:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {parsedItem.vendor}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Service:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {parsedItem.service}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Annualized Spend:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                ${parsedItem.annualPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Renewal Date:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {parsedItem.renewalDate}
              </span>
            </div>
            {parsedItem.seats && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Seats:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {parsedItem.seats} seats ({parsedItem.activeSeats || "all"} active)
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setParsedItem(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer"
            >
              Parse Another
            </button>
            <button
              onClick={handleSaveContract}
              disabled={isSaving || savedSuccess}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : savedSuccess ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              ) : null}
              <span>{savedSuccess ? "Saved!" : "Confirm & Add Contract"}</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

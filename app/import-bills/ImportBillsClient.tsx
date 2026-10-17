"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ActiveBusiness } from "@/lib/active-business";
import { ARC_CONFIG } from "@/lib/circle";
import { DEV_TREASURY_ADDRESS } from "@/lib/constants";
import {
  parseAndValidateSubscriptionsCSV,
  validateSingleSubscription,
} from "@/lib/csv";
import {
  DEFAULT_POLICY_CONFIG,
  PolicyConfig,
  SubscriptionCategory,
  ValidatedSubscriptionRow,
} from "@/lib/schemas";

import {
  FundingResultCard,
  FundingResultData,
  IngestionMethodSelector,
  IngestMode,
  SubscriptionsReviewTable,
} from "./components";

interface ImportBillsClientProps {
  business: ActiveBusiness;
  businesses: ActiveBusiness[];
}

export function ImportBillsClient({
  business,
  businesses,
}: ImportBillsClientProps) {
  // Ingestion Mode State
  const [ingestMode, setIngestMode] = useState<IngestMode>("statement_invoice");

  // Subscriptions List
  const [rows, setRows] = useState<ValidatedSubscriptionRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // File Upload & Import State
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Funding Result State (shown after successful commit)
  const [fundingResult, setFundingResult] = useState<FundingResultData | null>(
    null,
  );

  // Manual Add Form State
  const [manualVendor, setManualVendor] = useState("");
  const [manualService, setManualService] = useState("");
  const [manualCategory, setManualCategory] =
    useState<SubscriptionCategory>("software");
  const [manualPrice, setManualPrice] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualSeats, setManualSeats] = useState("");
  const [manualActiveSeats, setManualActiveSeats] = useState("");
  const [manualDecline, setManualDecline] = useState("");
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 1. Process uploaded files via /api/import/file (supports multi-file batch)
  const processImportFiles = async (files: File[]) => {
    if (!files.length) return;

    setIsFileUploading(true);
    setUploadProgress(20);
    setImportError(null);
    setImportSuccess(null);

    const displayName =
      files.length === 1
        ? files[0].name
        : `${files.length} files (${files.map((f) => f.name).slice(0, 2).join(", ")}${files.length > 2 ? "..." : ""})`;
    setFileName(displayName);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      setUploadProgress(50);
      const res = await fetch("/api/import/file", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(80);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process import file(s)");
      }

      if (data.warning && (!data.detected || data.detected.length === 0)) {
        setImportError(data.warning);
        return;
      }

      const detectedItems: any[] = data.detected || [];
      if (detectedItems.length === 0) {
        setImportError(
          "No recurring charges or subscriptions detected in uploaded document(s).",
        );
        return;
      }

      const newRows: ValidatedSubscriptionRow[] = detectedItems.map(
        (item: any) => ({
          id:
            item.id ||
            `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          raw: {
            vendor: item.vendor,
            service: item.service,
            category: item.category,
            annual_price: String(item.annual_price),
            renewal_date: item.renewal_date,
            seats: item.seats != null ? String(item.seats) : "",
            active_seats:
              item.active_seats != null ? String(item.active_seats) : "",
            usage_decline_pct: "",
          },
          parsed: {
            vendor: item.vendor,
            service: item.service,
            category: item.category,
            annual_price: item.annual_price,
            renewal_date: item.renewal_date,
            seats: item.seats ?? null,
            active_seats: item.active_seats ?? null,
            usage_decline_pct: null,
          },
          isValid: true,
          errors: {},
          source:
            item.source ||
            (data.type === "invoice" ? "invoice-import" : "statement-import"),
          confidence: item.confidence,
          needsConfirmation: item.needsConfirmation,
          included: true,
        }),
      );

      setRows((prev) => [...newRows, ...prev]);
      setImportSuccess(
        `Successfully imported ${newRows.length} subscription${newRows.length === 1 ? "" : "s"} from ${files.length} document${files.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setUploadProgress(100);
      setIsFileUploading(false);
    }
  };

  // 2. Handle File Input Change (supports both single & multi-select)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    if (ingestMode === "statement_invoice") {
      processImportFiles(files);
    } else {
      // Legacy single CSV parsing
      const file = files[0];
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const parsed = parseAndValidateSubscriptionsCSV(text);
          const mappedRows = parsed.rows.map((r) => ({
            ...r,
            source: "csv-import" as const,
            included: true,
          }));
          setRows((prev) => [...mappedRows, ...prev]);
        }
      };
      reader.readAsText(file);
    }
  };

  // 3. Demo Quick-Load Helpers
  const handleLoadSampleStatement = async () => {
    try {
      setIsFileUploading(true);
      setImportError(null);
      const res = await fetch("/samples/statement.csv");
      if (!res.ok) throw new Error("Could not find /samples/statement.csv");
      const blob = await res.blob();
      const file = new File([blob], "statement.csv", { type: "text/csv" });
      await processImportFiles([file]);
    } catch (err) {
      setImportError((err as Error).message);
      setIsFileUploading(false);
    }
  };

  const handleLoadSampleInvoice = async () => {
    try {
      setIsFileUploading(true);
      setImportError(null);
      const res = await fetch("/samples/invoice.pdf");
      if (!res.ok) throw new Error("Could not find /samples/invoice.pdf");
      const blob = await res.blob();
      const file = new File([blob], "invoice.pdf", {
        type: "application/pdf",
      });
      await processImportFiles([file]);
    } catch (err) {
      setImportError((err as Error).message);
      setIsFileUploading(false);
    }
  };

  const handleLoadRealOrg = () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const sampleSubscriptions: ValidatedSubscriptionRow[] = [
      {
        id: `sample-salesforce-${Date.now()}`,
        raw: {
          vendor: "Salesforce",
          service: "Salesforce Sales Cloud",
          category: "software",
          annual_price: "42000",
          renewal_date: new Date(now + 28 * dayMs).toISOString().split("T")[0],
          seats: "85",
          active_seats: "52",
          usage_decline_pct: "38",
        },
        parsed: {
          vendor: "Salesforce",
          service: "Salesforce Sales Cloud",
          category: "software",
          annual_price: 42000,
          renewal_date: new Date(now + 28 * dayMs).toISOString().split("T")[0],
          seats: 85,
          active_seats: 52,
          usage_decline_pct: 38,
        },
        isValid: true,
        errors: {},
        source: "invoice-import",
        confidence: 0.99,
        needsConfirmation: false,
        included: true,
      },
      {
        id: `sample-slack-${Date.now()}`,
        raw: {
          vendor: "Slack",
          service: "Slack Enterprise Grid",
          category: "software",
          annual_price: "18500",
          renewal_date: new Date(now + 21 * dayMs).toISOString().split("T")[0],
          seats: "120",
          active_seats: "78",
          usage_decline_pct: "35",
        },
        parsed: {
          vendor: "Slack",
          service: "Slack Enterprise Grid",
          category: "software",
          annual_price: 18500,
          renewal_date: new Date(now + 21 * dayMs).toISOString().split("T")[0],
          seats: 120,
          active_seats: 78,
          usage_decline_pct: 35,
        },
        isValid: true,
        errors: {},
        source: "invoice-import",
        confidence: 0.98,
        needsConfirmation: false,
        included: true,
      },
      {
        id: `sample-datadog-${Date.now()}`,
        raw: {
          vendor: "Datadog",
          service: "Datadog Infrastructure Pro",
          category: "cloud",
          annual_price: "37200",
          renewal_date: new Date(now + 14 * dayMs).toISOString().split("T")[0],
          seats: "",
          active_seats: "",
          usage_decline_pct: "31",
        },
        parsed: {
          vendor: "Datadog",
          service: "Datadog Infrastructure Pro",
          category: "cloud",
          annual_price: 37200,
          renewal_date: new Date(now + 14 * dayMs).toISOString().split("T")[0],
          seats: null,
          active_seats: null,
          usage_decline_pct: 31,
        },
        isValid: true,
        errors: {},
        source: "statement-import",
        confidence: 0.96,
        needsConfirmation: false,
        included: true,
      },
      {
        id: `sample-aws-${Date.now()}`,
        raw: {
          vendor: "AWS",
          service: "Amazon Web Services Compute",
          category: "cloud",
          annual_price: "24000",
          renewal_date: new Date(now + 35 * dayMs).toISOString().split("T")[0],
          seats: "",
          active_seats: "",
          usage_decline_pct: "12",
        },
        parsed: {
          vendor: "AWS",
          service: "Amazon Web Services Compute",
          category: "cloud",
          annual_price: 24000,
          renewal_date: new Date(now + 35 * dayMs).toISOString().split("T")[0],
          seats: null,
          active_seats: null,
          usage_decline_pct: 12,
        },
        isValid: true,
        errors: {},
        source: "statement-import",
        confidence: 0.97,
        needsConfirmation: false,
        included: true,
      },
      {
        id: `sample-github-${Date.now()}`,
        raw: {
          vendor: "GitHub",
          service: "GitHub Enterprise Cloud",
          category: "software",
          annual_price: "9600",
          renewal_date: new Date(now + 40 * dayMs).toISOString().split("T")[0],
          seats: "96",
          active_seats: "68",
          usage_decline_pct: "29",
        },
        parsed: {
          vendor: "GitHub",
          service: "GitHub Enterprise Cloud",
          category: "software",
          annual_price: 9600,
          renewal_date: new Date(now + 40 * dayMs).toISOString().split("T")[0],
          seats: 96,
          active_seats: 68,
          usage_decline_pct: 29,
        },
        isValid: true,
        errors: {},
        source: "invoice-import",
        confidence: 0.99,
        needsConfirmation: false,
        included: true,
      },
    ];

    setRows(sampleSubscriptions);
    setImportError(null);
    setImportSuccess(
      "Imported 5 enterprise SaaS contracts ($131,300 total spend). Ready for 1-click commitment!",
    );
  };

  // 4. Handle Manual Add
  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    setManualErrors({});

    const rawInput = {
      vendor: manualVendor,
      service: manualService,
      category: manualCategory,
      annual_price: manualPrice !== "" ? Number(manualPrice) : undefined,
      renewal_date: manualDate,
      seats: manualSeats !== "" ? Number(manualSeats) : null,
      active_seats: manualActiveSeats !== "" ? Number(manualActiveSeats) : null,
      usage_decline_pct: manualDecline !== "" ? Number(manualDecline) : null,
    };

    const validation = validateSingleSubscription(rawInput);

    if (!validation.isValid || !validation.parsed) {
      setManualErrors(validation.errors);
      return;
    }

    const newRow: ValidatedSubscriptionRow = {
      id: `manual-${Date.now()}`,
      raw: {
        vendor: manualVendor,
        service: manualService,
        category: manualCategory,
        annual_price: manualPrice,
        renewal_date: manualDate,
        seats: manualSeats,
        active_seats: manualActiveSeats,
        usage_decline_pct: manualDecline,
      },
      parsed: validation.parsed,
      isValid: true,
      errors: {},
      source: "manual",
      confidence: 1.0,
      needsConfirmation: false,
      included: true,
    };

    setRows((prev) => [newRow, ...prev]);

    // Reset manual form
    setManualVendor("");
    setManualService("");
    setManualPrice("");
    setManualDate("");
    setManualSeats("");
    setManualActiveSeats("");
    setManualDecline("");
    setManualErrors({});
  };

  // 5. Row Manipulation in Review Table
  const handleToggleInclude = (id: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, included: r.included === false ? true : false }
          : r,
      ),
    );
  };

  const handleUpdateRowField = (id: string, field: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updatedRaw = { ...r.raw, [field]: value };
        const validation = validateSingleSubscription({
          vendor: updatedRaw.vendor,
          service: updatedRaw.service,
          category: updatedRaw.category as SubscriptionCategory,
          annual_price: updatedRaw.annual_price
            ? Number(updatedRaw.annual_price)
            : undefined,
          renewal_date: updatedRaw.renewal_date,
          seats: updatedRaw.seats ? Number(updatedRaw.seats) : null,
          active_seats: updatedRaw.active_seats
            ? Number(updatedRaw.active_seats)
            : null,
          usage_decline_pct: updatedRaw.usage_decline_pct
            ? Number(updatedRaw.usage_decline_pct)
            : null,
        });

        return {
          ...r,
          raw: updatedRaw,
          parsed: validation.parsed,
          isValid: validation.isValid,
          errors: validation.errors,
          needsConfirmation: false,
        };
      }),
    );
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // 6. Valid rows ready for commit
  const activeRows = rows.filter((r) => r.included !== false);
  const validActiveRows = activeRows.filter((r) => r.isValid && r.parsed);
  const totalAnnualSpend = validActiveRows.reduce(
    (acc, r) => acc + (r.parsed ? r.parsed.annual_price : 0),
    0,
  );

  // 7. Direct Commit to /api/import/commit targeting active organization
  const handleCommit = async () => {
    if (validActiveRows.length === 0) {
      setSubmitError(
        "At least one included, valid subscription is required to import bills",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const payload = {
        businessId: business.id,
        subscriptions: validActiveRows.map((r) => r.parsed),
      };

      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to import bills");
      }

      const json = await res.json();
      const data = json.data || json;

      setFundingResult({
        businessId: data.businessId || business.id,
        businessName: data.businessName || business.name,
        walletAddress:
          data.walletAddress || business.wallet_address || DEV_TREASURY_ADDRESS,
        contractsCount: data.contractsCount || validActiveRows.length,
        fundingInstructions: {
          network: "Arc Testnet",
          chainId: ARC_CONFIG.chainId,
          rpcUrl: ARC_CONFIG.rpcUrl,
          token: "Testnet USDC",
          tokenAddress: ARC_CONFIG.usdcContractAddress,
          faucetUrl: ARC_CONFIG.faucetUrl,
          explorerUrl: `${ARC_CONFIG.explorerUrl}/address/${data.walletAddress || business.wallet_address}`,
        },
      });
    } catch (err) {
      console.error("Commit error:", err);
      setSubmitError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: "Overview", href: "/dashboard" },
        { label: "Import Bills" },
      ]}
      businesses={businesses}
      activeBusinessId={business.id}
      businessName={business.name}
      treasuryBalance={Number(business.treasury_balance) || 0}
      currency={business.default_currency || "USDC"}
      walletAddress={business.wallet_address}
    >
      {fundingResult ? (
        <FundingResultCard fundingResult={fundingResult} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors self-start"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Overview</span>
            </Link>

            {/* Quick Demo Sample Action Buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={handleLoadRealOrg}
                disabled={isFileUploading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/40 hover:bg-emerald-500/20 text-xs font-bold text-[#107e65] dark:text-[#34d399] transition-all shadow-xs cursor-pointer"
                title="Loads realistic enterprise SaaS subscriptions ready for 1-click commitment"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 animate-pulse shrink-0" />
                <span>Load Sample SaaS Stack</span>
              </button>
              <button
                type="button"
                onClick={handleLoadSampleStatement}
                disabled={isFileUploading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#107e65] shrink-0" />
                <span>Try Sample CSV</span>
              </button>
              <button
                type="button"
                onClick={handleLoadSampleInvoice}
                disabled={isFileUploading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-[#107e65] shrink-0" />
                <span>Try Sample PDF</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-4 sm:p-7 shadow-xs space-y-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Import Bills &amp; Subscriptions
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Upload your bank statements (CSV) or vendor invoices (PDF, PNG, JPG) to
                automatically detect recurring renewals and track contracts.
              </p>
            </div>

            {/* Direct Target Business Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] flex items-center justify-center font-bold text-xs uppercase border border-emerald-500/20">
                  {business.name.slice(0, 2)}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Importing directly to
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{business.name}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                      Active Organization
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono sm:text-right">
                Treasury:{" "}
                <span className="font-bold text-slate-900 dark:text-white">
                  ${Number(business.treasury_balance || 0).toLocaleString()} USDC
                </span>
              </div>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Direct Ingestion Dropzone & Manual Tabs (Multi-Select Enabled) */}
            <IngestionMethodSelector
              ingestMode={ingestMode}
              setIngestMode={setIngestMode}
              fileName={fileName}
              isFileUploading={isFileUploading}
              uploadProgress={uploadProgress}
              importError={importError}
              importSuccess={importSuccess}
              onFileUpload={handleFileUpload}
              onFilesSelected={processImportFiles}
              manualVendor={manualVendor}
              setManualVendor={setManualVendor}
              manualService={manualService}
              setManualService={setManualService}
              manualCategory={manualCategory}
              setManualCategory={setManualCategory}
              manualPrice={manualPrice}
              setManualPrice={setManualPrice}
              manualDate={manualDate}
              setManualDate={setManualDate}
              manualSeats={manualSeats}
              setManualSeats={setManualSeats}
              manualErrors={manualErrors}
              onAddManual={handleAddManual}
            />

            {/* Review & Confirmation Table */}
            <SubscriptionsReviewTable
              rows={rows}
              validActiveRows={validActiveRows}
              totalAnnualSpend={totalAnnualSpend}
              onToggleInclude={handleToggleInclude}
              onUpdateRowField={handleUpdateRowField}
              onRemoveRow={handleRemoveRow}
            />

            {/* Commit Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {validActiveRows.length > 0 ? (
                  <span>
                    Ready to import{" "}
                    <strong className="text-slate-900 dark:text-white font-semibold">
                      {validActiveRows.length}
                    </strong>{" "}
                    subscription{validActiveRows.length === 1 ? "" : "s"} totaling{" "}
                    <strong className="text-slate-900 dark:text-white font-mono font-bold">
                      ${totalAnnualSpend.toLocaleString()}
                    </strong>
                    /year directly into{" "}
                    <strong className="text-slate-900 dark:text-white font-semibold">
                      {business.name}
                    </strong>
                    .
                  </span>
                ) : (
                  <span>Select or add at least one subscription to proceed.</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleCommit}
                disabled={isSubmitting || validActiveRows.length === 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#107e65] hover:bg-[#0d6853] text-white text-xs font-bold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importing Contracts...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Commit &amp; Track Subscriptions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

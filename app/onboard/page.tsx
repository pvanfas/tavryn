"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
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

export default function OnboardPage() {
  // Business State
  const [businessName, setBusinessName] = useState("");
  const [treasuryBalance, setTreasuryBalance] = useState("50000");

  // Ingestion Mode State
  const [ingestMode, setIngestMode] = useState<
    "statement_invoice" | "subscriptions_csv" | "manual"
  >("statement_invoice");

  // Policy State
  const [policy, setPolicy] = useState<PolicyConfig>({
    ...DEFAULT_POLICY_CONFIG,
  });

  // Subscriptions List
  const [rows, setRows] = useState<ValidatedSubscriptionRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // File Upload & Import State
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Funding Result State (shown after successful commit)
  const [fundingResult, setFundingResult] = useState<{
    businessId: string;
    businessName: string;
    walletAddress: string;
    contractsCount: number;
    fundingInstructions: {
      network: string;
      chainId: number;
      rpcUrl: string;
      token: string;
      tokenAddress: string;
      faucetUrl: string;
      explorerUrl: string;
    };
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  // 1. Process uploaded file via /api/import/file
  const processImportFile = async (file: File) => {
    setIsFileUploading(true);
    setUploadProgress(20);
    setImportError(null);
    setImportSuccess(null);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(50);
      const res = await fetch("/api/import/file", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(80);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process import file");
      }

      if (data.warning && (!data.detected || data.detected.length === 0)) {
        setImportError(data.warning);
        return;
      }

      const detectedItems: any[] = data.detected || [];
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
        `Successfully imported ${newRows.length} subscription${newRows.length === 1 ? "" : "s"} from ${file.name}`,
      );
      if (!businessName) {
        setBusinessName("Acme Operations Corp");
      }
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setUploadProgress(100);
      setIsFileUploading(false);
    }
  };

  // 2. Handle File Input Change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (ingestMode === "statement_invoice") {
      processImportFile(file);
    } else {
      // Legacy CSV parsing
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
      await processImportFile(file);
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
      const file = new File([blob], "invoice.pdf", { type: "application/pdf" });
      await processImportFile(file);
    } catch (err) {
      setImportError((err as Error).message);
      setIsFileUploading(false);
    }
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
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      included: true,
    };

    setRows((prev) => [newRow, ...prev]);
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

  // 7. Commit to /api/onboard
  const handleCommit = async () => {
    if (!businessName.trim()) {
      setSubmitError("Company name is required");
      return;
    }
    if (validActiveRows.length === 0) {
      setSubmitError(
        "At least one included, valid subscription is required to complete onboarding",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const currentUser = await getCurrentUser();
      const payload: any = {
        name: businessName.trim(),
        treasury_balance: Number(treasuryBalance) || 0,
        policy: {
          max_auto_transaction: Number(policy.max_auto_transaction),
          min_savings: Number(policy.min_savings),
          human_approval_required_above: Number(
            policy.human_approval_required_above,
          ),
          allowed_categories: policy.allowed_categories,
        },
        subscriptions: validActiveRows.map((r) => r.parsed),
      };

      if (currentUser?.id) {
        payload.userId = currentUser.id;
      }

      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to onboard organization");
      }

      const json = await res.json();
      const data = json.data || json;
      setFundingResult({
        businessId: data.businessId,
        businessName: data.businessName,
        walletAddress: data.walletAddress || DEV_TREASURY_ADDRESS,
        contractsCount: data.contractsCount,
        fundingInstructions: data.fundingInstructions || {
          network: "Arc Testnet",
          chainId: ARC_CONFIG.chainId,
          rpcUrl: ARC_CONFIG.rpcUrl,
          token: "Testnet USDC",
          tokenAddress: ARC_CONFIG.usdcContractAddress,
          faucetUrl: ARC_CONFIG.faucetUrl,
          explorerUrl: `${ARC_CONFIG.explorerUrl}/address/${data.walletAddress}`,
        },
      });
    } catch (err) {
      console.error(err);
      setSubmitError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: "Overview", href: "/" },
        { label: "Onboard Organization" },
      ]}
    >
      {fundingResult ? (
        /* SUCCESS / FUNDING INSTRUCTIONS VIEW */
        <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Organization Provisioned Successfully
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Created <strong>{fundingResult.businessName}</strong> with{" "}
                {fundingResult.contractsCount} verified contracts
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#151c19] border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Provisioned Arc Treasury Wallet
            </span>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs">
              <span className="truncate text-slate-800 dark:text-slate-200">
                {fundingResult.walletAddress}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopy(fundingResult.walletAddress, "address")
                }
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center gap-1 shrink-0"
              >
                {copiedField === "address" ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{copiedField === "address" ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Link
              href={`/?businessId=${fundingResult.businessId}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <span>Go to Overview</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        /* ONBOARDING WORKFLOW */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Overview</span>
            </Link>

            {/* Quick Demo Sample Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSampleStatement}
                disabled={isFileUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#107e65]" />
                <span>Try Sample Statement CSV</span>
              </button>
              <button
                type="button"
                onClick={handleLoadSampleInvoice}
                disabled={isFileUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5 text-[#107e65]" />
                <span>Try Sample Invoice PDF</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-6 sm:p-7 shadow-xs space-y-7">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Import Subscriptions &amp; Invoices
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Upload your bank statement (CSV) or invoice (PDF/image) to
                automatically detect recurring renewals in under 2 minutes.
              </p>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Step 1: Organization Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-slate-100 dark:border-slate-800/70">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Acme Cloud Corp"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#107e65]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Initial Treasury Balance (USDC)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    value={treasuryBalance}
                    onChange={(e) => setTreasuryBalance(e.target.value)}
                    className="w-full text-xs pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-slate-900 dark:text-white font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-[#107e65]"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Ingestion Mode Tabs */}
            <div className="space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setIngestMode("statement_invoice")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                      Max 10 MB &bull; Card digits and account numbers are
                      strictly scrubbed in-memory
                    </span>
                    <input
                      type="file"
                      accept=".csv,.pdf,.png,.jpg,.jpeg,text/csv,application/pdf,image/*"
                      onChange={handleFileUpload}
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
                    Columns: vendor, service, category, annual_price,
                    renewal_date, seats, active_seats
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {/* Mode 3: Manual Entry Form */}
              {ingestMode === "manual" && (
                <form
                  onSubmit={handleAddManual}
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
                          setManualCategory(
                            e.target.value as SubscriptionCategory,
                          )
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
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      Add Row
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Step 3: Editable Review Table with Confidence Badges and Include/Exclude Checkboxes */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Review Detected Subscriptions</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {validActiveRows.length} of {rows.length} selected
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verify detected merchants, cadence annualization, and
                    confidence levels before committing to contracts ledger.
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Total Selected Spend
                  </span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    ${totalAnnualSpend.toLocaleString()} / year
                  </span>
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 text-center text-xs text-slate-400">
                  No subscriptions detected yet. Upload a statement CSV or
                  invoice PDF above, or click one of the sample buttons.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
                  <table className="w-full text-left text-xs font-sans border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-3 w-10 text-center">Inc</th>
                        <th className="py-3 px-4 min-w-[180px]">
                          Vendor &amp; Service
                        </th>
                        <th className="py-3 px-3 min-w-[110px]">Category</th>
                        <th className="py-3 px-4 min-w-[130px]">
                          Annual Price ($)
                        </th>
                        <th className="py-3 px-3 min-w-[130px]">
                          Renewal Date
                        </th>
                        <th className="py-3 px-3 text-center min-w-[110px]">
                          Confidence / Source
                        </th>
                        <th className="py-3 px-3 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
                      {rows.map((r, idx) => {
                        const isIncluded = r.included !== false;

                        return (
                          <tr
                            key={r.id}
                            className={`transition-colors duration-150 ${
                              isIncluded
                                ? "hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04]"
                                : "opacity-40 bg-slate-50/50 dark:bg-slate-900/30"
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={() => handleToggleInclude(r.id)}
                                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>

                            {/* Editable Vendor & Service */}
                            <td className="py-3 px-4 space-y-1">
                              <input
                                type="text"
                                value={r.raw.service}
                                onChange={(e) =>
                                  handleUpdateRowField(
                                    r.id,
                                    "service",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                              />
                              <input
                                type="text"
                                value={r.raw.vendor}
                                onChange={(e) =>
                                  handleUpdateRowField(
                                    r.id,
                                    "vendor",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-[11px] text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                              />
                            </td>

                            {/* Editable Category */}
                            <td className="py-3 px-3">
                              <select
                                value={r.raw.category}
                                onChange={(e) =>
                                  handleUpdateRowField(
                                    r.id,
                                    "category",
                                    e.target.value,
                                  )
                                }
                                className="text-xs rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              >
                                <option value="software">software</option>
                                <option value="cloud">cloud</option>
                                <option value="contractors">contractors</option>
                              </select>
                            </td>

                            {/* Editable Annual Price */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white">
                                <span>$</span>
                                <input
                                  type="number"
                                  value={r.raw.annual_price}
                                  onChange={(e) =>
                                    handleUpdateRowField(
                                      r.id,
                                      "annual_price",
                                      e.target.value,
                                    )
                                  }
                                  className="w-24 text-xs font-mono font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                                />
                              </div>
                            </td>

                            {/* Editable Renewal Date */}
                            <td className="py-3 px-3">
                              <input
                                type="date"
                                value={r.raw.renewal_date}
                                onChange={(e) =>
                                  handleUpdateRowField(
                                    r.id,
                                    "renewal_date",
                                    e.target.value,
                                  )
                                }
                                className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                              />
                            </td>

                            {/* Confidence Badge & Source */}
                            <td className="py-3 px-3 text-center space-y-0.5">
                              {r.confidence != null ? (
                                r.confidence >= 0.85 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span>
                                      {Math.round(r.confidence * 100)}% High
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    <span>
                                      Verify ({Math.round(r.confidence * 100)}%)
                                    </span>
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  Standard
                                </span>
                              )}
                              <div className="text-[9px] font-mono text-slate-400 truncate">
                                {r.source || "csv"}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(r.id)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Remove row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Step 4: Deterministic Policy Limits */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Deterministic Policy Limits
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Max Autonomous Transaction ($)
                  </label>
                  <input
                    type="number"
                    value={policy.max_auto_transaction}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        max_auto_transaction: Number(e.target.value),
                      })
                    }
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Minimum Savings Threshold ($)
                  </label>
                  <input
                    type="number"
                    value={policy.min_savings}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        min_savings: Number(e.target.value),
                      })
                    }
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Human Approval Required Above ($)
                  </label>
                  <input
                    type="number"
                    value={policy.human_approval_required_above}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        human_approval_required_above: Number(e.target.value),
                      })
                    }
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Commit Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {validActiveRows.length} subscription
                {validActiveRows.length === 1 ? "" : "s"} ready to commit
              </span>

              <button
                type="button"
                onClick={handleCommit}
                disabled={isSubmitting || validActiveRows.length === 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Provisioning Organization &amp; Contracts...</span>
                  </>
                ) : (
                  <>
                    <span>Commit Subscriptions &amp; Fund Treasury</span>
                    <ArrowRight className="h-4 w-4" />
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

"use client";

import { AlertTriangle, ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
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

import {
  FundingResultCard,
  FundingResultData,
  IngestionMethodSelector,
  IngestMode,
  PolicyConfigurationForm,
  SubscriptionsReviewTable,
} from "./components";

export default function OnboardPage() {
  // Business State
  const [businessName, setBusinessName] = useState("");
  const [treasuryBalance, setTreasuryBalance] = useState("50000");

  // Ingestion Mode State
  const [ingestMode, setIngestMode] = useState<IngestMode>("statement_invoice");

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
  const [fundingResult, setFundingResult] = useState<FundingResultData | null>(null);

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

  return (
    <AppShell
      breadcrumbs={[
        { label: "Overview", href: "/" },
        { label: "Onboard Organization" },
      ]}
    >
      {fundingResult ? (
        <FundingResultCard fundingResult={fundingResult} />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#107e65]" />
                <span>Try Sample Statement CSV</span>
              </button>
              <button
                type="button"
                onClick={handleLoadSampleInvoice}
                disabled={isFileUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
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
            <IngestionMethodSelector
              ingestMode={ingestMode}
              setIngestMode={setIngestMode}
              fileName={fileName}
              isFileUploading={isFileUploading}
              uploadProgress={uploadProgress}
              importError={importError}
              importSuccess={importSuccess}
              onFileUpload={handleFileUpload}
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

            {/* Step 3: Editable Review Table */}
            <SubscriptionsReviewTable
              rows={rows}
              validActiveRows={validActiveRows}
              totalAnnualSpend={totalAnnualSpend}
              onToggleInclude={handleToggleInclude}
              onUpdateRowField={handleUpdateRowField}
              onRemoveRow={handleRemoveRow}
            />

            {/* Step 4: Policy Configuration & Commit */}
            <PolicyConfigurationForm
              policy={policy}
              setPolicy={setPolicy}
              validActiveRowsCount={validActiveRows.length}
              isSubmitting={isSubmitting}
              onCommit={handleCommit}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}

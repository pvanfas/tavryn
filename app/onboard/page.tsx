"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  parseAndValidateSubscriptionsCSV,
  validateSingleSubscription,
} from "@/lib/csv";
import {
  ValidatedSubscriptionRow,
  SubscriptionCategory,
  PolicyConfig,
  DEFAULT_POLICY_CONFIG,
} from "@/lib/schemas";
import { ARC_CONFIG } from "@/lib/circle";
import { DEV_TREASURY_ADDRESS } from "@/lib/constants";
import {
  UploadCloud,
  FileSpreadsheet,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Wallet,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export default function OnboardPage() {

  // Business State
  const [businessName, setBusinessName] = useState("");
  const [treasuryBalance, setTreasuryBalance] = useState("50000");

  // Policy State
  const [policy, setPolicy] = useState<PolicyConfig>({ ...DEFAULT_POLICY_CONFIG });

  // Subscriptions List
  const [rows, setRows] = useState<ValidatedSubscriptionRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

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
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualVendor, setManualVendor] = useState("");
  const [manualService, setManualService] = useState("");
  const [manualCategory, setManualCategory] = useState<SubscriptionCategory>("software");
  const [manualPrice, setManualPrice] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualSeats, setManualSeats] = useState("");
  const [manualActiveSeats, setManualActiveSeats] = useState("");
  const [manualDecline, setManualDecline] = useState("");
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseAndValidateSubscriptionsCSV(text);
        setRows(parsed.rows);
      }
    };
    reader.readAsText(file);
  };

  // Load Sample CSV helper
  const handleLoadSample = async () => {
    try {
      setSampleLoading(true);
      setSubmitError(null);
      const res = await fetch("/sample-subscriptions.csv");
      if (!res.ok) throw new Error("Could not find sample-subscriptions.csv");
      const text = await res.text();
      const parsed = parseAndValidateSubscriptionsCSV(text);
      setRows(parsed.rows);
      setCsvFileName("sample-subscriptions.csv");
      if (!businessName) {
        setBusinessName("Acme Operations Corp");
      }
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSampleLoading(false);
    }
  };

  // Handle Manual Add
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
    setShowManualForm(false);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const validRows = rows.filter((r) => r.isValid && r.parsed);
  const totalAnnualSpend = validRows.reduce(
    (acc, r) => acc + (r.parsed ? r.parsed.annual_price : 0),
    0
  );

  const handleCommit = async () => {
    if (!businessName.trim()) {
      setSubmitError("Company name is required");
      return;
    }
    if (validRows.length === 0) {
      setSubmitError("At least one valid subscription row is required");
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
          human_approval_required_above: Number(policy.human_approval_required_above),
          allowed_categories: policy.allowed_categories,
        },
        subscriptions: validRows.map((r) => r.parsed),
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
      businessName={businessName || "New Organization"}
      isReal={true}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Onboard Business" },
      ]}
      currency="USDC"
    >
      {fundingResult ? (
        <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-emerald-500/30 p-7 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-[#107e65] dark:text-[#34d399] flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {fundingResult.businessName} Onboarded Successfully
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {fundingResult.contractsCount} verified contract{fundingResult.contractsCount === 1 ? "" : "s"} imported. Treasury smart wallet provisioned on Arc Testnet.
              </p>
            </div>
          </div>

          {/* Treasury Wallet Card */}
          <div className="p-5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/70 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Arc Treasury Wallet Address
                </span>
              </div>
              <a
                href={fundingResult.fundingInstructions.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#107e65] dark:text-[#34d399] flex items-center gap-1 hover:underline"
              >
                <span>View on Arcscan</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                {fundingResult.walletAddress}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(fundingResult.walletAddress, "wallet")}
                className="px-3.5 py-2.5 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedField === "wallet" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === "wallet" ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Network:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {fundingResult.fundingInstructions.network} (Chain ID {fundingResult.fundingInstructions.chainId})
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Token:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {fundingResult.fundingInstructions.token} (Arc ERC-20 Precompile)
                </span>
              </div>
            </div>
          </div>

          {/* Step-by-Step Funding Instructions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Funding Instructions
            </h3>
            <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-[#107e65]/15 text-[#107e65] dark:text-[#34d399] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Copy your newly provisioned Arc treasury wallet address above.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-[#107e65]/15 text-[#107e65] dark:text-[#34d399] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>
                  Visit the{" "}
                  <a
                    href={fundingResult.fundingInstructions.faucetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#107e65] dark:text-[#34d399] underline inline-flex items-center gap-1"
                  >
                    Circle Faucet <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  to mint testnet USDC to your treasury wallet, or transfer USDC directly on Arc Testnet.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-[#107e65]/15 text-[#107e65] dark:text-[#34d399] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Tavryn&apos;s agent will autonomously detect the balance and execute your deterministic procurement policy.</span>
              </li>
            </ol>
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Link
              href={`/dashboard?businessId=${fundingResult.businessId}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs transition-colors"
            >
              <span>Open Organization Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Top Actions Bar */}
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Ledger</span>
            </Link>

            <button
              type="button"
              onClick={handleLoadSample}
              disabled={sampleLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#107e65]" />
              <span>{sampleLoading ? "Loading..." : "Load Sample Subscriptions CSV"}</span>
            </button>
          </div>

          {/* Form Card */}
          <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-6 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] space-y-7">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Organization &amp; Contract Ingestion
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Register verified contracts, configure autonomous policy ceilings, and deposit initial treasury balance
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
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Acme Cloud Corp"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#107e65]/20 focus:border-[#107e65] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Initial Treasury Balance (USDC)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold">$</span>
                  <input
                    type="number"
                    value={treasuryBalance}
                    onChange={(e) => setTreasuryBalance(e.target.value)}
                    className="w-full text-xs pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#107e65]/20 focus:border-[#107e65] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Upload CSV or Add Manually */}
            <div className="space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Subscriptions CSV File
                  </h2>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Columns: vendor, service, category, annual_price, renewal_date, seats, active_seats
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{showManualForm ? "Hide Manual Form" : "Add Row Manually"}</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors">
                <UploadCloud className="h-8 w-8 text-[#107e65] mb-2" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {csvFileName ? `Loaded: ${csvFileName}` : "Click to select CSV file"}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Supports RFC-4180 formatted CSV</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>

              {/* Manual Entry Form */}
              {showManualForm && (
                <form onSubmit={handleAddManual} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor *</label>
                      <input
                        type="text"
                        placeholder="e.g., Salesforce"
                        value={manualVendor}
                        onChange={(e) => setManualVendor(e.target.value)}
                        className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      {manualErrors.vendor && <p className="text-xs font-bold text-rose-600 mt-0.5">{manualErrors.vendor}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Service *</label>
                      <input
                        type="text"
                        placeholder="e.g., Sales Cloud"
                        value={manualService}
                        onChange={(e) => setManualService(e.target.value)}
                        className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      {manualErrors.service && <p className="text-xs font-bold text-rose-600 mt-0.5">{manualErrors.service}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                      <select
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value as SubscriptionCategory)}
                        className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="software">Software</option>
                        <option value="cloud">Cloud</option>
                        <option value="contractors">Contractors</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Annual Price ($) *</label>
                      <input
                        type="number"
                        placeholder="12000"
                        value={manualPrice}
                        onChange={(e) => setManualPrice(e.target.value)}
                        className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                      />
                      {manualErrors.annual_price && <p className="text-xs font-bold text-rose-600 mt-0.5">{manualErrors.annual_price}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Renewal Date *</label>
                      <input
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        className="w-full text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      {manualErrors.renewal_date && <p className="text-xs font-bold text-rose-600 mt-0.5">{manualErrors.renewal_date}</p>}
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-1.5 rounded bg-[#107e65] text-white text-xs font-bold hover:bg-[#0d6b55]"
                      >
                        Add to Ingestion List
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Ingestion Table (Reference Ledger Style) */}
            {rows.length > 0 && (
              <div className="space-y-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Validated Ingestion Rows ({rows.length})
                  </h3>
                  <div className="text-xs text-slate-700 dark:text-slate-300 font-bold font-mono">
                    Total Ingested Spend: ${totalAnnualSpend.toLocaleString()}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
                  <table className="w-full text-left text-xs font-sans border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th scope="col" className="py-3.5 px-3.5 w-12 text-center">#</th>
                        <th scope="col" className="py-3.5 px-4 min-w-[200px]">Service &amp; Vendor</th>
                        <th scope="col" className="py-3.5 px-3.5 min-w-[110px]">Category</th>
                        <th scope="col" className="py-3.5 px-4 text-right min-w-[120px]">Annual Price</th>
                        <th scope="col" className="py-3.5 px-3.5 min-w-[130px]">Renewal Date</th>
                        <th scope="col" className="py-3.5 px-3.5 text-center min-w-[110px]">Validation</th>
                        <th scope="col" className="py-3.5 px-3.5 text-center w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
                      {rows.map((r, idx) => (
                        <tr key={r.id} className="hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04] transition-colors duration-150">
                          <td className="py-3.5 px-3.5 text-center text-slate-400 dark:text-slate-500 font-mono font-medium text-xs">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{r.raw.service}</span>
                            <span className="text-slate-500 dark:text-slate-400 font-medium ml-1.5 text-xs">({r.raw.vendor})</span>
                          </td>
                          <td className="py-3.5 px-3.5">
                            <span className="inline-block px-2.5 py-0.5 rounded-md capitalize text-slate-600 dark:text-slate-300 bg-slate-100/70 dark:bg-slate-800/60 text-xs font-medium border border-slate-200/50 dark:border-slate-700/50">
                              {r.raw.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                            ${Number(r.raw.annual_price || 0).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3.5 text-slate-600 dark:text-slate-300 font-medium text-xs">{r.raw.renewal_date}</td>
                          <td className="py-3.5 px-3.5 text-center">
                            {r.isValid ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#107e65]" />
                                <span>Valid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                                <span>Errors</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(r.id)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 3: Policy Limits */}
            <div className="space-y-4">
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
                    onChange={(e) => setPolicy({ ...policy, max_auto_transaction: Number(e.target.value) })}
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#107e65]"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Minimum Savings Threshold ($)
                  </label>
                  <input
                    type="number"
                    value={policy.min_savings}
                    onChange={(e) => setPolicy({ ...policy, min_savings: Number(e.target.value) })}
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#107e65]"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Human Approval Required Above ($)
                  </label>
                  <input
                    type="number"
                    value={policy.human_approval_required_above}
                    onChange={(e) => setPolicy({ ...policy, human_approval_required_above: Number(e.target.value) })}
                    className="w-full text-xs font-bold px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Commit Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {validRows.length} subscription{validRows.length === 1 ? "" : "s"} ready for commit
              </span>

              <button
                type="button"
                onClick={handleCommit}
                disabled={isSubmitting || validRows.length === 0 || !businessName.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Committing Organization...</span>
                  </>
                ) : (
                  <>
                    <span>Commit &amp; Onboard Organization</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

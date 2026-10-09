"use client";

import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_POLICY_CONFIG,
  SubscriptionRow,
  ValidatedSubscriptionRow,
} from "@/lib/schemas";

const INDUSTRY_OPTIONS = [
  { id: "saas", label: "SaaS & Cloud Software" },
  { id: "fintech", label: "FinTech & Financial Services" },
  { id: "ai", label: "AI & Machine Learning" },
  { id: "ecommerce", label: "E-Commerce & Retail" },
  { id: "healthcare", label: "Healthcare & Biotech" },
  { id: "professional_services", label: "Professional Services & Consulting" },
  { id: "media", label: "Media & Entertainment" },
  { id: "manufacturing", label: "Hardware & Manufacturing" },
  { id: "other", label: "Other" },
];

const BENCHMARK_SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    vendor: "Salesforce",
    service: "Sales Cloud Enterprise",
    category: "software",
    annual_price: 42000,
    renewal_date: new Date(Date.now() + 28 * 86400000)
      .toISOString()
      .split("T")[0],
    seats: 85,
    active_seats: 52,
    usage_decline_pct: 38,
  },
  {
    vendor: "Slack",
    service: "Slack Enterprise Grid",
    category: "software",
    annual_price: 18500,
    renewal_date: new Date(Date.now() + 21 * 86400000)
      .toISOString()
      .split("T")[0],
    seats: 120,
    active_seats: 78,
    usage_decline_pct: 35,
  },
  {
    vendor: "Datadog",
    service: "Infrastructure Pro",
    category: "cloud",
    annual_price: 37200,
    renewal_date: new Date(Date.now() + 14 * 86400000)
      .toISOString()
      .split("T")[0],
    seats: null,
    active_seats: null,
    usage_decline_pct: 42,
  },
  {
    vendor: "AWS",
    service: "Cloud Hosting & Compute",
    category: "cloud",
    annual_price: 24000,
    renewal_date: new Date(Date.now() + 35 * 86400000)
      .toISOString()
      .split("T")[0],
    seats: null,
    active_seats: null,
    usage_decline_pct: 12,
  },
  {
    vendor: "GitHub",
    service: "Enterprise Cloud",
    category: "software",
    annual_price: 9600,
    renewal_date: new Date(Date.now() + 40 * 86400000)
      .toISOString()
      .split("T")[0],
    seats: 96,
    active_seats: 68,
    usage_decline_pct: 29,
  },
];

interface FirstTimeOnboardingModalProps {
  currentBusinessIsReal?: boolean;
}

export function FirstTimeOnboardingModal({
  currentBusinessIsReal = false,
}: FirstTimeOnboardingModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Company Profile
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRY_OPTIONS[0].label);

  // Step 2: Bills / Subscriptions
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function checkFirstTimeStatus() {
      try {
        const user = await getCurrentUser();
        if (!user || user.id === "00000000-0000-0000-0000-000000000001") {
          // Unauthenticated or demo session does not trigger modal automatically
          return;
        }

        setUserId(user.id);
        const dismissedKey = `tavryn_onboarding_dismissed_${user.id}`;
        const isDismissed = localStorage.getItem(dismissedKey);

        // If the logged-in user is on an unonboarded / demo placeholder business and hasn't dismissed, open modal
        if (!currentBusinessIsReal && !isDismissed) {
          setIsOpen(true);
        }
      } catch {
        // Fallback
      }
    }

    checkFirstTimeStatus();
  }, [currentBusinessIsReal]);

  const handleClose = () => {
    if (userId) {
      localStorage.setItem(`tavryn_onboarding_dismissed_${userId}`, "true");
    }
    setIsOpen(false);
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setSubmitError("Please enter your company name.");
      return;
    }
    setSubmitError(null);
    setStep(2);
  };

  const handleLoadBenchmark = () => {
    setSubscriptions(BENCHMARK_SUBSCRIPTIONS);
    setFileName("Benchmark Enterprise Stack (5 SaaS Contracts)");
    setUploadError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/file", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse uploaded document.");
      }

      const rows: ValidatedSubscriptionRow[] = data.rows || [];
      const validRows = rows
        .filter((r) => r.isValid && r.parsed)
        .map((r) => r.parsed!);

      if (validRows.length === 0) {
        throw new Error(
          "No valid subscription line items could be extracted. Try loading the benchmark stack or another file.",
        );
      }

      setSubscriptions(validRows);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (subscriptions.length === 0) {
      setSubmitError("Please import at least one bill or load the benchmark stack.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName.trim(),
          industry,
          treasury_balance: 50000,
          default_currency: "USDC",
          userId: userId || undefined,
          policy: DEFAULT_POLICY_CONFIG,
          subscriptions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create organization.");
      }

      setIsSuccess(true);
      if (userId) {
        localStorage.setItem(`tavryn_onboarding_dismissed_${userId}`, "true");
      }

      setTimeout(() => {
        setIsOpen(false);
        router.refresh();
      }, 1500);
    } catch (err) {
      setSubmitError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalSpend = subscriptions.reduce((sum, s) => sum + s.annual_price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/90 dark:border-slate-800/90 shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="p-6 bg-gradient-to-r from-[#107e65]/10 via-emerald-500/5 to-transparent border-b border-slate-200/80 dark:border-slate-800/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#107e65] text-white flex items-center justify-center shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {step === 1 ? "Welcome to Tavryn" : "Step 2: Import Bills & Contracts"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 1
                  ? "Set up your autonomous procurement profile in 2 quick steps."
                  : "Ingest your subscriptions so Tavryn can detect renewal savings."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Explore with Demo Co first"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-[#107e65] transition-all duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {submitError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-[#107e65] flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Organization Created & Bills Ingested!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Launching your autonomous ledger on Arc...
              </p>
            </div>
          ) : step === 1 ? (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#151c19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#107e65]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Industry Type
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#151c19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#107e65]"
                  >
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#151c19] border border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Primary Treasury Token
                </span>
                <span className="font-bold text-[#107e65] dark:text-[#34d399]">
                  USDC (Arc Native Gas)
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Explore with Demo Co first
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#107e65] hover:bg-[#0d6b55] text-white shadow-xs transition-colors"
                >
                  <span>Next: Import Bills</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Option A: Upload Invoices / Statement */}
              <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-[#151c19]/50 text-center space-y-2">
                <Upload className="h-6 w-6 text-slate-400 mx-auto" />
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs">
                    <span>Choose File (PDF Invoices or CSV)</span>
                    <input
                      type="file"
                      accept=".pdf,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">
                  Supports vendor PDF invoices, bank statements, and subscriptions CSV.
                </p>
                {isUploading && (
                  <div className="flex items-center justify-center gap-2 text-xs text-[#107e65]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Parsing line items...</span>
                  </div>
                )}
                {uploadError && (
                  <p className="text-xs text-rose-500">{uploadError}</p>
                )}
              </div>

              {/* Option B: Benchmark Stack */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Sparkles className="h-4 w-4 text-[#107e65] shrink-0" />
                  <span>Don&apos;t have bills ready?</span>
                </div>
                <button
                  type="button"
                  onClick={handleLoadBenchmark}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#107e65] dark:text-[#34d399] bg-white dark:bg-slate-800 border border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Load Benchmark Stack
                </button>
              </div>

              {/* Status Preview */}
              {subscriptions.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#151c19] border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                    <span className="truncate">{fileName}</span>
                    <span className="text-[#107e65] font-bold">
                      ${totalSpend.toLocaleString()}/yr
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {subscriptions.length} recurring contracts ready for autonomous negotiation.
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  disabled={isSubmitting}
                >
                  &larr; Back to Profile
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={subscriptions.length === 0 || isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#107e65] hover:bg-[#0d6b55] text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating Organization...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup & Launch</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

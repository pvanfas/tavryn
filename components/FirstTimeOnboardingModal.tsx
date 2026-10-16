"use client";

import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  FileText,
  Files,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import { INDUSTRY_OPTIONS } from "@/lib/constants";
import {
  DEFAULT_POLICY_CONFIG,
  SubscriptionRow,
} from "@/lib/schemas";

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
    service: "Infrastructure & APM Pro",
    category: "cloud",
    annual_price: 37200,
    renewal_date: new Date(Date.now() + 14 * 86400000)
      .toISOString()
      .split("T")[0],
    seats: null,
    active_seats: null,
    usage_decline_pct: 31,
  },
  {
    vendor: "AWS",
    service: "Compute & Database Reservation",
    category: "cloud",
    annual_price: 24000,
    renewal_date: new Date(Date.now() + 45 * 86400000)
      .toISOString()
      .split("T")[0],
    seats: null,
    active_seats: null,
    usage_decline_pct: 18,
  },
  {
    vendor: "GitHub",
    service: "GitHub Enterprise Cloud",
    category: "software",
    annual_price: 12600,
    renewal_date: new Date(Date.now() + 35 * 86400000)
      .toISOString()
      .split("T")[0],
    seats: 50,
    active_seats: 38,
    usage_decline_pct: 24,
  },
];

interface FirstTimeOnboardingModalProps {
  currentBusinessIsReal?: boolean;
}

interface UploadedFileSummary {
  id: string;
  name: string;
  size: number;
  status: "parsing" | "success" | "error";
  vendorDetected?: string;
  annualPrice?: number;
  error?: string;
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileSummary[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function checkFirstTimeStatus() {
      try {
        const user = await getCurrentUser();
        if (
          !user ||
          user.id === "00000000-0000-0000-0000-000000000001" ||
          user.id === "demo-user-001" ||
          user.email === "demo@tavryn.io"
        ) {
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
    setUploadedFiles([
      {
        id: "benchmark-stack",
        name: "Benchmark Enterprise Stack (5 SaaS Contracts)",
        size: 0,
        status: "success",
        vendorDetected: "Salesforce, Slack, Datadog & more",
        annualPrice: BENCHMARK_SUBSCRIPTIONS.reduce((s, r) => s + r.annual_price, 0),
      },
    ]);
    setUploadError(null);
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    // Filter valid files (pdf, csv, image)
    const validFiles = files.filter((f) => {
      const ext = f.name.toLowerCase();
      return (
        ext.endsWith(".pdf") ||
        ext.endsWith(".csv") ||
        ext.endsWith(".png") ||
        ext.endsWith(".jpg") ||
        ext.endsWith(".jpeg")
      );
    });

    if (validFiles.length === 0) {
      setUploadError("Please upload PDF invoices or CSV statements.");
      setIsUploading(false);
      return;
    }

    const newFileSummaries: UploadedFileSummary[] = validFiles.map((f) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name,
      size: f.size,
      status: "parsing",
    }));

    setUploadedFiles((prev) => [...prev, ...newFileSummaries]);

    let newlyDetectedRows: SubscriptionRow[] = [];
    let successCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const summaryId = newFileSummaries[i].id;
      setUploadProgressText(
        validFiles.length > 1
          ? `Parsing ${i + 1} of ${validFiles.length}: ${file.name}...`
          : `Parsing ${file.name}...`,
      );

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

        const detected: any[] = data.detected || [];
        if (detected.length === 0) {
          throw new Error("No subscription line items detected in document");
        }

        const parsedRows: SubscriptionRow[] = detected.map((item) => ({
          vendor: item.vendor || "Enterprise Vendor",
          service: item.service || `${item.vendor} License`,
          category: (item.category as any) || "software",
          annual_price: Number(item.annual_price) || 12000,
          renewal_date:
            item.renewal_date ||
            new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
          seats: item.seats != null ? Number(item.seats) : null,
          active_seats: item.active_seats != null ? Number(item.active_seats) : null,
          usage_decline_pct:
            item.usage_decline_pct != null ? Number(item.usage_decline_pct) : null,
        }));

        newlyDetectedRows = [...newlyDetectedRows, ...parsedRows];
        const primaryItem = detected[0];

        setUploadedFiles((prev) =>
          prev.map((item) =>
            item.id === summaryId
              ? {
                  ...item,
                  status: "success",
                  vendorDetected:
                    detected.length > 1
                      ? `${primaryItem.vendor} (+${detected.length - 1} items)`
                      : primaryItem.vendor,
                  annualPrice: parsedRows.reduce((sum, r) => sum + r.annual_price, 0),
                }
              : item,
          ),
        );
        successCount++;
      } catch (err: any) {
        setUploadedFiles((prev) =>
          prev.map((item) =>
            item.id === summaryId
              ? {
                  ...item,
                  status: "error",
                  error: err.message || "Failed to parse document",
                }
              : item,
          ),
        );
      }
    }

    if (newlyDetectedRows.length > 0) {
      setSubscriptions((prev) => {
        // Merge without duplicate (vendor + service)
        const existingKeys = new Set(
          prev.map((r) => `${r.vendor.toLowerCase()}-${r.service.toLowerCase()}`),
        );
        const toAdd = newlyDetectedRows.filter(
          (r) =>
            !existingKeys.has(`${r.vendor.toLowerCase()}-${r.service.toLowerCase()}`),
        );
        return [...prev, ...toAdd];
      });
    } else if (successCount === 0) {
      setUploadError(
        "Could not extract contracts from the uploaded file(s). You can load the benchmark stack or try other PDFs.",
      );
    }

    setIsUploading(false);
    setUploadProgressText(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleRemoveSubscription = (index: number) => {
    setSubscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveFile = (fileId: string) => {
    const fileToRemove = uploadedFiles.find((f) => f.id === fileId);
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (fileToRemove?.vendorDetected) {
      setSubscriptions((prev) =>
        prev.filter(
          (s) =>
            !s.vendor.toLowerCase().includes(fileToRemove.vendorDetected!.toLowerCase()) &&
            !fileToRemove.vendorDetected!.toLowerCase().includes(s.vendor.toLowerCase()),
        ),
      );
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
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/90 dark:border-slate-800/90 shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-linear-to-r from-emerald-500/10 via-teal-500/5 to-transparent flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#107e65]/10 dark:bg-[#107e65]/20 flex items-center justify-center border border-[#107e65]/20">
              <Building2 className="h-5 w-5 text-[#107e65] dark:text-[#34d399]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Welcome to Tavryn</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#107e65]/10 text-[#107e65] dark:text-[#34d399]">
                  Step {step} of 2
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 1
                  ? "Set up your organization workspace"
                  : "Import bills, contracts & PDF invoices"}
              </p>
            </div>
          </div>
          {currentBusinessIsReal && (
            <button
              onClick={handleClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Dismiss setup"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {submitError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] mx-auto flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Workspace Initialized!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {companyName}
                </span>{" "}
                is live with {subscriptions.length} recurring contracts ready for autonomous AI negotiation.
              </p>
            </div>
          ) : step === 1 ? (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Company or Organization Name
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

              <div className="pt-2 flex items-center justify-end">
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
              {/* Option A: Multiple PDF Upload Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative p-5 rounded-2xl border-2 border-dashed transition-all text-center space-y-2.5 ${
                  isDragging
                    ? "border-[#107e65] bg-emerald-500/10 dark:bg-emerald-500/15 ring-2 ring-[#107e65]/30"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-[#151c19]/60 hover:border-slate-400 dark:hover:border-slate-600"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] mx-auto flex items-center justify-center border border-emerald-500/20">
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Files className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {isDragging
                      ? "Drop your PDF invoices here"
                      : "Drag & drop multiple PDF invoices or contracts"}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Select single or multiple PDFs at once (AWS, Slack, Datadog, Salesforce, etc.)
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="onboarding-multi-pdf-input"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#107e65] dark:text-[#34d399]" />
                    <span>Browse PDF Files (Multiple)</span>
                    <input
                      id="onboarding-multi-pdf-input"
                      type="file"
                      multiple
                      accept=".pdf,.csv,application/pdf,text/csv"
                      onChange={handleFileInputChange}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                </div>

                {isUploading && (
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#107e65] dark:text-[#34d399] pt-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{uploadProgressText || "Parsing contracts..."}</span>
                  </div>
                )}

                {uploadError && (
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                    {uploadError}
                  </div>
                )}
              </div>

              {/* Uploaded Documents List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Uploaded Documents ({uploadedFiles.length})
                    </span>
                    <label
                      htmlFor="onboarding-multi-pdf-input-more"
                      className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold text-[#107e65] dark:text-[#34d399] hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add more PDFs</span>
                      <input
                        id="onboarding-multi-pdf-input-more"
                        type="file"
                        multiple
                        accept=".pdf,.csv,application/pdf,text/csv"
                        onChange={handleFileInputChange}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {uploadedFiles.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#151c19] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[240px]">
                              {f.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {f.size > 0
                                ? `${(f.size / 1024).toFixed(0)} KB`
                                : "Demo Package"}
                              {f.vendorDetected && (
                                <span className="ml-1.5 text-[#107e65] dark:text-[#34d399] font-medium">
                                  &bull; {f.vendorDetected}
                                  {f.annualPrice
                                    ? ` ($${f.annualPrice.toLocaleString()}/yr)`
                                    : ""}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {f.status === "parsing" ? (
                            <Loader2 className="h-4 w-4 text-[#107e65] animate-spin" />
                          ) : f.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(f.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected Subscriptions Preview */}
              {subscriptions.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#151c19] border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#107e65]" />
                      <span>{subscriptions.length} Detected Contracts</span>
                    </span>
                    <span className="text-[#107e65] dark:text-[#34d399] text-sm">
                      ${totalSpend.toLocaleString()}/yr
                    </span>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {subscriptions.map((sub, idx) => (
                      <div
                        key={`${sub.vendor}-${sub.service}-${idx}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {sub.vendor}
                          </span>
                          <span className="text-slate-400 mx-1.5">&bull;</span>
                          <span className="text-slate-600 dark:text-slate-300 truncate">
                            {sub.service}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-slate-900 dark:text-white">
                            ${sub.annual_price.toLocaleString()}/yr
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubscription(idx)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove contract"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Option B: Benchmark Stack Alternative */}
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

              {/* Navigation Actions */}
              <div className="pt-2 flex items-center justify-between shrink-0">
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
                      <span>Complete Setup & Launch ({subscriptions.length})</span>
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

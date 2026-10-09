"use client";

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { BusinessItem } from "@/components/BusinessSwitcher";
import { clearAuthCookie, getBrowserSupabase } from "@/lib/auth";
import { ARC_CONFIG } from "@/lib/circle";
import { DEV_TREASURY_ADDRESS } from "@/lib/constants";

export interface PolicyState {
  max_auto_transaction: number;
  min_savings: number;
  human_approval_required_above: number;
  allowed_categories: string[];
  category_budgets: Record<string, number>;
}

export interface BusinessState {
  id: string;
  name: string;
  wallet_address: string | null;
  default_currency: string;
  is_real: boolean;
  treasury_balance: number;
  webhook_url: string | null;
}

interface SettingsClientProps {
  initialBusiness: BusinessState | null;
  initialPolicy: PolicyState;
  businesses: BusinessItem[];
  activeBusinessId?: string;
}

export function SettingsClient({
  initialBusiness,
  initialPolicy,
  businesses,
  activeBusinessId,
}: SettingsClientProps) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [webhookMsg, setWebhookMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [business, setBusiness] = useState<BusinessState | null>(
    initialBusiness,
  );
  const [webhookUrl, setWebhookUrl] = useState(
    initialBusiness?.webhook_url || "",
  );
  const [policy, setPolicy] = useState<PolicyState>(initialPolicy);

  // Sync state if initial props change (e.g., when switching active business)
  useEffect(() => {
    setBusiness(initialBusiness);
    setWebhookUrl(initialBusiness?.webhook_url || "");
    setPolicy(initialPolicy);
  }, [initialBusiness?.id, initialPolicy]);

  const handleCopy = (text: string, field: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleCategoryToggle = (cat: string) => {
    const exists = policy.allowed_categories.includes(cat);
    if (exists) {
      if (policy.allowed_categories.length === 1) return;
      setPolicy({
        ...policy,
        allowed_categories: policy.allowed_categories.filter((c) => c !== cat),
      });
    } else {
      setPolicy({
        ...policy,
        allowed_categories: [...policy.allowed_categories, cat],
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/business/${business.id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhookUrl.trim() || "",
          policy,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to update settings");
      }

      setSuccessMsg("Settings and deterministic policy updated successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!business || !webhookUrl.trim()) {
      setWebhookMsg({
        type: "error",
        text: "Please enter a valid webhook URL first.",
      });
      return;
    }

    try {
      setTestingWebhook(true);
      setWebhookMsg(null);

      const res = await fetch(`/api/business/${business.id}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_url: webhookUrl.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to test webhook");
      }

      setWebhookMsg({
        type: json.data?.sent ? "success" : "error",
        text: json.data?.message || "Webhook test complete.",
      });
    } catch (err) {
      setWebhookMsg({ type: "error", text: (err as Error).message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const isDemo = business?.id === "b655fb94-fc62-4e3c-8898-2c5f88068159";

  const handleDeleteAccount = async () => {
    if (!business) return;
    const normalizedInput = confirmInput.trim().toLowerCase();
    const isConfirmed =
      normalizedInput === "delete my account" ||
      normalizedInput === business.name.trim().toLowerCase();

    if (!isConfirmed) {
      setDeleteError(`Please type "delete my account" exactly to confirm.`);
      return;
    }

    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/business/${business.id}/settings`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirmInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || data.error || "Failed to delete account",
        );
      }

      setShowDeleteModal(false);
      setSuccessMsg(
        "Your account and all associated workspace data have been permanently deleted.",
      );

      // Sign out and redirect to login
      clearAuthCookie();
      try {
        const supabase = getBrowserSupabase();
        await supabase.auth.signOut();
      } catch {}

      setTimeout(() => {
        router.push("/auth/login");
        router.refresh();
      }, 1000);
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const availableCategories = [
    "software",
    "cloud",
    "contractors",
    "infrastructure",
    "legal",
    "marketing",
  ];

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={business?.is_real ?? false}
      businesses={
        businesses.length > 0 ? businesses : business ? [business] : []
      }
      activeBusinessId={business?.id || activeBusinessId}
      treasuryBalance={business?.treasury_balance ?? 0}
      walletAddress={business?.wallet_address}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings" },
      ]}
      currency={business?.default_currency || "USDC"}
    >
      <div className="max-w-4xl mx-auto space-y-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/70 dark:border-slate-800/70">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Organization Settings
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Configure deterministic spending policies, Arc treasury wallets,
              and notification alerts
            </p>
          </div>

          {business && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 self-start sm:self-auto">
              <Building2 className="h-3.5 w-3.5 text-[#107e65]" />
              <span>{business.name}</span>
              {business.is_real ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-[#107e65] font-extrabold uppercase">
                  Verified
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 font-extrabold uppercase">
                  Demo
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-7">
          {/* Section 1: Arc Treasury Wallet Card */}
          <div
            id="treasury"
            className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-4 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#107e65]/10 flex items-center justify-center text-[#107e65]">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Arc Treasury Settlement Wallet
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Smart Contract Account (SCA) deployed on Arc Testnet for
                    USDC escrow and payments
                  </p>
                </div>
              </div>

              {business?.wallet_address && (
                <a
                  href={`${ARC_CONFIG.explorerUrl}/address/${business.wallet_address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-[#107e65] dark:text-[#34d399] flex items-center gap-1 hover:underline shrink-0"
                >
                  <span>Arcscan</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 select-all break-all">
                {business?.wallet_address || DEV_TREASURY_ADDRESS}
              </code>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    business?.wallet_address || DEV_TREASURY_ADDRESS,
                    "wallet",
                  )
                }
                className="px-3.5 py-2.5 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedField === "wallet" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedField === "wallet" ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-slate-500">Network:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Arc Testnet (5042002)
                </span>
              </div>
              <div>
                <span className="text-slate-500">Token:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  USDC (ERC-20 Precompile)
                </span>
              </div>
              <div>
                <span className="text-slate-500">Recorded Balance:</span>{" "}
                <span className="font-bold text-[#107e65] dark:text-[#34d399] font-mono">
                  ${Number(business?.treasury_balance ?? 0).toLocaleString()}{" "}
                  USDC
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Deterministic Policy Configuration */}
          <div
            id="policy"
            className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-4 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-6"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#107e65]/10 flex items-center justify-center text-[#107e65]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Deterministic Procurement Policy Engine
                </h2>
                <p className="text-[11px] text-slate-500">
                  Pure code boundaries enforced server-side. The AI agent cannot
                  approve its own spend.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Autonomous Ceiling ($)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Max transaction approved without human signature
                </p>
                <input
                  id="settings-max-auto"
                  type="number"
                  value={policy.max_auto_transaction}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      max_auto_transaction: Number(e.target.value),
                    })
                  }
                  className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#107e65]"
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Min Savings Threshold ($)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Minimum dollar savings required to renegotiate
                </p>
                <input
                  id="settings-min-savings"
                  type="number"
                  value={policy.min_savings}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      min_savings: Number(e.target.value),
                    })
                  }
                  className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#107e65]"
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Human Approval Required ($)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Transactions above this require manual sign-off
                </p>
                <input
                  id="settings-human-ceiling"
                  type="number"
                  value={policy.human_approval_required_above}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      human_approval_required_above: Number(e.target.value),
                    })
                  }
                  className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#107e65]"
                />
              </div>
            </div>

            {/* Category Toggles */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Allowed Procurement Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((cat) => {
                  const active = policy.allowed_categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryToggle(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? "bg-[#107e65] text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Notification Webhooks */}
          <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-4 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#107e65]/10 flex items-center justify-center text-[#107e65] shrink-0 mt-0.5">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Per-Business Notification Webhook
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Receive live notifications in Slack, Discord, or custom
                  systems when the agent detects waste or settles contracts
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Webhook Endpoint URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="settings-webhook-url"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 min-w-0 text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#107e65]/20 focus:border-[#107e65]"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !webhookUrl.trim()}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {testingWebhook ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 text-[#107e65]" />
                  )}
                  <span>Test Webhook</span>
                </button>
              </div>

              {webhookMsg && (
                <p
                  className={`mt-2 text-xs font-semibold ${webhookMsg.type === "success" ? "text-[#107e65] dark:text-[#34d399]" : "text-rose-600 dark:text-rose-400"}`}
                >
                  {webhookMsg.text}
                </p>
              )}
            </div>
          </div>

          {/* Section 4: Branded Auth Email Templates */}
          <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-4 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[#107e65]/10 flex items-center justify-center text-[#107e65] shrink-0 mt-0.5">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Branded Auth Email Templates
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                      Supabase GoTrue Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Preview and copy production-ready HTML email templates
                    (Magic Link, OTP, Password Reset, Team Invite) styled with
                    Tavryn&apos;s emerald brand design.
                  </p>
                </div>
              </div>

              <Link
                href="/settings/email-templates"
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
              >
                <span>Open Studio</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#107e65]" />
              </Link>
            </div>
          </div>

          {/* Section 5: Danger Zone */}
          <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-rose-200/80 dark:border-rose-900/50 p-4 sm:p-7 shadow-[0_4px_20px_rgba(225,29,72,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                <Trash2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                  Danger Zone
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Permanently delete this organization and purge all associated
                  contracts, transactions, policies, and receipts
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[11px]">
                  Delete my Account
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Permanently delete your account, authentication credentials,
                  and all associated workspace data for{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {business?.name || "this organization"}
                  </span>
                  . This action is irreversible.
                </p>
              </div>

              {isDemo ? (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 cursor-not-allowed shrink-0 border border-slate-200/60 dark:border-slate-700">
                  Protected Demo Account
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmInput("");
                    setDeleteError(null);
                    setShowDeleteModal(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete my Account</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>
                {saving ? "Saving Changes…" : "Save Policy & Settings"}
              </span>
            </button>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && business && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#111714] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Delete my Account
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300 space-y-1.5">
                <p className="font-semibold">
                  All account access and records will be permanently wiped:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-700 dark:text-rose-400">
                  <li>Your user login credentials and session tokens</li>
                  <li>
                    All active contracts, negotiations, and conversation logs
                  </li>
                  <li>All on-chain settlement receipts and transactions</li>
                  <li>
                    Spending policies, category budgets, and treasury settings
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirm-delete-account"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Please type{" "}
                  <span className="font-bold text-slate-900 dark:text-white select-all">
                    &quot;delete my account&quot;
                  </span>{" "}
                  to confirm:
                </label>
                <input
                  id="confirm-delete-account"
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="delete my account"
                  autoFocus
                  className="w-full text-xs font-mono px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                />
                {deleteError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                    {deleteError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!deleting) setShowDeleteModal(false);
                  }}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={
                    deleting ||
                    (confirmInput.trim().toLowerCase() !==
                      "delete my account" &&
                      confirmInput.trim().toLowerCase() !==
                        business.name.trim().toLowerCase())
                  }
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Deleting…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete my Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

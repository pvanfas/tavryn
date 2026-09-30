"use client";

import { ARC_CONFIG } from "@/lib/circle";
import { DEV_TREASURY_ADDRESS } from "@/lib/constants";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  ShieldCheck,
  Bell,
  Wallet,
  ExternalLink,
  Copy,
  Check,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
  Building2,
} from "lucide-react";

interface PolicyState {
  max_auto_transaction: number;
  min_savings: number;
  human_approval_required_above: number;
  allowed_categories: string[];
  category_budgets: Record<string, number>;
}

interface BusinessState {
  id: string;
  name: string;
  wallet_address: string | null;
  default_currency: string;
  is_real: boolean;
  treasury_balance: number;
  webhook_url: string | null;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const businessIdParam = searchParams.get("businessId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [webhookMsg, setWebhookMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [business, setBusiness] = useState<BusinessState | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [policy, setPolicy] = useState<PolicyState>({
    max_auto_transaction: 2000,
    min_savings: 200,
    human_approval_required_above: 2000,
    allowed_categories: ["software", "cloud", "contractors"],
    category_budgets: { software: 25000, cloud: 50000, contractors: 25000 },
  });

  // Fetch businesses and active business settings
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Resolve target business ID (default to Demo Co)
        let targetId = businessIdParam;
        if (!targetId) {
          targetId = "b655fb94-fc62-4e3c-8898-2c5f88068159";
        }

        const res = await fetch(`/api/business/${targetId}/settings`);
        if (!res.ok) {
          // If not found, fallback to Demo Co
          const fallbackRes = await fetch(`/api/business/b655fb94-fc62-4e3c-8898-2c5f88068159/settings`);
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            if (mounted && data.data) {
              setBusiness(data.data.business);
              setWebhookUrl(data.data.business.webhook_url || "");
              if (data.data.policy) {
                setPolicy({
                  max_auto_transaction: data.data.policy.max_auto_transaction ?? 2000,
                  min_savings: data.data.policy.min_savings ?? 200,
                  human_approval_required_above: data.data.policy.human_approval_required_above ?? 2000,
                  allowed_categories: data.data.policy.allowed_categories || ["software", "cloud"],
                  category_budgets: data.data.policy.category_budgets || { software: 25000, cloud: 50000 },
                });
              }
            }
          }
          return;
        }

        const data = await res.json();
        if (mounted && data.data) {
          setBusiness(data.data.business);
          setWebhookUrl(data.data.business.webhook_url || "");
          if (data.data.policy) {
            setPolicy({
              max_auto_transaction: data.data.policy.max_auto_transaction ?? 2000,
              min_savings: data.data.policy.min_savings ?? 200,
              human_approval_required_above: data.data.policy.human_approval_required_above ?? 2000,
              allowed_categories: data.data.policy.allowed_categories || ["software", "cloud"],
              category_budgets: data.data.policy.category_budgets || { software: 25000, cloud: 50000 },
            });
          }
        }
      } catch (err) {
        if (mounted) setError((err as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [businessIdParam]);

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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!business || !webhookUrl.trim()) {
      setWebhookMsg({ type: "error", text: "Please enter a valid webhook URL first." });
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

  const availableCategories = ["software", "cloud", "contractors", "infrastructure", "legal", "marketing"];

  return (
    <AppShell
      businessName={business?.name || "Organization"}
      isReal={business?.is_real ?? false}
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
              Configure deterministic spending policies, Arc treasury wallets, and notification alerts
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

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-[#107e65] animate-spin" />
            <span className="text-xs text-slate-500 font-medium">Loading organization configuration…</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-7">
            {/* Section 1: Arc Treasury Wallet Card */}
            <div id="treasury" className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-4">
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
                      Smart Contract Account (SCA) deployed on Arc Testnet for USDC escrow and payments
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
                  onClick={() => handleCopy(business?.wallet_address || DEV_TREASURY_ADDRESS, "wallet")}
                  className="px-3.5 py-2.5 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copiedField === "wallet" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedField === "wallet" ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-500">Network:</span>{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Arc Testnet (5042002)</span>
                </div>
                <div>
                  <span className="text-slate-500">Token:</span>{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">USDC (ERC-20 Precompile)</span>
                </div>
                <div>
                  <span className="text-slate-500">Recorded Balance:</span>{" "}
                  <span className="font-bold text-[#107e65] dark:text-[#34d399] font-mono">
                    ${Number(business?.treasury_balance ?? 0).toLocaleString()} USDC
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Deterministic Policy Configuration */}
            <div id="policy" className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#107e65]/10 flex items-center justify-center text-[#107e65]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Deterministic Procurement Policy Engine
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Pure code boundaries enforced server-side. The AI agent cannot approve its own spend.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Autonomous Ceiling ($)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">Max transaction approved without human signature</p>
                  <input
                    id="settings-max-auto"
                    type="number"
                    value={policy.max_auto_transaction}
                    onChange={(e) => setPolicy({ ...policy, max_auto_transaction: Number(e.target.value) })}
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#107e65]"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Min Savings Threshold ($)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">Minimum dollar savings required to renegotiate</p>
                  <input
                    id="settings-min-savings"
                    type="number"
                    value={policy.min_savings}
                    onChange={(e) => setPolicy({ ...policy, min_savings: Number(e.target.value) })}
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#107e65]"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Human Approval Required ($)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">Transactions above this require manual sign-off</p>
                  <input
                    id="settings-human-ceiling"
                    type="number"
                    value={policy.human_approval_required_above}
                    onChange={(e) => setPolicy({ ...policy, human_approval_required_above: Number(e.target.value) })}
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
            <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#107e65]/10 flex items-center justify-center text-[#107e65]">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Per-Business Notification Webhook
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Receive live notifications in Slack, Discord, or custom systems when the agent detects waste or settles contracts
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Webhook Endpoint URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="settings-webhook-url"
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/services/..."
                    className="flex-1 text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#107e65]/20 focus:border-[#107e65]"
                  />
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testingWebhook || !webhookUrl.trim()}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
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
                  <p className={`mt-2 text-xs font-semibold ${webhookMsg.type === "success" ? "text-[#107e65] dark:text-[#34d399]" : "text-rose-600 dark:text-rose-400"}`}>
                    {webhookMsg.text}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? "Saving Changes…" : "Save Policy & Settings"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#107e65] animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}

"use client";

import {
  Check,
  Code,
  Copy,
  ExternalLink,
  Laptop,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import {
  AUTH_EMAIL_METADATA,
  AuthEmailType,
  renderAuthEmail,
} from "@/lib/email/auth-templates";

export default function EmailTemplatesStudioPage() {
  const [selectedType, setSelectedType] = useState<AuthEmailType>("magic_link");
  const [viewport, setViewport] = useState<"desktop" | "mobile" | "raw">(
    "desktop",
  );
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);

  const activeMeta = AUTH_EMAIL_METADATA[selectedType];

  // Render GoTrue version for copying into Supabase
  const gotrueHtml = useMemo(() => {
    return renderAuthEmail(selectedType, { mode: "gotrue" });
  }, [selectedType]);

  // Render preview version with realistic sample data
  const previewHtml = useMemo(() => {
    return renderAuthEmail(selectedType, {
      mode: "preview",
      email: "finance-lead@acmecorp.com",
      token: "749102",
      orgName: "Acme Finance Operations",
      inviterName: "Sarah Chen",
    });
  }, [selectedType]);

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(gotrueHtml);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2200);
    } catch {
      // ignore
    }
  };

  const handleCopySubject = async () => {
    try {
      await navigator.clipboard.writeText(activeMeta.defaultSubject);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2200);
    } catch {
      // ignore
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/settings" },
        { label: "Auth Email Templates" },
      ]}
      currency="USDC"
    >
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-6">
          <PageHeader
            badge="Brand & Communications"
            caption="Supabase GoTrue &bull; Arc L1 &bull; Circle USDC"
            title="Branded Auth Email Studio"
            description="Preview and export production-ready HTML email templates styled with Tavryn's signature emerald palette, clean single-click authentication buttons, and bulletproof Outlook/Gmail tables."
          />

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopySubject}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shadow-2xs"
            >
              {copiedSubject ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Subject Copied
                  </span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy Subject</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyHtml}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold transition-all shadow-xs"
            >
              {copiedHtml ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>GoTrue HTML Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Template HTML</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Template Selector Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(Object.keys(AUTH_EMAIL_METADATA) as AuthEmailType[]).map(
            (typeKey) => {
              const meta = AUTH_EMAIL_METADATA[typeKey];
              const isSelected = selectedType === typeKey;

              return (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setSelectedType(typeKey)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white dark:bg-[#121915] border-[#107e65] shadow-sm ring-1 ring-[#107e65]/40"
                      : "bg-white/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-[#107e65]/15 text-[#107e65] dark:text-[#34d399]"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {meta.category}
                    </span>
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-[#107e65] shrink-0" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {meta.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                    Supabase: {meta.supabaseTemplateName}
                  </div>
                </button>
              );
            },
          )}
        </div>

        {/* Main Preview Container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Interactive Viewport Preview */}
          <div className="lg:col-span-2 space-y-3">
            {/* Viewport Control Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-[#107e65]" />
                  <span>{activeMeta.title}</span>
                </span>
                <span className="text-slate-300 dark:text-slate-700">
                  &bull;
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                  Subject: &ldquo;{activeMeta.defaultSubject}&rdquo;
                </span>
              </div>

              {/* Viewport Tabs */}
              <div className="flex items-center p-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setViewport("desktop")}
                  title="Desktop View (600px)"
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    viewport === "desktop"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Laptop className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewport("mobile")}
                  title="Mobile View (375px)"
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    viewport === "mobile"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewport("raw")}
                  title="Raw HTML Source"
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    viewport === "raw"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Code className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Source</span>
                </button>
              </div>
            </div>

            {/* Viewport Frame */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#090e0b] p-4 sm:p-6 flex justify-center min-h-[640px] overflow-hidden">
              {viewport === "raw" ? (
                <div className="w-full h-[620px] overflow-auto rounded-xl bg-slate-950 p-4 border border-slate-800 text-slate-300 font-mono text-[11px] leading-relaxed select-all">
                  <pre>{gotrueHtml}</pre>
                </div>
              ) : (
                <div
                  className={`transition-all duration-300 h-[620px] rounded-xl shadow-lg border border-slate-200/80 dark:border-slate-800 bg-white overflow-hidden ${
                    viewport === "mobile" ? "w-[375px]" : "w-full max-w-[600px]"
                  }`}
                >
                  <iframe
                    title={`${activeMeta.title} preview`}
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Setup Instructions & Metadata */}
          <div className="space-y-4">
            {/* Guide Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-[#107e65]" />
                <span>How to apply to Supabase</span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Supabase Auth automatically dispatches these emails through its
                built-in GoTrue mailer or your custom SMTP (Resend, SendGrid,
                Postmark).
              </p>

              <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5 list-decimal pl-4">
                <li>
                  Go to your{" "}
                  <strong className="text-slate-900 dark:text-white">
                    Supabase Dashboard
                  </strong>{" "}
                  &rarr;{" "}
                  <strong className="text-[#107e65] dark:text-[#34d399]">
                    Authentication
                  </strong>
                  .
                </li>
                <li>
                  Click{" "}
                  <strong className="text-slate-900 dark:text-white">
                    Email Templates
                  </strong>{" "}
                  in the left sidebar.
                </li>
                <li>
                  Select the{" "}
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#107e65] font-mono text-[11px]">
                    {activeMeta.supabaseTemplateName}
                  </code>{" "}
                  tab.
                </li>
                <li>
                  Paste the Subject Line and replace the default body with the{" "}
                  <strong>GoTrue HTML</strong> copied from above.
                </li>
                <li>
                  Click <strong>Save changes</strong>.
                </li>
              </ol>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#107e65]" />
                  <span>
                    Supported variables:{" "}
                    <code className="font-mono">
                      &#123;&#123; .ConfirmationURL &#125;&#125;
                    </code>
                    ,{" "}
                    <code className="font-mono">
                      &#123;&#123; .Email &#125;&#125;
                    </code>
                  </span>
                </div>
              </div>
            </div>

            {/* Design Specifications Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Design Specifications
              </h3>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <li className="flex items-center justify-between">
                  <span>Primary Color:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#107e65]" />
                    #107e65 (Emerald)
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Layout Width:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    560px responsive
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>CTA Buttons:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Bulletproof Table + VML
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Auth Action:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Single-Click Link
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Email Clients:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Apple, Gmail, Outlook, iOS
                  </span>
                </li>
              </ul>
            </div>

            {/* Link back to settings or documentation */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Need to configure SMTP provider?
              </span>
              <Link
                href="/settings"
                className="text-xs font-bold text-[#107e65] dark:text-[#34d399] hover:underline flex items-center gap-1"
              >
                Settings
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

import React from "react";
import { getServiceSupabase } from "@/lib/supabase";
import { verifyAuditChain } from "@/lib/tools/audit";
import { AppShell } from "@/components/AppShell";
import { 
  ShieldCheck, 
  ShieldAlert, 
} from "lucide-react";
import { Caption } from "@/components/ui/text";
import { AuditTableClient } from "./AuditTableClient";

export const revalidate = 0; // Fresh verification on every request

interface AuditPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const supabase = getServiceSupabase();
  const { businessId } = await searchParams;

  // 1. Fetch businesses for AppShell
  const { data: bList } = await supabase
    .from("businesses")
    .select("id, name, is_real, treasury_balance, default_currency, wallet_address")
    .order("created_at", { ascending: false });

  const businesses = bList || [];
  let business = businesses.find((b) => b.id === businessId) || null;
  if (!business && businesses.length > 0) {
    business = businesses.find((b) => b.name === "Demo Co") || businesses[0];
  }

  // 2. Perform server-side cryptographic audit chain verification
  const verification = await verifyAuditChain(undefined, 100);

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={Boolean(business?.is_real)}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Audit Ledger" },
      ]}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={Number(business?.treasury_balance ?? 0)}
      currency={business?.default_currency || "USDC"}
    >
      {/* Top Integrity Status Banner */}
      <div className="mb-6">
        {verification.isValid ? (
          <div className="rounded-2xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12] border border-emerald-500/25 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] shrink-0 mt-0.5">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Cryptographic Audit Chain: 100% Verified
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#107e65] text-white">
                    Sound
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  All {verification.totalBlocks} action blocks are sequentially linked via SHA-256 cryptographic hashes.
                  Database triggers strictly enforce append-only immutability; UPDATE and DELETE operations are physically blocked at the PostgreSQL engine level.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-emerald-500/20">
              <div className="text-right">
                <Caption className="text-slate-500 dark:text-slate-400 uppercase">Algorithm</Caption>
                <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">SHA-256 Chained</div>
              </div>
              <div className="text-right pl-4 border-l border-emerald-500/20">
                <Caption className="text-slate-500 dark:text-slate-400 uppercase">Blocks Verified</Caption>
                <div className="font-mono text-xs font-bold text-[#107e65] dark:text-[#34d399]">{verification.totalBlocks}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-rose-500/[0.08] dark:bg-rose-500/[0.15] border border-rose-500/30 p-5 sm:p-6 flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-rose-700 dark:text-rose-300">
                  Cryptographic Chain Compromised
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white">
                  Broken Link
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">
                {verification.reason || "Hash mismatch detected between consecutive audit blocks."}
              </p>
              {verification.brokenBlockId && (
                <div className="mt-2 font-mono text-[11px] text-rose-700 dark:text-rose-300">
                  Compromised Block ID: {verification.brokenBlockId} (Index #{verification.brokenBlockIndex})
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Client Table */}
      <AuditTableClient blocks={verification.blocks} isValid={verification.isValid} />
    </AppShell>
  );
}

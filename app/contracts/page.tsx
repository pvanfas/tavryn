import { ArrowRight, FileText, PlusCircle } from "lucide-react";
import Link from "next/link";
import React from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { QuickInvoiceDropzone } from "@/components/QuickInvoiceDropzone";
import { Body, H2 } from "@/components/ui/text";
import { VendorLogo } from "@/components/VendorLogo";
import { getOnChainUSDCBalance } from "@/lib/circle";
import { ContractLike, evaluateContractOpportunity } from "@/lib/heuristics";
import { getServiceSupabase } from "@/lib/supabase";

export const revalidate = 0;

interface VendorRel {
  id?: string;
  name: string;
  category: string;
  contact: string | null;
  reputation_score: number | null;
  is_simulated: boolean | null;
  logo_url?: string | null;
}

interface ContractRecord extends ContractLike {
  id: string;
  business_id: string;
  vendor_id: string | null;
  vendors?: VendorRel | null;
}

interface ContractsPageProps {
  searchParams: Promise<{ businessId?: string; status?: string }>;
}

export default async function ContractsPage({
  searchParams,
}: ContractsPageProps) {
  const supabase = getServiceSupabase();
  const { businessId, status: selectedStatus } = await searchParams;

  // 1. Fetch businesses
  const { data: bData } = await supabase
    .from("businesses")
    .select(
      "id, name, is_real, treasury_balance, default_currency, wallet_address",
    )
    .not("name", "ilike", "[Deleted%")
    .order("created_at", { ascending: true });

  const businesses = bData || [];
  const business =
    businesses.find((b) => b.id === businessId) || businesses[0] || null;

  // 2. Fetch contracts, status counts, and on-chain balance concurrently
  let liveTreasuryBalance = business?.treasury_balance
    ? Number(business.treasury_balance)
    : 0;
  let rawContracts: ContractRecord[] = [];
  const statusCounts = {
    all: 0,
    active: 0,
    negotiating: 0,
    renewed: 0,
    cancelled: 0,
  };

  if (business) {
    let contractsQuery = supabase
      .from("contracts")
      .select("*, vendors(*)")
      .eq("business_id", business.id)
      .order("renewal_date", { ascending: true });

    if (selectedStatus && selectedStatus !== "all") {
      contractsQuery = contractsQuery.eq("status", selectedStatus);
    }

    const statusesQuery = supabase
      .from("contracts")
      .select("status")
      .eq("business_id", business.id);

    const balancePromise = business.wallet_address
      ? getOnChainUSDCBalance(business.wallet_address).catch(() => liveTreasuryBalance)
      : Promise.resolve(liveTreasuryBalance);

    const [cRes, sRes, balRes] = await Promise.all([
      contractsQuery,
      statusesQuery,
      balancePromise,
    ]);

    if (cRes.data) {
      rawContracts = cRes.data as unknown as ContractRecord[];
    }
    if (sRes.data) {
      statusCounts.all = sRes.data.length;
      for (const item of sRes.data) {
        if (item.status in statusCounts) {
          statusCounts[item.status as keyof typeof statusCounts]++;
        }
      }
    }
    liveTreasuryBalance = balRes;
  }

  const currentFilter = selectedStatus || "all";

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={business?.is_real ?? false}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={liveTreasuryBalance}
      currency={business?.default_currency || "USDC"}
      breadcrumbs={[
        { label: "Overview", href: "/" },
        { label: "Contracts Ledger" },
      ]}
    >
      <div className="space-y-6">
        {/* Minimal Reusable Page Header */}
        <PageHeader
          badge="Records"
          caption="All Enterprise Renewals"
          title="Contracts Ledger"
          description="All tracked vendor agreements, renewal cliffs, and calculated waste reduction potential."
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {business?.id && <QuickInvoiceDropzone businessId={business.id} />}
            <Link
              href="/import-bills"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Import Bills</span>
            </Link>
          </div>
        </PageHeader>

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          {[
            { id: "all", label: "All Contracts", count: statusCounts.all },
            { id: "active", label: "Active", count: statusCounts.active },
            {
              id: "negotiating",
              label: "Negotiating",
              count: statusCounts.negotiating,
            },
            { id: "renewed", label: "Renewed", count: statusCounts.renewed },
            {
              id: "cancelled",
              label: "Cancelled",
              count: statusCounts.cancelled,
            },
          ].map((tab) => {
            const isActive = currentFilter === tab.id;
            const queryParam = tab.id === "all" ? "" : `&status=${tab.id}`;
            const targetUrl = business
              ? `/contracts?businessId=${business.id}${queryParam}`
              : `/contracts?status=${tab.id}`;

            return (
              <Link
                key={tab.id}
                href={targetUrl}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Contracts Table or Empty State */}
        {rawContracts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-[#121915]/50 p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mx-auto flex items-center justify-center text-slate-400">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <H2 className="text-base font-bold text-slate-900 dark:text-white">
                No contracts found
              </H2>
              <Body className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {currentFilter !== "all"
                  ? `There are no contracts matching the "${currentFilter}" status filter.`
                  : "Onboard your subscription CSV to automatically detect renewal cliffs and waste."}
              </Body>
            </div>
            <Link
              href="/import-bills"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Import Bills</span>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#121915]/90 overflow-hidden shadow-xs">
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-4">Service & Vendor</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Renewal Date</th>
                    <th className="py-3.5 px-4">Current Spend</th>
                    <th className="py-3.5 px-4">Potential Savings</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {rawContracts.map((contract) => {
                    const opp = evaluateContractOpportunity(contract);
                    const renewalDate = new Date(contract.renewal_date);
                    const formattedDate = renewalDate.toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    );

                    return (
                      <tr
                        key={contract.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <VendorLogo
                              vendorId={contract.vendor_id}
                              vendorName={
                                contract.vendors?.name || contract.service
                              }
                              logoUrl={contract.vendors?.logo_url}
                              editable={true}
                              size="md"
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {contract.service}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {contract.vendors?.name || "Direct Vendor"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">
                            {contract.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {formattedDate}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                          ${Number(contract.current_price).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          {opp.saving > 0 ? (
                            <div className="flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              <span>${opp.saving.toLocaleString()}</span>
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-500 font-sans font-bold">
                                (
                                {Math.round(
                                  (opp.saving /
                                    (Number(contract.current_price) || 1)) *
                                    100,
                                )}
                                %)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              contract.status === "negotiating"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                : contract.status === "renewed"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                  : contract.status === "cancelled"
                                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                                    : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                contract.status === "negotiating"
                                  ? "bg-amber-500 animate-pulse"
                                  : contract.status === "renewed"
                                    ? "bg-emerald-500"
                                    : contract.status === "cancelled"
                                      ? "bg-rose-500"
                                      : "bg-blue-500"
                              }`}
                            />
                            <span>{contract.status}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/negotiate/${contract.id}`}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              Negotiate
                            </Link>
                            <Link
                              href={`/decision/${contract.id}`}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                              title="Inspect Decision"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
              {rawContracts.map((contract) => {
                const opp = evaluateContractOpportunity(contract);
                const renewalDate = new Date(contract.renewal_date);
                const formattedDate = renewalDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div key={contract.id} className="p-4 space-y-3">
                    {/* Header: Logo + Name + Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <VendorLogo
                          vendorId={contract.vendor_id}
                          vendorName={
                            contract.vendors?.name || contract.service
                          }
                          logoUrl={contract.vendors?.logo_url}
                          editable={true}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {contract.service}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {contract.vendors?.name || "Direct Vendor"}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize shrink-0 ${
                          contract.status === "negotiating"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            : contract.status === "renewed"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                              : contract.status === "cancelled"
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                                : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            contract.status === "negotiating"
                              ? "bg-amber-500 animate-pulse"
                              : contract.status === "renewed"
                                ? "bg-emerald-500"
                                : contract.status === "cancelled"
                                  ? "bg-rose-500"
                                  : "bg-blue-500"
                          }`}
                        />
                        <span>{contract.status}</span>
                      </span>
                    </div>

                    {/* 2×2 Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                          Category
                        </div>
                        <div className="font-medium text-slate-700 dark:text-slate-200 capitalize">
                          {contract.category}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                          Renewal
                        </div>
                        <div className="font-mono font-medium text-slate-700 dark:text-slate-200">
                          {formattedDate}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                          Spend
                        </div>
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          ${Number(contract.current_price).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                          Savings
                        </div>
                        {opp.saving > 0 ? (
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${opp.saving.toLocaleString()}
                          </div>
                        ) : (
                          <div className="text-slate-400">—</div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/negotiate/${contract.id}`}
                        className="flex-1 text-center px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        Negotiate
                      </Link>
                      <Link
                        href={`/decision/${contract.id}`}
                        className="flex-1 text-center px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors"
                      >
                        Inspect →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

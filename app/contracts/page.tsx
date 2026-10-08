import { PlusCircle } from "lucide-react";
import Link from "next/link";
import React from "react";

import { AppShell } from "@/components/AppShell";
import { ContractsDataTable } from "@/components/contracts/ContractsDataTable";
import { PageHeader } from "@/components/PageHeader";
import { QuickInvoiceDropzone } from "@/components/QuickInvoiceDropzone";
import { getOnChainUSDCBalance } from "@/lib/circle";
import { ContractLike } from "@/lib/heuristics";
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

        {/* Shared Contracts DataTable */}
        <ContractsDataTable
          contracts={rawContracts}
          businessId={business?.id}
        />
      </div>
    </AppShell>
  );
}

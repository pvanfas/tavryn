import Image from "next/image";
import { getServiceSupabase } from "@/lib/supabase";
import { evaluateContractOpportunity, ContractLike } from "@/lib/heuristics";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Building2, 
  DollarSign, 
  TrendingDown, 
  Calendar, 
  ShieldCheck, 
  Users, 
  Activity, 
  Clock,
  Layers
} from "lucide-react";

export const revalidate = 0; // Fresh data on each request

interface VendorRel {
  name: string;
  category: string;
  contact: string | null;
  reputation_score: number | null;
  is_simulated: boolean | null;
}

interface ContractRecord extends ContractLike {
  id: string;
  business_id: string;
  vendor_id: string | null;
  vendors?: VendorRel | null;
}

export default async function DashboardPage() {
  const supabase = getServiceSupabase();

  let business = null;
  let contracts: ContractRecord[] = [];
  let negotiationsCount = 0;
  let savingsRealized = 0;
  let policy = null;
  let isDbReady = true;

  try {
    // 1. Fetch Demo Co Business
    const { data: bData, error: bError } = await supabase
      .from("businesses")
      .select("*")
      .eq("name", "Demo Co")
      .maybeSingle();

    if (bError) throw bError;
    business = bData;

    // 2. Fetch Active Contracts with linked Vendors
    const { data: cData, error: cError } = await supabase
      .from("contracts")
      .select("*, vendors ( name, category, contact, reputation_score, is_simulated )")
      .order("renewal_date", { ascending: true });

    if (cError) throw cError;
    contracts = (cData as unknown as ContractRecord[]) || [];

    // 3. Fetch Realized Savings from Negotiations
    const { data: nData, error: nError } = await supabase
      .from("negotiations")
      .select("savings, status");

    if (!nError && nData) {
      negotiationsCount = nData.length;
      savingsRealized = nData.reduce((acc, row) => acc + (Number(row.savings) || 0), 0);
    }

    // 4. Fetch Active Policy
    if (business?.id) {
      const { data: pData } = await supabase
        .from("policies")
        .select("*")
        .eq("business_id", business.id)
        .maybeSingle();
      policy = pData;
    }
  } catch (err) {
    console.warn("Database query notice:", (err as Error).message);
    isDbReady = false;
  }

  // Live Metric Computations from Database Queries
  const treasuryBalance = Number(business?.treasury_balance ?? 0);
  const currency = business?.default_currency || "USDC";

  // Annualized contract spend converted to current month's estimated commitment
  const totalAnnualSpend = contracts.reduce(
    (acc, c) => acc + (c.status === "active" ? Number(c.current_price) : 0),
    0
  );
  const spendThisMonth = Math.round(totalAnnualSpend / 12);

  // Computations via deterministic placeholder heuristics
  const contractOpportunities = contracts.map((c) => {
    const opp = evaluateContractOpportunity(c);
    const renewalDate = new Date(c.renewal_date);
    const msDiff = renewalDate.getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

    return {
      ...c,
      savings: opp.saving,
      heuristicType: opp.heuristicType,
      explanation: opp.explanation,
      daysRemaining,
    };
  });

  const savingsDiscovered = contractOpportunities.reduce(
    (acc, opp) => acc + (opp.status === "active" ? opp.savings : 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Subtle Ambient Decorative Gradient (Light & Dark compatible) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-400/10 dark:bg-emerald-500/10 blur-3xl" />
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-teal-400/10 dark:bg-teal-500/10 blur-3xl" />
      </div>

      {/* Top Header / Navigation Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm ring-1 ring-slate-900/5">
              <Image
                src="/logo.png"
                alt="Tavryn Logo"
                width={36}
                height={36}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                  Tavryn
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Arc + Circle
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Autonomous SaaS & Cloud Procurement Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
              <Building2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-slate-500 dark:text-slate-400">Organization:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{business?.name || "Demo Co"}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse ml-1" />
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!isDbReady && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 text-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-200/60 dark:bg-amber-500/20">
              <Clock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold">Supabase schema initialization pending</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Run the database migration and seed script to populate live records from Supabase Postgres.
              </p>
            </div>
          </div>
        )}

        {/* Top Metric Cards Grid */}
        <section aria-label="Key Performance Indicators" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Treasury */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 shadow-sm dark:shadow-xl backdrop-blur-md transition-all hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Treasury Balance</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                ${treasuryBalance.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{currency}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 inline" />
              On-chain Arc Escrow Vault
            </p>
          </div>

          {/* Card 2: Spend this Month */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 shadow-sm dark:shadow-xl backdrop-blur-md transition-all hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Spend This Month</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                ${spendThisMonth.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">/ mo</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Annual committed: ${(totalAnnualSpend).toLocaleString()}
            </p>
          </div>

          {/* Card 3: Savings Discovered */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-300/60 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 shadow-sm dark:shadow-xl backdrop-blur-md transition-all hover:border-emerald-400 dark:hover:border-emerald-500/40">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Savings Discovered</span>
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300 font-mono">
                ${savingsDiscovered.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80">estimated</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Across {contracts.length} active renewals
            </p>
          </div>

          {/* Card 4: Savings Realized */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 shadow-sm dark:shadow-xl backdrop-blur-md transition-all hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Savings Realized</span>
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                ${savingsRealized.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">settled</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {negotiationsCount} completed negotiations
            </p>
          </div>
        </section>

        {/* Policy Governance Banner */}
        {policy && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 p-4 px-6 flex flex-wrap items-center justify-between gap-4 text-xs shadow-xs">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Active Deterministic Policy Rules:</span>
                <span className="text-slate-600 dark:text-slate-400 ml-2">
                  Auto-tx ceiling ${Number(policy.max_auto_transaction).toLocaleString()} | Min savings ${Number(policy.min_savings).toLocaleString()} | Human approval above ${Number(policy.human_approval_required_above).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 dark:text-slate-500">Allowed Categories:</span>
              {(policy.allowed_categories || []).map((cat: string) => (
                <span key={cat} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-200 dark:border-slate-700">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Renewal Opportunities Section */}
        <section aria-label="Renewal Opportunities" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Renewal Opportunities
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  {contractOpportunities.length} Detected
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Opportunities identified from upcoming contract renewals and telemetry signals.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs">
              <Activity className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span>Placeholder heuristic logic (LLM agent replaces in milestone 2)</span>
            </div>
          </div>

          {/* Opportunities Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 backdrop-blur-md shadow-sm dark:shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th scope="col" className="py-3.5 px-6">Service & Vendor</th>
                    <th scope="col" className="py-3.5 px-6">Category</th>
                    <th scope="col" className="py-3.5 px-6">Current Annual Price</th>
                    <th scope="col" className="py-3.5 px-6">Renewal Timeline</th>
                    <th scope="col" className="py-3.5 px-6">Analysis & Signals</th>
                    <th scope="col" className="py-3.5 px-6 text-right">Projected Savings</th>
                    <th scope="col" className="py-3.5 px-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {contractOpportunities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                        No contracts found in database. Run <code className="text-slate-700 dark:text-slate-300 font-mono">npm run seed</code> to populate.
                      </td>
                    </tr>
                  ) : (
                    contractOpportunities.map((opp) => (
                      <tr key={opp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                        {/* Service & Vendor */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white group-hover:border-emerald-500/50 transition-colors">
                              {opp.service.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {opp.service}
                                {opp.vendors?.is_simulated && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                                    Simulated
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Vendor: {opp.vendors?.name || opp.service}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {opp.category}
                          </span>
                        </td>

                        {/* Current Price */}
                        <td className="py-4 px-6 font-mono font-medium text-slate-900 dark:text-slate-200">
                          ${Number(opp.current_price).toLocaleString()}
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-sans ml-1">/yr</span>
                        </td>

                        {/* Renewal Timeline */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs text-slate-700 dark:text-slate-300">
                              {new Date(opp.renewal_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                            {opp.daysRemaining} days remaining
                          </div>
                        </td>

                        {/* Analysis & Signals */}
                        <td className="py-4 px-6 text-xs">
                          {opp.heuristicType === "seat_optimization" && (
                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                              <Users className="h-3.5 w-3.5" />
                              <span>{opp.explanation}</span>
                            </div>
                          )}
                          {opp.heuristicType === "usage_decline" && (
                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                              <Activity className="h-3.5 w-3.5" />
                              <span>{opp.explanation}</span>
                            </div>
                          )}
                          {opp.heuristicType === "none" && (
                            <span className="text-slate-400 dark:text-slate-500">{opp.explanation}</span>
                          )}
                        </td>

                        {/* Projected Savings */}
                        <td className="py-4 px-6 text-right">
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">
                            ${opp.savings.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {opp.savings > 0 
                              ? `${Math.round((opp.savings / Number(opp.current_price)) * 100)}% potential cut`
                              : "Baseline"}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            opp.status === "active"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                          }`}>
                            {opp.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Footer info banner */}
        <footer className="pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-3">
          <div>
            Tavryn &bull; Arc Testnet Escrow &amp; Circle USDC &bull; Supabase Postgres
          </div>
          <div className="flex items-center gap-3">
            <span>Deterministic Core v0.1</span>
            <span>&bull;</span>
            <span>Append-only agent_actions</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

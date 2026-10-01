import {
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { TransactionHashBadge } from "@/components/TransactionHashBadge";
import { ARC_CONFIG } from "@/lib/circle";
import {
  VERIFICATION_SAMPLE_REAL_RECEIPT_TOKEN,
  VERIFICATION_SAMPLE_REAL_TX_HASH,
  VERIFICATION_SAMPLE_SIM_RECEIPT_TOKEN,
  VERIFICATION_SAMPLE_SIM_TX_HASH,
} from "@/lib/constants";

export default function VerifyLabelingPage() {
  const realTxHash = VERIFICATION_SAMPLE_REAL_TX_HASH;
  const realExplorerUrl = `${ARC_CONFIG.explorerUrl}/tx/${realTxHash}`;
  const simTxHash = VERIFICATION_SAMPLE_SIM_TX_HASH;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Honest Transaction
            Verification
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Honest Transaction Labeling: Side-by-Side Proof
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Strict anti-404 verification: Live on-chain Arc testnet transactions
            get active, working ArcScan explorer links. Simulated, mock, or
            credentials-absent transactions render an explicit &quot;Simulated
            (testnet mock)&quot; badge with copyable monospace text and zero
            explorer links.
          </p>
        </div>

        {/* Side by side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Real On-Chain Transaction */}
          <div className="rounded-xl border border-emerald-800/40 bg-gradient-to-b from-emerald-950/20 to-slate-900/60 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-emerald-800/30">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse" />
                <h2 className="text-lg font-semibold text-white">
                  Live On-Chain Transaction
                </h2>
              </div>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                Chain-Confirmed
              </span>
            </div>

            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 font-medium">
                  Transaction Hash Badge (Default)
                </div>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <TransactionHashBadge
                    txHash={realTxHash}
                    explorerUrl={realExplorerUrl}
                    isSimulated={false}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 font-medium">
                  Public Receipt View (/r/[token])
                </div>
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Settlement Verification:
                    </span>
                    <span className="text-emerald-400 font-medium">
                      Verified On-Chain
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Network:</span>
                    <span className="text-slate-200">
                      Arc Testnet (USDC-native EVM)
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      ArcScan Explorer:
                    </span>
                    <a
                      href={realExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition"
                    >
                      <span>View on ArcScan</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 font-medium">
                  Decision Summary & Timeline Banner
                </div>
                <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-200">
                      Escrow Released on Arc
                    </span>
                  </div>
                  <TransactionHashBadge
                    txHash={realTxHash}
                    explorerUrl={realExplorerUrl}
                    isSimulated={false}
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-300">
              <span className="font-semibold">Result:</span> Hash is clickable
              and navigates to live transaction on{" "}
              <span className="font-mono">testnet.arcscan.app</span>.
            </div>
          </div>

          {/* Simulated Transaction */}
          <div className="rounded-xl border border-amber-800/40 bg-gradient-to-b from-amber-950/20 to-slate-900/60 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-amber-800/30">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <h2 className="text-lg font-semibold text-white">
                  Simulated / Mock Transaction
                </h2>
              </div>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                Simulated (testnet mock)
              </span>
            </div>

            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 font-medium">
                  Transaction Hash Badge (Default)
                </div>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <TransactionHashBadge txHash={simTxHash} isSimulated={true} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 font-medium">
                  Public Receipt View (/r/[token])
                </div>
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Settlement Verification:
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/40">
                      Simulated (testnet mock)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Network:</span>
                    <span className="text-slate-200">
                      Arc Testnet (Simulated Sandbox)
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Mock Hash:</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
                      <span>0xsimulated_8f7b...1d0e</span>
                      <Copy className="w-3 h-3 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 font-medium">
                  Decision Summary & Timeline Banner
                </div>
                <div className="p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-amber-200">
                      Simulated Settlement Completed
                    </span>
                  </div>
                  <TransactionHashBadge txHash={simTxHash} isSimulated={true} />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300">
              <span className="font-semibold">Result:</span> Explicit badge
              shown. Hash is copyable text. Absolutely zero dead ArcScan links
              (zero 404s).
            </div>
          </div>
        </div>

        {/* Real Receipts Links */}
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <h3 className="text-base font-semibold text-white">
            Live Public Receipts Test Instances
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/r/${VERIFICATION_SAMPLE_REAL_RECEIPT_TOKEN}`}
              className="p-4 rounded-lg border border-emerald-800/40 bg-slate-900 hover:bg-slate-800/80 transition flex items-center justify-between group"
            >
              <div>
                <div className="text-sm font-semibold text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1.5">
                  Live On-Chain Receipt <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Token: {VERIFICATION_SAMPLE_REAL_RECEIPT_TOKEN.slice(0, 10)}
                  ... &bull; Contains verified ArcScan explorer link
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified Link
              </span>
            </Link>

            <Link
              href={`/r/${VERIFICATION_SAMPLE_SIM_RECEIPT_TOKEN}`}
              className="p-4 rounded-lg border border-amber-800/40 bg-slate-900 hover:bg-slate-800/80 transition flex items-center justify-between group"
            >
              <div>
                <div className="text-sm font-semibold text-amber-400 group-hover:text-amber-300 flex items-center gap-1.5">
                  Simulated Receipt <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Token: {VERIFICATION_SAMPLE_SIM_RECEIPT_TOKEN.slice(0, 10)}...
                  &bull; Badge & copyable hash, no dead link
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Simulated Badge
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

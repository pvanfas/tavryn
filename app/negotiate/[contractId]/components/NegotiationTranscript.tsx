"use client";

import { CheckCircle2 } from "lucide-react";
import React from "react";

import { Body, BodySmall, Caption, H3, Mono } from "@/components/ui/text";

import { Turn } from "./types";

interface NegotiationTranscriptProps {
  conversation: Turn[];
}

export function NegotiationTranscript({
  conversation,
}: NegotiationTranscriptProps) {
  // Group conversation turns into rounds
  const roundsMap = new Map<number, Turn[]>();
  let currentRound = 1;

  for (const turn of conversation) {
    const rnd = turn.round || currentRound;
    if (!roundsMap.has(rnd)) {
      roundsMap.set(rnd, []);
    }
    roundsMap.get(rnd)!.push(turn);
    if (turn.role === "vendor" && !turn.round) {
      currentRound++;
    }
  }

  const sortedRoundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  return (
    <div className="mt-6 space-y-4">
      <H3 className="text-slate-900 dark:text-white">Exchange Transcript</H3>

      {sortedRoundNumbers.length === 0 ? (
        <div className="py-10 text-center text-xs font-medium text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          No rounds exchanged yet. Use either the Real Vendor email outreach or
          Autonomous Rounds above.
        </div>
      ) : (
        sortedRoundNumbers.map((rnd) => {
          const roundTurns = roundsMap.get(rnd) || [];
          const agentTurn = roundTurns.find((t) => t.role === "agent");
          const vendorTurn = roundTurns.find((t) => t.role === "vendor");

          return (
            <div
              key={rnd}
              className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 p-4 sm:p-5 space-y-3.5 bg-slate-50/50 dark:bg-[#131b17]/40"
            >
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                <Mono className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300">
                  Round 0{rnd}
                </Mono>
                {vendorTurn?.accepted && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Offer Accepted by Vendor
                  </span>
                )}
              </div>

              {/* Agent Proposal */}
              {agentTurn && (
                <div className="text-xs space-y-1.5 pl-3 border-l-2 border-[#107e65]/80">
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-2">
                      <BodySmall
                        as="span"
                        className="font-bold text-slate-900 dark:text-white"
                      >
                        Tavryn Procurement
                      </BodySmall>
                      <Caption className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[#107e65] dark:text-emerald-400">
                        Autonomous Agent
                      </Caption>
                    </div>
                    <Mono className="text-[#107e65] dark:text-[#34d399] bg-emerald-500/10 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Offer: ${agentTurn.amount?.toLocaleString()}
                    </Mono>
                  </div>
                  <Body className="text-slate-600 dark:text-slate-300 leading-relaxed bg-white/90 dark:bg-[#111714]/90 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
                    {agentTurn.message}
                  </Body>
                </div>
              )}

              {/* Vendor Counter */}
              {vendorTurn && (
                <div className="text-xs space-y-1.5 pl-3 border-l-2 border-slate-400 dark:border-slate-600">
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-2">
                      <BodySmall
                        as="span"
                        className="font-bold text-slate-900 dark:text-white"
                      >
                        {vendorTurn.speaker}
                      </BodySmall>
                      <Caption className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Vendor Account Exec
                      </Caption>
                    </div>
                    <Mono className="text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700/70">
                      {vendorTurn.accepted ? "Agreed:" : "Counter:"} $
                      {vendorTurn.amount?.toLocaleString()}
                    </Mono>
                  </div>
                  <Body className="text-slate-600 dark:text-slate-300 leading-relaxed bg-white/90 dark:bg-[#111714]/90 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
                    {vendorTurn.message}
                  </Body>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

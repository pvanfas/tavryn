"use client";

import {
  AlertTriangle,
  Bot,
  History,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { CommandCard } from "@/lib/agent/command";

import {
  ActionConfirmationCard,
  ApprovalsCard,
  ChatMessage,
  CommandBarProps,
  DecisionExplanationCard,
  FormattedMessage,
  RenewalsCard,
  SavingsCard,
  SavingsSummaryCard,
  SUGGESTED_CHIPS,
} from "./command-bar";

export function CommandBar({
  isOpen,
  onClose,
  businessId,
  businessName = "Demo Co",
}: CommandBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const [confirmedResults, setConfirmedResults] = useState<
    Record<string, string>
  >({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (overrideText?: string) => {
    const textToSend = (overrideText ?? query).trim();
    if (!textToSend || loading) return;

    setErrorMsg(null);
    setQuery("");

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    // Add user message and empty streaming assistant message
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: textToSend },
      { id: assistantMsgId, role: "assistant", text: "", isStreaming: true },
    ]);

    setLoading(true);

    try {
      const res = await fetch("/api/agent/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: textToSend,
          businessId,
          stream: true,
          history: messages
            .slice(-4)
            .map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to process command");
      }

      // Check if response is an SSE stream
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";
        let finalCard: CommandCard | undefined = undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const eventData = JSON.parse(line.slice(6));
                if (eventData.type === "chunk") {
                  accumulatedText =
                    eventData.fullText || accumulatedText + eventData.chunk;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, text: accumulatedText, isStreaming: true }
                        : m,
                    ),
                  );
                } else if (eventData.type === "card") {
                  finalCard = eventData.card;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, card: finalCard } : m,
                    ),
                  );
                } else if (eventData.type === "done") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, isStreaming: false }
                        : m,
                    ),
                  );
                }
              } catch {
                // Ignore partial JSON chunks
              }
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: accumulatedText || "Answer complete.",
                  card: finalCard,
                  isStreaming: false,
                }
              : m,
          ),
        );
      } else {
        // Fallback for direct JSON response
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: data.text || data.data?.text || "",
                  card: data.card || data.data?.card,
                  isStreaming: false,
                }
              : m,
          ),
        );
      }
    } catch (err) {
      console.error(err);
      setErrorMsg((err as Error).message);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: "I encountered an error retrieving data. Please try again.",
                isStreaming: false,
              }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (
    actionId: string,
    action: string,
    params: Record<string, unknown>,
  ) => {
    try {
      setConfirmingAction(actionId);
      const res = await fetch("/api/agent/command/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          businessId,
          params,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to confirm action");
      }

      setConfirmedResults((prev) => ({
        ...prev,
        [actionId]:
          json.message || "Action successfully executed and recorded.",
      }));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setConfirmingAction(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 p-3 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Main Dialog Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask Tavryn Command Bar"
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#111714] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all"
      >
        {/* Header / Input Box */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#141c18]/70 flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-[#107e65]/10 text-[#107e65] dark:text-[#34d399] flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Ask Tavryn about ${businessName} renewals, savings, or commands...`}
              className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden pr-8"
              disabled={loading}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="h-8 w-8 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-[#107e65] animate-spin" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!query.trim()}
              className="px-3 py-1.5 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Ask</span>
              <Send className="h-3 w-3" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 shrink-0"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conversation Thread / Results Panel */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {messages.length === 0 ? (
            /* Empty State with Suggested Prompt Chips */
            <div className="py-6 sm:py-8 space-y-5 text-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] flex items-center justify-center mx-auto">
                <Bot className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Talk to Tavryn in plain English
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-[11px]">
                  Query renewals, audit waste, explain past decisions, or
                  initiate policy-guarded negotiations.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Suggested Prompts
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
                  {SUGGESTED_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSubmit(chip)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-[#107e65] dark:hover:text-[#34d399] text-slate-700 dark:text-slate-300 font-medium transition-all text-[11px] cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Message Thread */
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`space-y-2.5 ${msg.role === "user" ? "text-right" : "text-left"}`}
              >
                {/* Text Bubble */}
                <div
                  className={`inline-block p-3.5 rounded-2xl max-w-[90%] text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#107e65] text-white font-medium shadow-2xs rounded-br-xs"
                      : "bg-slate-100/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/60 dark:border-slate-700/60"
                  }`}
                >
                  <FormattedMessage
                    text={msg.text}
                    role={msg.role}
                    isStreaming={msg.isStreaming}
                  />
                </div>

                {/* Structured Cards */}
                {msg.card && (
                  <div className="mt-2 text-left max-w-full">
                    {msg.card.type === "renewals" && (
                      <RenewalsCard card={msg.card} onClose={onClose} />
                    )}

                    {msg.card.type === "savings" && (
                      <SavingsCard
                        card={msg.card}
                        onNegotiate={(q) => handleSubmit(q)}
                      />
                    )}

                    {msg.card.type === "approvals" && (
                      <ApprovalsCard card={msg.card} onClose={onClose} />
                    )}

                    {msg.card.type === "decision_explanation" && (
                      <DecisionExplanationCard
                        card={msg.card}
                        onClose={onClose}
                      />
                    )}

                    {msg.card.type === "savings_summary" && (
                      <SavingsSummaryCard card={msg.card} onClose={onClose} />
                    )}

                    {msg.card.type === "action_confirmation" && (
                      <ActionConfirmationCard
                        card={msg.card}
                        msgId={msg.id}
                        confirmedResult={confirmedResults[msg.id]}
                        isConfirming={confirmingAction === msg.id}
                        onConfirmAction={handleConfirmAction}
                      />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer info & keyboard shortcut reminder */}
        <div className="px-4 py-2 bg-slate-50/70 dark:bg-[#141c18]/70 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>Powered by Tavryn Autonomous Procurement</span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="h-3 w-3" />
              Zero-Trust Guarded
            </span>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <History className="h-3 w-3" />
                <span>Clear Chat</span>
              </button>
            )}
            <span className="hidden sm:inline font-mono">
              Press{" "}
              <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Esc
              </kbd>{" "}
              to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

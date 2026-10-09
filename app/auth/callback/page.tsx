"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";

import { getBrowserSupabase, setAuthCookie } from "@/lib/auth";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext !== "/" ? rawNext : "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );

  useEffect(() => {
    let errorParam =
      searchParams.get("error_description") || searchParams.get("error");
    let code = searchParams.get("code");
    let hashAccessToken: string | null = null;
    let hashRefreshToken: string | null = null;

    // Supabase Implicit / Email confirmation link returns tokens in the URL hash fragment (#access_token=...)
    if (typeof window !== "undefined" && window.location.hash) {
      const hashClean = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashClean);

      if (!errorParam) {
        errorParam =
          hashParams.get("error_description") || hashParams.get("error");
      }
      hashAccessToken = hashParams.get("access_token");
      hashRefreshToken = hashParams.get("refresh_token");
    }

    if (errorParam) {
      setError(decodeURIComponent(errorParam.replace(/\+/g, " ")));
      setStatus("error");
      return;
    }

    const supabase = getBrowserSupabase();

    const completeAuth = async () => {
      try {
        // 1. PKCE Code flow (exchange code for session)
        if (code) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(exchangeError.message);
            setStatus("error");
            return;
          }
          if (data.session) {
            setAuthCookie(data.session.access_token);
            setStatus("success");
            router.replace(next);
            return;
          }
        }

        // 2. Hash fragment flow (#access_token=...&refresh_token=...)
        if (hashAccessToken) {
          const { data: setSessionData, error: setSessionErr } =
            await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken || "",
            });
          if (setSessionErr) {
            setError(setSessionErr.message);
            setStatus("error");
            return;
          }
          if (setSessionData.session) {
            setAuthCookie(setSessionData.session.access_token);
            setStatus("success");
            router.replace(next);
            return;
          }
        }

        // 3. Existing stored session
        const { data: sessionData, error: sessionErr } =
          await supabase.auth.getSession();
        if (sessionErr) {
          setError(sessionErr.message);
          setStatus("error");
          return;
        }

        if (sessionData.session) {
          setAuthCookie(sessionData.session.access_token);
          setStatus("success");
          router.replace(next);
          return;
        }

        // 4. Listen for auth state change if session hasn't settled yet
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (session) {
              setAuthCookie(session.access_token);
              setStatus("success");
              router.replace(next);
            }
          },
        );

        // Timeout safety
        const timeout = setTimeout(() => {
          if (status === "processing") {
            setError("Authentication timed out. Please try signing in again.");
            setStatus("error");
          }
        }, 8000);

        return () => {
          authListener.subscription.unsubscribe();
          clearTimeout(timeout);
        };
      } catch (err) {
        setError(
          (err as Error).message || "Failed to complete authentication.",
        );
        setStatus("error");
      }
    };

    completeAuth();
  }, [searchParams, router, next, status]);

  return (
    <div className="w-full max-w-md">
      <div className="bg-white/95 dark:bg-[#111714]/95 rounded-2xl border border-slate-200/80 dark:border-slate-800/70 shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-8 text-center backdrop-blur-sm">
        {status === "processing" && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-[#107e65]/10 dark:bg-[#107e65]/20 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-[#107e65] dark:text-[#34d399] animate-spin" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Completing sign-in
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Verifying your credentials and synchronizing session...
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-[#107e65] dark:text-[#34d399]" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Authenticated
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Redirecting you to your destination...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Authentication Failed
              </h2>
              <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 max-w-sm mx-auto leading-relaxed">
                {error ||
                  "An unexpected error occurred during OAuth authorization."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold transition-colors shadow-xs"
              >
                <span>Return to Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md p-8 text-center bg-white dark:bg-[#111714] rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="h-6 w-6 text-[#107e65] animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-2">
            Loading authentication handler...
          </p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

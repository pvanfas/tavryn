"use client";

import { usePathname, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";

export function startTopLineLoader() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("topline:start"));
  }
}

export function stopTopLineLoader() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("topline:done"));
  }
}

function TopLineLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setActive(true);
    setOpacity(1);
    setProgress(15);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 65) return prev + Math.random() * 15;
        if (prev < 88) return prev + Math.random() * 4;
        return prev;
      });
    }, 200);
  };

  const completeProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);

    fadeTimerRef.current = setTimeout(() => {
      setOpacity(0);
      setTimeout(() => {
        setActive(false);
        setProgress(0);
      }, 300);
    }, 200);
  };

  // Complete loader whenever pathname or search params change
  useEffect(() => {
    completeProgress();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [pathname, searchParams]);

  // Intercept internal link clicks to start progress bar immediately
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore hash links, external links, downloads, and new tabs
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        (href.startsWith("http") && !href.startsWith(window.location.origin))
      ) {
        return;
      }

      // If navigating to the same URL, don't start
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (href === currentUrl) return;

      startProgress();
    };

    const handleCustomStart = () => startProgress();
    const handleCustomDone = () => completeProgress();

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("topline:start", handleCustomStart);
    window.addEventListener("topline:done", handleCustomDone);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("topline:start", handleCustomStart);
      window.removeEventListener("topline:done", handleCustomDone);
    };
  }, []);

  if (!active && opacity === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Page navigation progress"
      aria-valuenow={Math.round(progress)}
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none transition-opacity duration-300 overflow-hidden"
      style={{ opacity }}
    >
      <div
        className="h-full bg-linear-to-r from-emerald-500 via-[#107e65] to-teal-400 shadow-[0_0_12px_rgba(16,126,101,0.8)] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
        }}
      />
    </div>
  );
}

export function TopLineLoader() {
  return (
    <Suspense fallback={null}>
      <TopLineLoaderInner />
    </Suspense>
  );
}

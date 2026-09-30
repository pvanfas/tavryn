"use client";

import React from "react";

import { BodySmall, Caption } from "@/components/ui/text";

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  badge?: string;
  badgeTone?: "emerald" | "slate" | "amber" | "blue";
  caption?: string;
  status?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const BADGE_TONE_STYLES: Record<
  NonNullable<PageHeaderProps["badgeTone"]>,
  string
> = {
  emerald:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  slate:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  amber:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
};

/**
 * Minimal, reusable page header for dashboard and workspace views.
 * Replaces oversized headings with a crisp, compact executive hierarchy.
 */
export function PageHeader({
  title,
  description,
  badge = "Workspace",
  badgeTone = "emerald",
  caption,
  status,
  children,
  className = "",
}: PageHeaderProps) {
  const badgeClasses =
    BADGE_TONE_STYLES[badgeTone] || BADGE_TONE_STYLES.emerald;

  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 ${className}`}
    >
      <div className="space-y-1">
        {/* Eyebrow / Badges */}
        {(badge || caption || status) && (
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {badge && (
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${badgeClasses}`}
              >
                {badge}
              </span>
            )}
            {caption && (
              <Caption className="text-slate-400 dark:text-slate-500 font-medium">
                {caption}
              </Caption>
            )}
            {status}
          </div>
        )}

        {/* Minimal Title */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>

        {/* Description */}
        {description && (
          <BodySmall className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
            {description}
          </BodySmall>
        )}
      </div>

      {/* Right Action slot (buttons, filters, metrics) */}
      {children && (
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center pt-1 sm:pt-0">
          {children}
        </div>
      )}
    </header>
  );
}

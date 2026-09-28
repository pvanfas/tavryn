"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  X,
  ShieldCheck,
  MessageSquare,
  Wallet,
  TrendingDown,
  ExternalLink,
  CalendarSync,
} from "lucide-react";

export interface NotificationItem {
  id: string;
  category: "renewal" | "policy" | "negotiation" | "treasury" | "audit";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  linkLabel?: string;
}

const FALLBACK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    category: "renewal",
    title: "Slack Renewal Detected",
    message: "Slack renewal detected. 18 of 25 seats active. I have contacted the vendor and requested a revised quote. Status: negotiation in progress.",
    timestamp: "10m ago",
    read: false,
    link: "/negotiate",
    linkLabel: "View Negotiation",
  },
  {
    id: "notif-2",
    category: "policy",
    title: "Supervisor Approval Required",
    message: "Datadog contract renewal proposal ($24,000) exceeds autonomous ceiling of $2,500.",
    timestamp: "1h ago",
    read: false,
    link: "/decision",
    linkLabel: "Review Decision",
  },
  {
    id: "notif-3",
    category: "treasury",
    title: "Arc Testnet Synced",
    message: "Circle developer wallet connected. On-chain treasury balance confirmed.",
    timestamp: "5h ago",
    read: true,
  },
];

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  onUnreadChange?: (count: number) => void;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs) || diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return dateStr;
  }
}

export function NotificationPanel({
  isOpen,
  onClose,
  businessId,
  onUnreadChange,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(FALLBACK_NOTIFICATIONS);
  const [loading, setLoading] = useState(false);

  // Fetch real notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!businessId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/notifications?businessId=${encodeURIComponent(businessId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications) && data.notifications.length > 0) {
          const mapped: NotificationItem[] = data.notifications.map((n: any) => ({
            id: n.id,
            category: n.category || "renewal",
            title: n.title,
            message: n.message,
            timestamp: formatRelativeTime(n.created_at),
            read: Boolean(n.read),
            link: n.link,
            linkLabel: n.link_label || "View Details",
          }));
          setNotifications(mapped);
          const unread = mapped.filter((n) => !n.read).length;
          onUnreadChange?.(unread);
        }
      }
    } catch (err) {
      console.warn("Could not fetch notifications from server:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, onUnreadChange]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications, isOpen]);

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    onUnreadChange?.(0);
    if (businessId) {
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true, businessId }),
        });
      } catch (err) {
        console.warn("Failed to mark all read on server:", err);
      }
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      const unread = next.filter((n) => !n.read).length;
      onUnreadChange?.(unread);
      return next;
    });

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.warn("Failed to mark notification read on server:", err);
    }
  };

  const getCategoryIcon = (category: NotificationItem["category"]) => {
    switch (category) {
      case "renewal":
        return <CalendarSync className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "policy":
        return <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "negotiation":
        return <MessageSquare className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />;
      case "treasury":
        return <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "audit":
        return <TrendingDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/20 dark:bg-slate-950/40 backdrop-blur-2xs z-40 transition-opacity animate-in fade-in duration-200"
        />
      )}

      {/* Offcanvas Floating Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Notifications Panel"
        className={`fixed top-5 right-5 bottom-5 w-[calc(100vw-40px)] sm:w-96 rounded-2xl bg-white/95 dark:bg-[#111714]/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] z-50 flex flex-col overflow-hidden transition-all duration-300 ease-out font-sans ${
          isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-[calc(100%+30px)] opacity-0 pointer-events-none"
        }`}
      >
        {/* Panel Header */}
        <div className="h-16 px-5 border-b border-slate-100 dark:border-slate-800/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Notifications
            </h2>
            {unreadCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                {unreadCount} new
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Caught up
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="px-2.5 py-1 rounded-xl text-xs font-semibold text-[#107e65] dark:text-[#34d399] hover:bg-emerald-500/10 transition-colors cursor-pointer"
                title="Mark all as read"
              >
                Mark read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close notifications panel"
              aria-label="Close notifications panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Panel Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
          {notifications.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
              No notifications at this time
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => markAsRead(item.id)}
                className={`p-3.5 rounded-xl transition-colors cursor-pointer group ${
                  item.read
                    ? "opacity-75 hover:opacity-100 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    : "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]"
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>
                    <span className="text-xs font-bold capitalize text-slate-700 dark:text-slate-300">
                      {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      {item.timestamp}
                    </span>
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-[#107e65]" title="Unread" />
                    )}
                  </div>
                </div>

                <div className="mt-2 pl-8">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1">
                    {item.message}
                  </p>

                  {item.link && (
                    <Link
                      href={item.link}
                      onClick={onClose}
                      className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-[#107e65] dark:text-[#34d399] hover:underline"
                    >
                      <span>{item.linkLabel || "View Details"}</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel Footer */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/70 bg-slate-50/70 dark:bg-[#141b18]/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
          <span>Tavryn Notification Engine</span>
          <button
            type="button"
            onClick={fetchNotifications}
            disabled={loading}
            className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </aside>
    </>
  );
}

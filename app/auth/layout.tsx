import Image from "next/image";
import Link from "next/link";
import React from "react";

import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9f8] dark:bg-[#0b100e] text-slate-900 dark:text-slate-100 antialiased">
      {/* Ambient gradient */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(16,126,101,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(16,126,101,0.15),transparent_70%)]"
      />

      {/* Topbar */}
      <header className="relative z-10 h-14 px-6 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-[#0e1411]/60 backdrop-blur-md">
        <Link href="/auth/login" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm overflow-hidden p-0.5">
            <Image
              src="/logo.png"
              alt="Tavryn"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
          </div>
          <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
            Tavryn
          </span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Page content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-400 dark:text-slate-600 font-medium">
        © {new Date().getFullYear()} Tavryn · Arc &bull; Circle
      </footer>
    </div>
  );
}

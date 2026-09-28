import type { Metadata } from "next";
import { Manrope, Geist_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tavryn | Procurement & Treasury Ledger",
  description: "Enterprise SaaS and cloud contract procurement with deterministic policy enforcement and Arc testnet escrow.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", manrope.variable, geistMono.variable, "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className={`${manrope.className} min-h-full flex flex-col bg-[#f7f9f8] dark:bg-[#0b100e] text-slate-900 dark:text-slate-100 transition-colors duration-200`}>
        {children}
      </body>
    </html>
  );
}

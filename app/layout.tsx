import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";

import { AuthHashListener } from "@/components/AuthHashListener";
import { TopLineLoader } from "@/components/TopLineLoader";
import { cn } from "@/lib/utils";

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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://tavryn.space",
  ),
  title: {
    default: "Tavryn | Procurement & Treasury Ledger",
    template: "%s | Tavryn",
  },
  description:
    "An AI agent that finds the waste in a business's software spend, negotiates it away, and executes the financial decision in USDC on Arc.",
  applicationName: "Tavryn",
  keywords: [
    "Tavryn",
    "Procurement",
    "Treasury Ledger",
    "Arc",
    "Circle",
    "USDC",
    "Autonomous Agent",
    "SaaS Spend",
    "Smart Contracts",
    "Escrow",
  ],
  authors: [{ name: "Tavryn Protocol" }],
  creator: "Tavryn",
  publisher: "Tavryn",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Tavryn | Procurement & Treasury Ledger",
    description:
      "An AI agent that finds the waste in a business's software spend, negotiates it away, and executes the financial decision in USDC on Arc.",
    url: "https://tavryn.space",
    siteName: "Tavryn",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Tavryn | Procurement & Treasury Ledger",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tavryn | Procurement & Treasury Ledger",
    description:
      "An AI agent that finds the waste in a business's software spend, negotiates it away, and executes the financial decision in USDC on Arc.",
    images: ["/logo.png"],
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
      className={cn(
        "h-full",
        "antialiased",
        manrope.variable,
        geistMono.variable,
        "font-sans",
      )}
      suppressHydrationWarning
    >
      <body
        className={`${manrope.className} min-h-full flex flex-col bg-[#f7f9f8] dark:bg-[#0b100e] text-slate-900 dark:text-slate-100 transition-colors duration-200`}
      >
        <AuthHashListener />
        <TopLineLoader />
        {children}
        <Analytics />
      </body>
    </html>
  );
}

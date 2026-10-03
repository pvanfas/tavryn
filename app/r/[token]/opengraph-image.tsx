import fs from "fs";
import { ImageResponse } from "next/og";
import path from "path";

import { getPublicReceipt } from "@/lib/receipt";

export const runtime = "nodejs";
export const alt = "Tavryn Proof of Savings";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const receipt = await getPublicReceipt(token);

  let logoDataUrl = "";
  try {
    const logoBuffer = fs.readFileSync(
      path.join(process.cwd(), "public", "logo.png"),
    );
    logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    // fallback if file not readable
  }

  const savingsFormatted = receipt
    ? `$${receipt.annualSavings.toLocaleString()}`
    : "$0";
  const service = receipt?.service || "SaaS Contract";
  const savingsPct = receipt?.savingsPct ? `${receipt.savingsPct}%` : "Savings";

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        backgroundColor: "#0B110F",
        backgroundImage:
          "radial-gradient(circle at 25px 25px, #13221C 2%, transparent 0%), radial-gradient(circle at 75px 75px, #13221C 2%, transparent 0%)",
        backgroundSize: "100px 100px",
        padding: "70px 80px",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt="Tavryn Logo"
            width="48"
            height="48"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              objectFit: "contain",
              backgroundColor: "#FFFFFF",
              padding: "4px",
            }}
          />
        ) : (
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#107E65",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "26px",
              color: "#FFFFFF",
            }}
          >
            T
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              color: "#10B981",
            }}
          >
            TAVRYN
          </span>
          <span
            style={{
              fontSize: "14px",
              color: "#94A3B8",
              letterSpacing: "0.05em",
            }}
          >
            AUTONOMOUS PROCUREMENT PROOF
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "rgba(16, 126, 101, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "30px",
            padding: "8px 20px",
            width: "fit-content",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#34D399",
              letterSpacing: "0.05em",
            }}
          >
            VERIFIED ON-CHAIN SAVINGS · {savingsPct} REDUCTION
          </span>
        </div>

        <h1
          style={{
            fontSize: "58px",
            fontWeight: 900,
            lineHeight: 1.1,
            color: "#FFFFFF",
            margin: 0,
          }}
        >
          Saved {savingsFormatted} on {service}
        </h1>

        <p
          style={{
            fontSize: "22px",
            color: "#94A3B8",
            maxWidth: "850px",
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          Policy-verified autonomous negotiation sealed with Arc USDC smart
          escrow settlement.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          borderTop: "1px solid rgba(148, 163, 184, 0.2)",
          paddingTop: "24px",
        }}
      >
        <span style={{ fontSize: "16px", color: "#64748B" }}>
          Network: Arc Testnet (USDC-native EVM)
        </span>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#10B981",
          }}
        >
          Proof: testnet.arcscan.app
        </span>
      </div>
    </div>,
    {
      ...size,
    },
  );
}

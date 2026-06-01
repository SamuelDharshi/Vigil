import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIGIL — 24/7 Autonomous RWA Portfolio Agent",
  description:
    "VIGIL is an autonomous AI agent managing mETH, USDY, and xStocks portfolios on Mantle. " +
    "Executes via Fluxion Atomic RFQ, routes yield via Super Portal → Byreal CLMM, and proves every decision with ZK cryptography on ERC-8004.",
  keywords: ["VIGIL", "Mantle", "RWA", "autonomous agent", "xStocks", "mETH", "USDY", "ERC-8004", "ZK proof"],
  openGraph: {
    title: "VIGIL — The Market Never Sleeps",
    description: "24/7 autonomous RWA portfolio management on Mantle. Every decision ZK-verified.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VIGIL — Autonomous RWA Agent",
    description: "While NYSE is closed for 65 hours, VIGIL keeps moving.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

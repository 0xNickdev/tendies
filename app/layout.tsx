import type { Metadata, Viewport } from "next";
import { Inter, Caveat, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-hand",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tendies — Hold the bag. Get the tendies.",
  description:
    "Hold TENDIE and earn rewards in real tokenized stocks — TSLA, NVDA or SPCX — paid out every 30 minutes. No brokerage account, 24/7, self-custody. Launched on stonkfun, settled on Solana.",
  keywords: [
    "Tendies",
    "TENDIE",
    "tokenized stocks",
    "Solana",
    "DeFi",
    "TSLA",
    "NVDA",
    "SpaceX",
    "perpetuals",
    "treasury",
  ],
  openGraph: {
    title: "Tendies — Hold the bag. Get the tendies.",
    description:
      "Earn real tokenized stocks (TSLA · NVDA · SPCX) every 30 minutes just by holding TENDIE. On Solana.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tendies — Hold the bag. Get the tendies.",
    description:
      "Earn real tokenized stocks (TSLA · NVDA · SPCX) every 30 minutes just by holding TENDIE. On Solana.",
  },
};

export const viewport: Viewport = {
  themeColor: "#071013",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${caveat.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

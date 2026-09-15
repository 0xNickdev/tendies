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
  title: "RobinX — Hold the token. Get paid in stocks.",
  description:
    "Hold ROBX and earn rewards in real tokenized stocks — TSLA, NVDA or SPCX — paid out every 30 minutes. No brokerage account, 24/7, self-custody. Built on Robinhood Chain.",
  keywords: [
    "RobinX",
    "ROBX",
    "tokenized stocks",
    "Robinhood Chain",
    "DeFi",
    "TSLA",
    "NVDA",
    "SpaceX",
    "perpetuals",
    "treasury",
  ],
  openGraph: {
    title: "RobinX — Hold the token. Get paid in stocks.",
    description:
      "Earn real tokenized stocks (TSLA · NVDA · SPCX) every 30 minutes just by holding ROBX. On Robinhood Chain.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RobinX — Hold the token. Get paid in stocks.",
    description:
      "Earn real tokenized stocks (TSLA · NVDA · SPCX) every 30 minutes just by holding ROBX. On Robinhood Chain.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0B05",
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

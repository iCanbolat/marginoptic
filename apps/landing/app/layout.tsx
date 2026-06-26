import type { Metadata } from "next";
import { Oxanium, Space_Mono } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import "./globals.css";

const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-oxanium",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MarginOptic — Multi-Channel Profit Tracking",
  description:
    "See your real net profit, not just revenue. MarginOptic unifies Shopify, Amazon & eBay sales with ad spend, COGS, shipping, fees and refunds into one customizable profit dashboard.",
  icons: { icon: "/app-icon.svg" },
  openGraph: {
    title: "MarginOptic — See your real net profit, not just revenue",
    description:
      "Multi-channel profit analytics for e-commerce. Connect your stores and ad accounts, track true net profit per product, campaign and channel.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${oxanium.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}

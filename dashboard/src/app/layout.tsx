import type { Metadata } from "next";
import { Orbitron, Rajdhani } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  weight: ["500", "700", "900"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WC26 Predictor — Who Wins the World Cup?",
  description:
    "A live, daily-updating World Cup 2026 win-probability tracker: a stacked ML ensemble + Monte Carlo bracket simulation, tracked against bookmaker odds and validated against the 2018 & 2022 World Cups.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${rajdhani.variable} ${orbitron.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

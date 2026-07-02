import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
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
      className={`${inter.variable} ${bebas.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

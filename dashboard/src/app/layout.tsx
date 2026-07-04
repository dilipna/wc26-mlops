import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Lora, Manrope } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  weight: ["600", "700", "800", "900"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  weight: ["400", "500"],
  style: ["normal", "italic"],
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
      className={`${manrope.variable} ${bigShoulders.variable} ${plexMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

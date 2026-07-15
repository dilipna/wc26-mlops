import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

// Space Grotesk is the site's typeface -- sans, display, and serif all
// resolve to it (see globals.css). IBM Plex Mono is kept for the
// tabular/technical mono labels only.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
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
      className={`${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

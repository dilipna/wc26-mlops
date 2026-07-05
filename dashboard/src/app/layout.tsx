import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Who Wins the 2026 World Cup? — daily ML predictions",
  description:
    "A daily-updating World Cup 2026 prediction system I built end to end: stacked ensemble + Monte Carlo simulation, retrained every morning, with every prediction logged before kickoff and graded against real results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

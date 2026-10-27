import type { Metadata } from "next";
import localFont from "next/font/local";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import "./matchday.css";

// Space Grotesk is the site's typeface -- sans, display, and serif all
// resolve to it (see globals.css). IBM Plex Mono is kept for the
// tabular/technical mono labels only.
const spaceGrotesk = localFont({
  src: "../../public/fonts/SpaceGrotesk.woff2",
  variable: "--font-space-grotesk",
  display: "swap",
});
const plexMono = localFont({
  src: "../../public/fonts/IBMPlexMono.woff2",
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SpOps — Matchday & Sports Model Lab",
  description:
    "Explore current sports score snapshots, ask source-grounded match questions, save games and watch official highlights. Reproduce historical forecasts in the separate model lab.",
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

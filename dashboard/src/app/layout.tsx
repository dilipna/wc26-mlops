import type { Metadata } from "next";
import localFont from "next/font/local";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

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
  title: "SpOps — Sports Model Lab",
  description:
    "Explore historical basketball, NFL and cricket matchups, replay dated forecasts and inspect baseline comparisons, alongside the WC26 football engineering archive.",
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

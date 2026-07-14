"use client";

import { motion } from "framer-motion";
import { teamCode } from "@/lib/teamCode";
import type { PredictionRow } from "@/lib/data";

// The mockup (WC26 Dark Standalone.html) used a rotating-earth JPEG texture
// of unknown provenance/license -- same copyright caution the project
// already applied to player likenesses (see DECISIONS.md), so this is a
// from-scratch CSS/SVG globe impression instead of that image asset.
function HeroGlobe() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 0 }}
    >
      <div
        className="relative aspect-square w-[min(54vw,460px)]"
        style={{ animation: "wc-drift 14s ease-in-out infinite" }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, var(--globe-a), var(--globe-b), var(--globe-a) 35%, var(--globe-c) 60%, var(--globe-a) 100%)",
            animation: "wc-spin 60s linear infinite",
            filter: "brightness(0.85) saturate(0.95)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 46%), radial-gradient(circle at 50% 50%, transparent 50%, color-mix(in srgb, var(--background-deep) 50%, transparent) 76%, color-mix(in srgb, var(--background-deep) 92%, transparent) 100%)",
            boxShadow:
              "inset -34px -28px 80px rgba(0,0,0,0.8), inset 10px 10px 44px color-mix(in srgb, var(--accent) 12%, transparent), 0 0 100px color-mix(in srgb, var(--accent) 22%, transparent), 0 0 28px color-mix(in srgb, var(--accent) 20%, transparent)",
          }}
        />
      </div>
    </div>
  );
}

export default function Hero({
  topFavorite,
  latestDate,
}: {
  topFavorite: PredictionRow | undefined;
  latestDate: string | null;
}) {
  return (
    <section className="relative isolate flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-36 text-center">
      {/* layered depth background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 26px), radial-gradient(120% 90% at 50% 15%, rgba(255,255,255,0.10), transparent 60%), linear-gradient(180deg, var(--background-raised) 0%, var(--background) 55%, var(--background-deep) 100%)",
        }}
      />
      <HeroGlobe />
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: "radial-gradient(50% 44% at 50% 46%, rgba(10,10,12,0.42), transparent 72%)" }}
      />
      <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center opacity-50">
        <svg width="900" height="900" viewBox="0 0 900 900" className="max-w-none" style={{ animation: "wc-drift 14s ease-in-out infinite" }}>
          <circle cx="450" cy="450" r="330" fill="none" stroke="var(--foreground)" strokeOpacity="0.1" strokeWidth="1" />
          <circle
            cx="450"
            cy="450"
            r="230"
            fill="none"
            stroke="var(--foreground)"
            strokeOpacity="0.14"
            strokeWidth="1"
            strokeDasharray="6 10"
            style={{ animation: "wc-dash 10s linear infinite" }}
          />
        </svg>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 z-[1] h-[40%]"
        style={{ background: "linear-gradient(180deg, transparent, var(--background) 85%)" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mb-7 inline-flex items-center gap-2 overflow-hidden rounded-full border border-foreground/20 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground"
        style={{ background: "linear-gradient(180deg, var(--accent-warm), var(--card-alt))" }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
            style={{ animation: "wc-pulse 1.8s ease-in-out infinite" }}
          />
        </span>
        Live &middot; updated {latestDate ?? "daily"}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="font-display relative z-10 text-[clamp(32px,7vw,110px)] font-black uppercase leading-[1.05] tracking-tight text-foreground"
      >
        <div className="whitespace-nowrap">Who Wins</div>
        <div className="whitespace-nowrap font-extrabold italic text-accent">The World Cup?</div>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="font-serif relative z-10 mt-9 max-w-xl text-[17px] leading-relaxed text-foreground/65"
      >
        A stacked ensemble model rates every team, scores every match, then plays out the
        rest of the tournament 10,000 times a day &mdash; tested first on the 2018 &amp;
        2022 World Cups before being trusted with 2026.
      </motion.p>

      {topFavorite && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative z-10 mt-10 flex items-center gap-4 rounded-2xl border border-foreground/15 px-6 py-4"
          style={{ background: "var(--card)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15 font-mono text-xs text-accent"
            style={{ background: "var(--card-alt)" }}
          >
            {teamCode(topFavorite.team)}
          </div>
          <div className="text-left">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/40">
              Current favorite
            </div>
            <div className="font-display text-2xl font-extrabold text-foreground">
              {topFavorite.team}{" "}
              <span className="font-mono text-accent">
                {(topFavorite.win_probability * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        className="relative z-10 mt-14 font-mono text-[11px] tracking-[0.1em] text-foreground/35"
        style={{ animation: "wc-pulse 2.4s ease-in-out infinite" }}
      >
        &darr; SCROLL
      </motion.div>
    </section>
  );
}

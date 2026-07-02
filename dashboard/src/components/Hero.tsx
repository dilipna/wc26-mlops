"use client";

import { motion } from "framer-motion";
import AnimatedBackground from "./AnimatedBackground";
import Flag from "./Flag";
import { CelebrationFigure, DribblerFigure } from "./PlayerFigures";
import type { PredictionRow } from "@/lib/data";

export default function Hero({
  topFavorite,
  latestDate,
}: {
  topFavorite: PredictionRow | undefined;
  latestDate: string | null;
}) {
  return (
    <section className="relative isolate flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <AnimatedBackground />

      {/* flanking players: dribbler stage-left, celebration stage-right */}
      <motion.div
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute bottom-10 left-[2vw] z-[5] hidden h-[52vh] lg:block xl:left-[5vw]"
      >
        <DribblerFigure className="h-full" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute bottom-10 right-[2vw] z-[5] hidden h-[52vh] lg:block xl:right-[5vw]"
      >
        <CelebrationFigure className="h-full" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card relative z-10 mb-8 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-300"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
        </span>
        Live &middot; updated {latestDate ?? "daily"}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="font-display relative z-10 text-4xl font-bold leading-[1.05] text-white sm:text-6xl md:text-7xl"
      >
        WHO WINS
        <br />
        <span className="shimmer-text">THE WORLD CUP?</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="relative z-10 mt-6 max-w-xl text-lg text-white/60"
      >
        An AI that watches every match, re-rates every team, and plays out the
        rest of the tournament 10,000 times a day &mdash; tested first on the
        2018 &amp; 2022 World Cups before being trusted with 2026.
      </motion.p>

      {topFavorite && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="glass-card floating relative z-10 mt-10 flex items-center gap-4 rounded-2xl px-6 py-4"
        >
          <Flag team={topFavorite.team} className="text-4xl" />
          <div className="text-left">
            <div className="text-xs uppercase tracking-widest text-white/50">
              Current favorite
            </div>
            <div className="font-display text-2xl text-white">
              {topFavorite.team}{" "}
              <span className="neon-num text-cyan-300">
                {(topFavorite.win_probability * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-8 z-10 text-white/40"
      >
        ↓ scroll
      </motion.div>
    </section>
  );
}

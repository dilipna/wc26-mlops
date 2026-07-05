"use client";

import { motion } from "framer-motion";
import { teamCode } from "@/lib/teamCode";
import type { PredictionRow } from "@/lib/data";

export default function Hero({
  topFavorite,
  latestDate,
}: {
  topFavorite: PredictionRow | undefined;
  latestDate: string | null;
}) {
  return (
    <section className="relative flex min-h-[70vh] flex-col justify-center overflow-hidden px-6 pb-20 pt-32 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 12% 0%, rgba(57,135,229,0.08), transparent 60%), linear-gradient(180deg, #100f0d 0%, #0d0c0a 60%, #0a0908 100%)",
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 font-mono text-xs text-text-muted"
        >
          Updated daily &middot; last refresh {latestDate ?? "pending"}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl text-[clamp(30px,5.2vw,58px)] font-bold leading-[1.08] text-foreground"
        >
          Who wins the 2026 World Cup?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 max-w-xl text-[16px] leading-relaxed text-text-secondary"
        >
          I built a machine-learning system that answers this question every morning.
          It rates every team, simulates the rest of the tournament 10,000 times, and
          logs each prediction before kickoff — so you can check whether it was right,
          not just take my word for it.
        </motion.p>

        {topFavorite && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 inline-flex items-center gap-4 rounded-xl border border-border bg-surface-1 px-5 py-3.5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-2 font-mono text-xs text-series-1">
              {teamCode(topFavorite.team)}
            </div>
            <div className="text-left">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Today&apos;s favorite
              </div>
              <div className="text-xl font-bold text-foreground">
                {topFavorite.team}{" "}
                <span className="font-mono text-series-1">{(topFavorite.win_probability * 100).toFixed(1)}%</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

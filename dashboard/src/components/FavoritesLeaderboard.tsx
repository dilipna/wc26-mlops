"use client";

import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";
import Flag from "./Flag";
import type { PredictionRow } from "@/lib/data";

const BAR_COLORS = [
  "from-cyan-300 to-cyan-500",
  "from-fuchsia-300 to-fuchsia-500",
  "from-lime-300 to-lime-500",
  "from-violet-300 to-violet-500",
  "from-rose-300 to-rose-500",
];

export default function FavoritesLeaderboard({ favorites }: { favorites: PredictionRow[] }) {
  const max = favorites[0]?.win_probability ?? 1;

  return (
    <div className="grid gap-4">
      {favorites.map((row, i) => (
        <motion.div
          key={row.team}
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card group relative overflow-hidden rounded-2xl p-5 transition-transform hover:scale-[1.015]"
        >
          <div className="flex items-center gap-4">
            <div className="font-display w-8 shrink-0 text-2xl text-white/30">
              {i + 1}
            </div>
            <Flag team={row.team} className="text-3xl shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-lg font-semibold text-white">
                  {row.team}
                </span>
                <AnimatedCounter
                  value={row.win_probability * 100}
                  className="font-display text-2xl text-white shrink-0"
                />
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(row.win_probability / max) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: i * 0.08 + 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full bg-gradient-to-r ${BAR_COLORS[i % BAR_COLORS.length]}`}
                />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

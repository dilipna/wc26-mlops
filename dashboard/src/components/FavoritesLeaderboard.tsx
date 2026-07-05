"use client";

import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";
import { teamCode } from "@/lib/teamCode";
import type { PredictionRow } from "@/lib/data";

export default function FavoritesLeaderboard({ favorites }: { favorites: PredictionRow[] }) {
  const max = favorites[0]?.win_probability ?? 1;

  return (
    <div className="flex flex-col gap-0.5">
      {favorites.map((row, i) => (
        <motion.div
          key={row.team}
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-[36px_44px_1fr_auto] items-center gap-4 border-b border-foreground/10 py-[18px] px-3"
        >
          <div className="font-mono text-sm text-foreground/35">0{i + 1}</div>
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-foreground/10 font-mono text-[11px] text-foreground/60"
            style={{ background: "#171510" }}
          >
            {teamCode(row.team)}
          </div>
          <div className="min-w-0">
            <div className="font-display mb-2 truncate text-xl font-bold text-foreground">
              {row.team}
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${(row.win_probability / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ background: i === 0 ? "var(--accent)" : "var(--foreground)" }}
              />
            </div>
          </div>
          <AnimatedCounter
            value={row.win_probability * 100}
            className={`font-mono text-2xl font-semibold shrink-0 ${i === 0 ? "text-accent" : "text-foreground"}`}
          />
        </motion.div>
      ))}
    </div>
  );
}

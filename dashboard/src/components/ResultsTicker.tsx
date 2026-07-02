"use client";

import { motion } from "framer-motion";
import Flag from "./Flag";
import type { MatchResult } from "@/lib/data";

export default function ResultsTicker({ results }: { results: MatchResult[] }) {
  const recent = results.slice(0, 8);
  if (recent.length === 0) return null;

  return (
    <div className="overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="flex flex-wrap gap-3"
      >
        {recent.map((r, i) => (
          <motion.div
            key={`${r.date}-${r.home_team}-${r.away_team}`}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="glass-card flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            <Flag team={r.home_team} />
            <span className="font-semibold text-white">{r.home_score}</span>
            <span className="text-white/30">-</span>
            <span className="font-semibold text-white">{r.away_score}</span>
            <Flag team={r.away_team} />
            <span className="ml-1 text-white/40">
              {r.home_team} vs {r.away_team}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

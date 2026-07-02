"use client";

import { motion } from "framer-motion";

export default function StatsStrip({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="glass-card rounded-2xl p-5 text-center"
        >
          <div className="font-display neon-num text-2xl text-white sm:text-3xl">{s.value}</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-white/40">{s.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

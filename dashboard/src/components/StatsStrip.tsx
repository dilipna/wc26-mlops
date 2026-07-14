"use client";

import { motion } from "framer-motion";

export default function StatsStrip({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  return (
    <div
      className="grid gap-px border-y border-foreground/10"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", background: "var(--card-border)" }}
    >
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="bg-background px-5 py-7 text-center"
        >
          <div className="font-mono text-[clamp(28px,4vw,40px)] font-semibold text-foreground">{s.value}</div>
          <div className="mt-2 text-xs tracking-[0.06em] text-foreground/50">{s.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

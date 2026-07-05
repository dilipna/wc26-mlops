"use client";

import { motion } from "framer-motion";
import { CHECKPOINT_LABELS, CHECKPOINT_ORDER, type BacktestYear } from "@/lib/data";

function CheckpointBars({ year }: { year: BacktestYear }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {CHECKPOINT_ORDER.map((cp, i) => {
        const checkpoint = year.checkpoints[cp];
        if (!checkpoint) return null;
        const modelPct = checkpoint.model.champion_prob * 100;
        const baselinePct = checkpoint.baseline.champion_prob * 100;
        const max = Math.max(modelPct, baselinePct, 1);

        return (
          <div key={cp} className="text-center">
            <div className="flex h-28 items-end justify-center gap-1.5">
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: `${(modelPct / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="w-4 rounded-t-sm"
                style={{ background: "var(--accent)" }}
                title={`Model: ${modelPct.toFixed(1)}%`}
              />
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: `${(baselinePct / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.1 + 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="w-4 rounded-t-sm bg-foreground/25"
                title={`Baseline: ${baselinePct.toFixed(1)}%`}
              />
            </div>
            <div className="font-mono mt-2 text-[10px] uppercase tracking-[0.06em] text-foreground/40">{CHECKPOINT_LABELS[cp]}</div>
            <div className="font-mono text-[15px] font-semibold text-foreground">{modelPct.toFixed(0)}%</div>
          </div>
        );
      })}
    </div>
  );
}

export default function ModelValidation({ backtest }: { backtest: Record<string, BacktestYear> }) {
  const years = Object.values(backtest).sort((a, b) => a.year - b.year);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {years.map((year, i) => (
        <motion.div
          key={year.year}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-baseline justify-between mb-[22px]">
            <span className="font-display text-2xl font-extrabold text-foreground">{year.year}</span>
            <span className="font-mono text-xs text-foreground/50">
              Champion: <span className="text-foreground">{year.champion}</span>
            </span>
          </div>
          <CheckpointBars year={year} />
          <div className="mt-5 flex items-center gap-4 text-[11px] text-foreground/40">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} /> Our AI
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-foreground/30" /> World-ranking guess
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

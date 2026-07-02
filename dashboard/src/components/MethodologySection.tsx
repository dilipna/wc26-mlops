"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    icon: "🧠",
    title: "Layer 1 — Match Predictions",
    body:
      "A stacked ensemble of XGBoost, an Elo/logistic-regression baseline, and a FIFA-rank heuristic, blended together for every possible matchup.",
  },
  {
    icon: "🎲",
    title: "Layer 2 — Bracket Simulation",
    body:
      "10,000+ Monte Carlo simulations of the actual remaining bracket, using Layer 1's probabilities recursively, to find each team's true P(wins it all).",
  },
  {
    icon: "📈",
    title: "Daily Time Series",
    body:
      "Every day of the tournament, ratings update, predictions re-run, and one row per team lands in the log below — the same series driving the chart above.",
  },
];

export default function MethodologySection() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {STEPS.map((step, i) => (
        <motion.div
          key={step.title}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="mb-4 text-4xl">{step.icon}</div>
          <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
          <p className="text-sm leading-relaxed text-white/60">{step.body}</p>
        </motion.div>
      ))}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    icon: "📈",
    title: "Rate Every Team",
    body:
      "Every team carries a strength score that rises and falls with each real result. Recent form counts for more than ancient history.",
  },
  {
    icon: "🧠",
    title: "Predict Every Match",
    body:
      "Three different predictors — a machine-learning model, a ratings model, and a world-ranking rule — each give a view, blended into one probability per match.",
  },
  {
    icon: "🎲",
    title: "Play It Out 10,000 Times",
    body:
      "The remaining tournament is simulated ten thousand times a day. Count how often each nation lifts the trophy — that's their chance of winning it all.",
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

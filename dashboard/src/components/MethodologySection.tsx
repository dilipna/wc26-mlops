"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    num: "01",
    title: "Rate Every Team",
    body:
      "Every team carries a strength score that rises and falls with each real result. Recent form counts for more than ancient history.",
  },
  {
    num: "02",
    title: "Predict Every Match",
    body:
      "Three different predictors — a machine-learning model, a ratings model, and a world-ranking rule — each give a view, blended into one probability per match.",
  },
  {
    num: "03",
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
          className="glass-card rounded-2xl p-[26px]"
        >
          <div className="font-mono mb-4 text-[13px] text-accent">{step.num}</div>
          <h3 className="font-display mb-2.5 text-[22px] font-bold uppercase text-foreground">{step.title}</h3>
          <p className="text-sm leading-relaxed text-foreground/55">{step.body}</p>
        </motion.div>
      ))}
    </div>
  );
}

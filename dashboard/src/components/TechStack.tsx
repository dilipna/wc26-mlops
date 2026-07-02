"use client";

import { motion } from "framer-motion";

const GROUPS: { label: string; accent: string; items: string[] }[] = [
  {
    label: "Data & Machine Learning",
    accent: "text-cyan-300 border-cyan-400/30",
    items: [
      "Python",
      "pandas",
      "scikit-learn",
      "XGBoost",
      "Elo ratings",
      "Monte Carlo simulation",
    ],
  },
  {
    label: "Live Data Feeds",
    accent: "text-fuchsia-300 border-fuchsia-400/30",
    items: [
      "The Odds API — live scores & market odds",
      "Open historical datasets — internationals since 1872, FIFA rankings",
    ],
  },
  {
    label: "This Website",
    accent: "text-violet-300 border-violet-400/30",
    items: ["Next.js", "TypeScript", "Tailwind CSS", "Framer Motion", "Recharts"],
  },
  {
    label: "Engineering Practice",
    accent: "text-lime-300 border-lime-400/30",
    items: ["Git & GitHub", "pytest", "Decision log (DECISIONS.md)", "Backtesting before going live"],
  },
];

const COMING_NEXT = ["Airflow", "Docker", "MLflow", "Kubernetes"];

export default function TechStack() {
  return (
    <div className="space-y-8">
      {GROUPS.map((group, gi) => (
        <motion.div
          key={group.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: gi * 0.08 }}
        >
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {group.items.map((item) => (
              <span
                key={item}
                className={`glass-card rounded-full border px-4 py-1.5 text-sm font-medium ${group.accent}`}
              >
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
          Coming Next
        </div>
        <div className="flex flex-wrap gap-2.5">
          {COMING_NEXT.map((item) => (
            <span
              key={item}
              className="rounded-full border border-dashed border-white/25 px-4 py-1.5 text-sm font-medium text-white/50"
            >
              {item}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

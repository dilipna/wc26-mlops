"use client";

import { motion } from "framer-motion";

const GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Data & Machine Learning",
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
    items: [
      "The Odds API — live scores & market odds",
      "Open historical datasets — internationals since 1872, FIFA rankings",
    ],
  },
  {
    label: "This Website",
    items: ["Next.js", "TypeScript", "Tailwind CSS", "Framer Motion", "Recharts"],
  },
  {
    label: "Engineering Practice",
    items: ["Git & GitHub", "pytest", "Decision log (DECISIONS.md)", "Backtesting before going live"],
  },
  {
    label: "MLOps Infrastructure",
    items: [
      "Airflow",
      "Docker",
      "MLflow",
      "Supabase",
      "FastAPI + OpenTelemetry — live serving API",
      "Evidently — daily drift reports",
      "Kubernetes — local kind cluster",
    ],
  },
];

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
          <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.16em] text-foreground/40">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {group.items.map((item) => (
              <span
                key={item}
                className="font-mono glass-card rounded-full px-4 py-2 text-[12.5px] text-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

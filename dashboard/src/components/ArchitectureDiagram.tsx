const STAGES: { label: string; detail: string }[] = [
  { label: "Ingestion", detail: "Historical CSVs (1872+) + The Odds API" },
  { label: "Feature engineering", detail: "Leakage-safe Elo + form + rank as-of snapshots" },
  { label: "Layer 1", detail: "Stacked ensemble: XGBoost + Elo/logreg + FIFA heuristic" },
  { label: "Layer 2", detail: "Monte Carlo (10,000 sims) over the real remaining bracket" },
  { label: "Predictions store", detail: "CSV + Supabase Postgres (durable, timestamped)" },
  { label: "Verify + monitor", detail: "Grading vs real results + Evidently feature drift" },
  { label: "Export", detail: "Static JSON build artifacts" },
  { label: "Dashboard", detail: "Next.js, statically built, deployed on Vercel" },
];

export default function ArchitectureDiagram() {
  return (
    <div className="glass-card overflow-x-auto p-6">
      <div className="flex min-w-max items-stretch gap-2">
        {STAGES.map((stage, i) => (
          <div key={stage.label} className="flex items-stretch gap-2">
            <div className="flex w-[168px] flex-col justify-center rounded-md border border-border bg-surface-2 px-3 py-3">
              <div className="font-mono text-xs font-semibold text-series-1">{stage.label}</div>
              <div className="mt-1 text-[11px] leading-snug text-text-secondary">{stage.detail}</div>
            </div>
            {i < STAGES.length - 1 && <span className="flex items-center font-mono text-text-muted">&rarr;</span>}
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-[11px] text-text-muted">
        In parallel: FastAPI serving layer (Dockerized, Render-deployed) + Airflow DAG (local docker-compose,
        06:00 UTC daily) + MLflow experiment tracking/registry + GitHub Actions CI on every push.
      </p>
    </div>
  );
}

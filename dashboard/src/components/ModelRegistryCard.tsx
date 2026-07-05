import type { ModelRegistry } from "@/lib/data";

const MEMBER_LABELS: Record<string, string> = {
  xgboost: "XGBoost",
  elo_logreg: "Elo / logistic regression",
  fifa_heuristic: "FIFA-rank heuristic",
};

export default function ModelRegistryCard({ registry }: { registry: ModelRegistry }) {
  const influenceEntries = Object.entries(registry.member_influence).sort((a, b) => b[1] - a[1]);

  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Registered model</div>
          <div className="mt-1 font-mono text-lg text-foreground">{registry.registered_model_name}</div>
        </div>
        <span className="status-pill">
          <span className={`status-dot ${registry.mlflow_reachable ? "status-dot--good" : "status-dot--warning"}`} />
          {registry.mlflow_reachable ? `version ${registry.version}` : "mlflow unreachable at export time"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <dl className="space-y-2 font-mono text-xs">
          <div className="flex justify-between"><dt className="text-text-secondary">Trained at</dt><dd className="text-foreground">{registry.trained_at ? `${registry.trained_at.slice(0, 16).replace("T", " ")} UTC` : "n/a"}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Training window</dt><dd className="text-foreground">{registry.params.train_start ?? "?"} &rarr; {registry.params.train_end ?? "?"}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Training rows</dt><dd className="tabular-nums text-foreground">{Number(registry.params.n_training_rows ?? 0).toLocaleString() || "n/a"}</dd></div>
        </dl>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
            Ensemble member weights
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            How much each base model sways the final call (from the fitted meta-learner, not SHAP).
          </p>
          <div className="mt-3 space-y-2">
            {influenceEntries.length === 0 && <div className="text-xs text-text-muted">n/a</div>}
            {influenceEntries.map(([member, value]) => (
              <div key={member}>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-text-secondary">{MEMBER_LABELS[member] ?? member}</span>
                  <span className="tabular-nums text-foreground">{(value * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                  <div className="h-1.5 rounded-full bg-series-1" style={{ width: `${value * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Feature schema (6)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {registry.feature_names.map((f) => (
            <span key={f} className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-text-secondary">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

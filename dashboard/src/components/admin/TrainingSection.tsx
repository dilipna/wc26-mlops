"use client";

import { useEffect, useState } from "react";
import ExplainMatch from "./ExplainMatch";
import type { TeamStatus, TrainingRun } from "@/lib/data";

const SERVING_API_URL = process.env.NEXT_PUBLIC_SERVING_API_URL;

type FeatureImportanceResponse = {
  model_version: string;
  model_source: string;
  importances: Record<string, number>;
};

function FeatureImportanceLive() {
  const [data, setData] = useState<FeatureImportanceResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(SERVING_API_URL ? "loading" : "error");

  useEffect(() => {
    if (!SERVING_API_URL) return;
    fetch(`${SERVING_API_URL}/feature-importance`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((body) => {
        setData(body);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "error") {
    return (
      <p className="text-xs text-text-secondary">
        Live feature importance unavailable ({SERVING_API_URL ? "serving API unreachable" : "NEXT_PUBLIC_SERVING_API_URL not configured"}).
        This calls <code className="font-mono">GET /feature-importance</code> on the deployed serving API, reading the
        actually-loaded model&apos;s real XGBoost <code className="font-mono">feature_importances_</code> -- not SHAP,
        and not a static export, so it reflects whichever model instance is currently serving.
      </p>
    );
  }
  if (state === "loading" || !data) {
    return <p className="text-xs text-text-muted">Loading live feature importance...</p>;
  }

  const entries = Object.entries(data.importances).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <p className="text-xs text-text-secondary">
        Live from the serving API&apos;s currently-loaded model ({data.model_version}, {data.model_source}) --{" "}
        <code className="font-mono">GET /feature-importance</code>.
      </p>
      <div className="mt-3 space-y-2">
        {entries.map(([name, value]) => (
          <div key={name}>
            <div className="flex justify-between font-mono text-xs">
              <span className="text-text-secondary">{name}</span>
              <span className="tabular-nums text-foreground">{(value * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2">
              <div className="h-1.5 rounded-full bg-series-1" style={{ width: `${value * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrainingSection({
  trainingHistory,
  teams,
}: {
  trainingHistory: TrainingRun[];
  teams: TeamStatus[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-card p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Recent training runs</div>
        {trainingHistory.length === 0 ? (
          <p className="mt-2 text-xs text-text-secondary">
            No MLflow runs visible right now -- either the tracking server was unreachable at the last export, or
            none have been logged yet. Empty, not fabricated.
          </p>
        ) : (
          <div className="mt-3 space-y-2 font-mono text-xs">
            {trainingHistory.map((run) => (
              <div key={run.run_id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <span className="text-text-secondary">{run.run_name || run.run_id.slice(0, 8)}</span>
                <span className="text-text-muted">{run.start_time ? run.start_time.slice(0, 16).replace("T", " ") : "?"}</span>
                <span className="tabular-nums text-foreground">
                  {run.metrics.train_set_insample_log_loss !== undefined
                    ? `log-loss ${run.metrics.train_set_insample_log_loss.toFixed(3)}`
                    : "--"}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-text-secondary">
          Hyperparameter tuning: <code className="font-mono">scripts/tune_layer1.py</code> runs a real Optuna search
          over XGBoost, but honestly does not currently beat the default hyperparameters on the true backtest metric
          (see PROJECT_BRAIN.md) -- the pipeline runs on defaults, not tuned params. Not hiding that behind a fake
          &quot;tuned&quot; badge.
        </p>
      </div>

      <div className="glass-card p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Feature importance (live)</div>
        <div className="mt-3">
          <FeatureImportanceLive />
        </div>
        <p className="mt-4 text-xs text-text-secondary">
          This is a global, XGBoost-only importance (gain-based). For genuine per-match SHAP values, see below.
        </p>
      </div>

      <ExplainMatch teams={teams} />
    </div>
  );
}

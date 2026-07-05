"use client";

import { useState } from "react";
import type { TeamStatus } from "@/lib/data";

const SERVING_API_URL = process.env.NEXT_PUBLIC_SERVING_API_URL;

type ExplainResponse = {
  team_a: string;
  team_b: string;
  model_version: string;
  base_values: { loss: number; draw: number; win: number };
  feature_values: Record<string, number>;
  shap_values: Record<string, { loss: number; draw: number; win: number }>;
};

export default function ExplainMatch({ teams }: { teams: TeamStatus[] }) {
  const teamNames = teams.map((t) => t.team);
  const [homeTeam, setHomeTeam] = useState(teamNames[0] ?? "");
  const [awayTeam, setAwayTeam] = useState(teamNames[1] ?? "");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [data, setData] = useState<ExplainResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const run = () => {
    if (!SERVING_API_URL || homeTeam === awayTeam) return;
    setState("loading");
    const start = performance.now();
    fetch(`${SERVING_API_URL}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ home_team: homeTeam, away_team: awayTeam }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((body: ExplainResponse) => {
        setLatencyMs(Math.round(performance.now() - start));
        setData(body);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  const winProb = data
    ? data.base_values.win + Object.values(data.shap_values).reduce((sum, v) => sum + v.win, 0)
    : null;
  const entries = data
    ? Object.entries(data.shap_values).sort((a, b) => Math.abs(b[1].win) - Math.abs(a[1].win))
    : [];
  const maxAbs = entries.length ? Math.max(...entries.map(([, v]) => Math.abs(v.win))) : 1;

  return (
    <div className="glass-card p-6 lg:col-span-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
        Explain a prediction (live SHAP)
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        Real per-match Shapley values from the deployed serving API (<code className="font-mono">POST /explain</code>)
        — genuine local interpretability ("why did the model say this, for this specific match"), not the global
        feature importance above. Bars below show each feature&apos;s real contribution to the home team&apos;s win
        probability for the matchup selected.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs">
        <select
          value={homeTeam}
          onChange={(e) => setHomeTeam(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-foreground"
        >
          {teamNames.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-text-muted">vs</span>
        <select
          value={awayTeam}
          onChange={(e) => setAwayTeam(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-foreground"
        >
          {teamNames.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={!SERVING_API_URL || homeTeam === awayTeam || state === "loading"}
          className="rounded-md border border-series-1 px-3 py-1.5 text-series-1 transition-colors hover:bg-series-1 hover:text-background disabled:opacity-40"
        >
          {state === "loading" ? "Explaining..." : "Explain"}
        </button>
        {latencyMs !== null && state === "ready" && (
          <span className="text-text-muted">{latencyMs}ms round trip</span>
        )}
      </div>

      {state === "error" && (
        <p className="mt-4 text-xs text-text-secondary">
          {SERVING_API_URL ? "Serving API unreachable." : "NEXT_PUBLIC_SERVING_API_URL not configured in this build."}
        </p>
      )}

      {state === "ready" && data && (
        <div className="mt-5">
          <div className="mb-3 font-mono text-xs text-text-secondary">
            {data.team_a} win probability:{" "}
            <span className="text-foreground">{((winProb ?? 0) * 100).toFixed(1)}%</span>
            {" "}(base {(data.base_values.win * 100).toFixed(1)}% + feature contributions below, model{" "}
            {data.model_version})
          </div>
          <div className="space-y-2">
            {entries.map(([name, v]) => {
              const pct = (v.win / maxAbs) * 50;
              const positive = v.win >= 0;
              return (
                <div key={name} className="flex items-center gap-3 font-mono text-xs">
                  <span className="w-40 shrink-0 truncate text-text-secondary">{name}</span>
                  <div className="relative h-4 flex-1 rounded bg-surface-2">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <div
                      className="absolute inset-y-0 rounded"
                      style={{
                        left: positive ? "50%" : `${50 + pct}%`,
                        width: `${Math.abs(pct)}%`,
                        background: positive ? "var(--status-good)" : "var(--status-critical)",
                      }}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-foreground">
                    {positive ? "+" : ""}
                    {(v.win * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

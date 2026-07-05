"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DriftData } from "@/lib/data";

const FEATURE_COLORS: Record<string, string> = {
  elo_diff: "var(--series-1)",
  form_goals_for_diff: "var(--series-2)",
  form_goals_against_diff: "var(--series-3)",
  form_win_rate_diff: "var(--series-5)",
  rank_points_diff: "var(--series-6)",
};

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg px-3 py-2 text-xs">
      <div className="font-mono mb-1 text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span className="text-text-secondary">{entry.name}</span>
          <span className="font-mono ml-auto font-semibold" style={{ color: entry.color }}>{entry.value.toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DriftDashboard({ drift }: { drift: DriftData }) {
  const { latest, history } = drift;

  if (!latest) {
    return (
      <div className="glass-card p-6 text-sm text-text-secondary">
        No drift check has run yet -- <code className="font-mono text-xs">scripts/check_drift.py</code> needs at
        least one 2026 match to compare against the historical reference window.
      </div>
    );
  }

  const featureNames = Object.keys(latest.columns);
  const trendRows = history.map((row) => {
    const point: Record<string, number | string> = { generated_at: row.generated_at };
    for (const feature of featureNames) {
      const raw = row[`${feature}_drift_score`];
      if (raw !== undefined) point[feature] = Number(raw);
    }
    return point;
  });

  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="status-pill">
          <span className={`status-dot ${latest.dataset_drift ? "status-dot--serious" : "status-dot--good"}`} />
          dataset drift: {latest.dataset_drift ? "detected" : "not detected"}
        </span>
        <span className="font-mono text-xs text-text-muted">
          as of {latest.generated_at} -- reference {latest.reference_window[0]}&rarr;{latest.reference_window[1]}
          {" "}({latest.reference_rows.toLocaleString()} rows) vs current {latest.current_window[0]}&rarr;{latest.current_window[1]}
          {" "}({latest.current_rows.toLocaleString()} rows)
        </span>
      </div>

      <div className="mt-5 grid gap-2">
        {featureNames.map((feature) => {
          const info = latest.columns[feature];
          const pct = Math.min(info.drift_score * 100 * 4, 100); // visual scale: scores here cluster well under 0.25
          return (
            <div key={feature}>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-text-secondary">{feature}</span>
                <span className={info.drift_detected ? "text-status-serious" : "text-foreground"}>
                  {info.drift_score.toFixed(4)} {info.drift_detected ? "(drift)" : ""}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${pct}%`, background: info.drift_detected ? "var(--status-serious)" : "var(--status-good)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[11px] text-text-muted">
        {Object.values(latest.columns)[0]?.stattest_name} &middot; checked daily by the pipeline
      </p>

      {trendRows.length >= 3 && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
            Drift score trend
          </div>
          <div className="mt-3 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="var(--gridline)" vertical={false} />
                <XAxis dataKey="generated_at" stroke="var(--text-muted)" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-plex-mono), monospace" }} tickLine={false} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-plex-mono), monospace" }} tickLine={false} width={48} />
                <Tooltip content={<TrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-plex-mono), monospace" }} />
                {featureNames.map((feature) => (
                  <Line
                    key={feature}
                    type="monotone"
                    dataKey={feature}
                    stroke={FEATURE_COLORS[feature] ?? "var(--series-1)"}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

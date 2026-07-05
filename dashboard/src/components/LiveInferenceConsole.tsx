"use client";

import { useState } from "react";
import { teamCode } from "@/lib/teamCode";

const SERVING_API_URL = process.env.NEXT_PUBLIC_SERVING_API_URL;

type InferenceResult = {
  requestId: string | null;
  serverLatencyMs: string | null;
  clientLatencyMs: number;
  timestamp: string;
  homeTeam: string;
  awayTeam: string;
  modelVersion: string;
  outcomes: { home_win: number; draw: number; away_win: number };
};

export default function LiveInferenceConsole({ teams }: { teams: string[] }) {
  const [homeTeam, setHomeTeam] = useState(teams[0] ?? "");
  const [awayTeam, setAwayTeam] = useState(teams[1] ?? teams[0] ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [result, setResult] = useState<InferenceResult | null>(null);

  async function runPrediction() {
    if (!SERVING_API_URL) {
      setStatus("error");
      setErrorDetail("NEXT_PUBLIC_SERVING_API_URL is not configured for this deployment.");
      return;
    }
    setStatus("loading");
    setErrorDetail(null);
    const start = performance.now();
    try {
      const resp = await fetch(`${SERVING_API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_team: homeTeam, away_team: awayTeam }),
      });
      const clientLatencyMs = Math.round(performance.now() - start);
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }
      const body = await resp.json();
      setResult({
        requestId: resp.headers.get("X-Request-ID"),
        serverLatencyMs: resp.headers.get("X-Response-Time-Ms"),
        clientLatencyMs,
        timestamp: new Date().toISOString(),
        homeTeam: body.home_team,
        awayTeam: body.away_team,
        modelVersion: body.model_version,
        outcomes: body.model,
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorDetail(
        `${err instanceof Error ? err.message : String(err)} -- if this is the first request in a while, ` +
          "the free-tier serving instance may be cold-starting (~10s); try again."
      );
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Home team</span>
          <select
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
          >
            {teams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Away team</span>
          <select
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
          >
            {teams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button
          onClick={runPrediction}
          disabled={status === "loading"}
          className="rounded-md bg-series-1 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" ? "Calling live API..." : "Run prediction"}
        </button>
      </div>

      {status === "loading" && (
        <p className="mt-4 font-mono text-xs text-text-muted">
          Waking the deployed inference service -- free-tier cold start can take ~10s on the first call.
        </p>
      )}

      {status === "error" && (
        <div className="mt-4 rounded-md border border-status-critical/40 bg-status-critical/10 px-4 py-3 text-sm text-foreground">
          <span className="status-dot status-dot--critical mr-2 inline-block" />
          {errorDetail}
        </div>
      )}

      {status === "done" && result && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              {teamCode(result.homeTeam)} vs {teamCode(result.awayTeam)} -- outcome probabilities
            </div>
            <dl className="mt-3 space-y-2 font-mono text-sm">
              <div className="flex justify-between"><dt className="text-text-secondary">{result.homeTeam} win</dt><dd className="tabular-nums text-series-1">{(result.outcomes.home_win * 100).toFixed(1)}%</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Draw</dt><dd className="tabular-nums text-series-3">{(result.outcomes.draw * 100).toFixed(1)}%</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">{result.awayTeam} win</dt><dd className="tabular-nums text-series-6">{(result.outcomes.away_win * 100).toFixed(1)}%</dd></div>
            </dl>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Inference metadata (this request)</div>
            <dl className="mt-3 space-y-2 font-mono text-xs">
              <div className="flex justify-between gap-3"><dt className="text-text-secondary">Request ID</dt><dd className="truncate text-foreground">{result.requestId ?? "n/a"}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Model version</dt><dd className="text-foreground">{result.modelVersion}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Server latency</dt><dd className="tabular-nums text-foreground">{result.serverLatencyMs ? `${result.serverLatencyMs}ms` : "n/a"}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Round-trip latency</dt><dd className="tabular-nums text-foreground">{result.clientLatencyMs}ms</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Confidence (top pick)</dt><dd className="tabular-nums text-foreground">{(Math.max(result.outcomes.home_win, result.outcomes.draw, result.outcomes.away_win) * 100).toFixed(1)}%</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Timestamp</dt><dd className="text-foreground">{result.timestamp}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

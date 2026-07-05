"use client";

import { useState } from "react";
import { REPO } from "@/lib/site";

const SERVING_API_URL = process.env.NEXT_PUBLIC_SERVING_API_URL;

function LatencyProbe() {
  const [samples, setSamples] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);

  const run = async () => {
    if (!SERVING_API_URL) return;
    setChecking(true);
    const start = performance.now();
    try {
      const resp = await fetch(`${SERVING_API_URL}/health`);
      const serverMs = resp.headers.get("X-Response-Time-Ms");
      const roundTripMs = performance.now() - start;
      setSamples((s) => [...s, serverMs ? parseFloat(serverMs) : roundTripMs].slice(-10));
    } catch {
      // unreachable -- leave samples as-is, no fabricated reading
    } finally {
      setChecking(false);
    }
  };

  const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;

  return (
    <div>
      <button
        onClick={run}
        disabled={!SERVING_API_URL || checking}
        className="rounded-md border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-foreground hover:opacity-80 disabled:opacity-40"
      >
        {checking ? "pinging..." : "Ping /health"}
      </button>
      <p className="mt-2 text-xs text-text-secondary">
        {SERVING_API_URL
          ? samples.length
            ? `${samples.length} live sample(s), avg ${avg!.toFixed(1)}ms (server-measured X-Response-Time-Ms, same header the Live Inference Console reads)`
            : "Click to take a real latency sample -- no history is persisted server-side yet, so this is a live reading, not a stored time series."
          : "NEXT_PUBLIC_SERVING_API_URL not configured in this build."}
      </p>
    </div>
  );
}

export default function MonitoringSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-card p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Prediction latency</div>
        <div className="mt-3">
          <LatencyProbe />
        </div>
      </div>
      <div className="glass-card p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
          API traffic, CPU/memory, container status
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          <strong className="text-foreground">Not yet implemented</strong> as persisted metrics -- Render&apos;s free
          tier doesn&apos;t expose container-level CPU/memory, and no traffic aggregation is stored yet (Tier 3:
          Prometheus/Grafana, see CLAUDE.md). What is real today: request-level{" "}
          <code className="font-mono">X-Request-ID</code>/<code className="font-mono">X-Response-Time-Ms</code>{" "}
          headers on every response (see the latency probe), and Docker healthchecks on{" "}
          <a
            href={`https://github.com/${REPO}/blob/main/docker-compose.airflow.yml`}
            target="_blank"
            rel="noreferrer"
            className="text-series-1 hover:underline"
          >
            mlflow/serving/airflow-webserver
          </a>{" "}
          in the local docker-compose stack, verified live each session (see PROJECT_BRAIN.md).
        </p>
      </div>
    </div>
  );
}

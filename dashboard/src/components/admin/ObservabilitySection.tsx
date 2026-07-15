"use client";

import { useEffect, useState } from "react";
import { REPO } from "@/lib/site";

const SERVING_API_URL = process.env.NEXT_PUBLIC_SERVING_API_URL;

type MetricsSummary = {
  enabled: boolean;
  uptime_seconds?: number;
  requests_total?: number;
  avg_latency_ms?: number | null;
  predictions_total?: number;
  predictions_by_outcome?: Record<string, number>;
};

type FetchState = "checking" | "ok" | "unreachable";

function fmtUptime(seconds?: number): string {
  if (seconds == null) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-4 py-3">
      <div className="font-mono text-2xl text-foreground">{value}</div>
      <div className="mt-1 text-xs text-text-secondary">{label}</div>
      {sub && <div className="mt-0.5 font-mono text-[11px] text-text-muted">{sub}</div>}
    </div>
  );
}

export default function ObservabilitySection() {
  const [state, setState] = useState<FetchState>(SERVING_API_URL ? "checking" : "unreachable");
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);

  useEffect(() => {
    if (!SERVING_API_URL) return;
    let cancelled = false;
    fetch(`${SERVING_API_URL}/metrics-summary`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: MetricsSummary) => {
        if (!cancelled) {
          setMetrics(data);
          setState("ok");
        }
      })
      .catch(() => {
        if (!cancelled) setState("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const outcomes = metrics?.predictions_by_outcome ?? {};
  const outcomeSummary = Object.keys(outcomes).length
    ? Object.entries(outcomes)
        .map(([k, v]) => `${k}: ${v}`)
        .join("  ·  ")
    : "none yet";

  return (
    <div className="space-y-4">
      {/* Live production metrics -- the genuine, always-real signal */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm text-foreground">Live serving metrics</h3>
          <span className="status-pill">
            <span
              className={`status-dot ${
                state === "checking"
                  ? "status-dot--warning status-dot--pulse"
                  : state === "ok"
                    ? "status-dot--good"
                    : "status-dot--critical"
              }`}
            />
            {state === "checking" ? "reading /metrics-summary..." : state === "ok" ? "live" : "unreachable"}
          </span>
        </div>

        {state === "ok" && metrics?.enabled ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Requests served" value={String(metrics.requests_total ?? 0)} sub="wc26_serving_requests_total" />
            <Metric
              label="Avg latency"
              value={metrics.avg_latency_ms != null ? `${metrics.avg_latency_ms} ms` : "--"}
              sub="request_latency_seconds"
            />
            <Metric label="Predictions served" value={String(metrics.predictions_total ?? 0)} sub={outcomeSummary} />
            <Metric label="Uptime" value={fmtUptime(metrics.uptime_seconds)} sub="wc26_serving_uptime_seconds" />
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">
            {SERVING_API_URL
              ? "Serving API unreachable right now (Render free tier spins down after 15 min idle -- the first request cold-starts in ~10s). These are live production counters when it's up, not a static export."
              : "NEXT_PUBLIC_SERVING_API_URL isn't set in this build, so the browser can't reach the serving API to pull live counters. The /metrics-summary endpoint is real; it just isn't wired to this static build."}
          </p>
        )}
        <p className="mt-4 font-mono text-[11px] text-text-muted">
          Read client-side from {SERVING_API_URL ?? "<serving API>"}/metrics-summary -- a JSON projection of the same
          Prometheus registry that /metrics exposes. Genuine round-trip numbers, not a fabricated dashboard.
        </p>
      </div>

      {/* The full metrics pipeline -- real, runnable, honestly scoped */}
      <div className="glass-card p-6">
        <h3 className="font-mono text-sm text-foreground">Metrics pipeline: OpenTelemetry &rarr; Prometheus &rarr; Grafana</h3>
        <p className="mt-2 text-sm text-text-secondary">
          The serving API is instrumented with OpenTelemetry traces and a Prometheus <code>/metrics</code> endpoint (RED
          metrics -- request rate, errors, duration -- plus predictions-by-outcome and the loaded model version). A
          Prometheus container scrapes it every 15s and a provisioned Grafana dashboard renders it. Bring the whole
          stack up locally with <code className="text-foreground">docker compose -f docker-compose.airflow.yml up</code>;
          Grafana is then at <code className="text-foreground">localhost:3001</code> (admin/admin), dashboard
          &ldquo;WC26 Serving API&rdquo;.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["/metrics endpoint (source)", `https://github.com/${REPO}/blob/main/src/serving/metrics.py`],
            ["Prometheus scrape config", `https://github.com/${REPO}/blob/main/docker/prometheus/prometheus.yml`],
            ["Grafana dashboard JSON", `https://github.com/${REPO}/blob/main/docker/grafana/dashboards/wc26-serving.json`],
            ["Compose services (prometheus + grafana)", `https://github.com/${REPO}/blob/main/docker-compose.airflow.yml`],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text-secondary hover:text-foreground"
            >
              {label} &rarr;
            </a>
          ))}
        </div>
        <p className="mt-4 font-mono text-[11px] text-text-muted">
          Honest scope: the live counters above are real production numbers from the deployed API. The Grafana UI runs in
          the local/demo docker-compose stack, not on the Render free tier (which won&apos;t host a separate Grafana
          process) -- so it&apos;s a screenshot-and-run artifact, not a public hosted panel. Centralized log aggregation
          and alerting (Alertmanager) remain genuinely out of scope for this project and aren&apos;t faked in.
        </p>
      </div>
    </div>
  );
}

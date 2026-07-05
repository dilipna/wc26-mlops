"use client";

import { useEffect, useState } from "react";
import type { SystemHealth } from "@/lib/data";

const SERVING_API_URL = process.env.NEXT_PUBLIC_SERVING_API_URL;

type PingState = "checking" | "healthy" | "unreachable";

function HealthRow({ label, state, detail }: { label: string; state: PingState | boolean; detail: string }) {
  const ok = state === "healthy" || state === true;
  const checking = state === "checking";
  const dotClass = checking ? "status-dot--warning status-dot--pulse" : ok ? "status-dot--good" : "status-dot--critical";
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <div>
        <div className="font-mono text-sm text-foreground">{label}</div>
        <div className="text-xs text-text-secondary">{detail}</div>
      </div>
      <span className="status-pill">
        <span className={`status-dot ${dotClass}`} />
        {checking ? "checking..." : ok ? "healthy" : "unreachable"}
      </span>
    </div>
  );
}

export default function SystemHealthSection({ systemHealth }: { systemHealth: SystemHealth }) {
  const [servingState, setServingState] = useState<PingState>(SERVING_API_URL ? "checking" : "unreachable");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    if (!SERVING_API_URL) return;
    const start = performance.now();
    let cancelled = false;
    fetch(`${SERVING_API_URL}/health`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        if (!cancelled) {
          setLatencyMs(Math.round(performance.now() - start));
          setServingState("healthy");
        }
      })
      .catch(() => {
        if (!cancelled) setServingState("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="glass-card p-6">
      <div>
        <HealthRow
          label="Serving API (FastAPI)"
          state={servingState}
          detail={
            SERVING_API_URL
              ? `Live client-side ping of ${SERVING_API_URL}/health${latencyMs !== null ? ` -- ${latencyMs}ms` : ""}`
              : "NEXT_PUBLIC_SERVING_API_URL not configured in this build"
          }
        />
        <HealthRow
          label="MLflow registry"
          state={systemHealth.mlflow_reachable}
          detail="Checked at last data export -- best-effort, degrades gracefully when the local docker-compose stack isn't up"
        />
        <HealthRow
          label="Supabase (Postgres)"
          state={systemHealth.supabase_reachable}
          detail="Durable predictions/results mirror -- CSV/JSON logs remain the source of truth regardless"
        />
        <HealthRow
          label="Static data store"
          state="healthy"
          detail="dashboard/data/*.json, committed to git -- this page (and the public site) render from these with zero live dependency"
        />
      </div>
      <p className="mt-4 font-mono text-[11px] text-text-muted">
        Generated at {systemHealth.generated_at.slice(0, 16).replace("T", " ")} UTC. Redis isn&apos;t part of this
        stack -- nothing here needs a cache (predictions are computed once daily; this page is static JSON) -- so it
        isn&apos;t faked in for the sake of matching a generic tech-stack checklist.
      </p>
    </div>
  );
}

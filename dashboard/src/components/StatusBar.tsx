"use client";

import { useEffect, useState } from "react";

const REPO = "dilipna/wc26-mlops";
const SERVING_API_URL = process.env.NEXT_PUBLIC_SERVING_API_URL;

type PingState = "checking" | "healthy" | "unreachable";

function ServingStatusPill() {
  const [state, setState] = useState<PingState>(SERVING_API_URL ? "checking" : "unreachable");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    if (!SERVING_API_URL) return;
    let cancelled = false;
    const start = performance.now();
    fetch(`${SERVING_API_URL}/health`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        if (!cancelled) {
          setLatencyMs(Math.round(performance.now() - start));
          setState("healthy");
        }
      })
      .catch(() => {
        if (!cancelled) setState("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dotClass =
    state === "healthy" ? "status-dot--good" : state === "checking" ? "status-dot--warning status-dot--pulse" : "status-dot--critical";
  const label =
    state === "healthy"
      ? `serving api: healthy (${latencyMs}ms)`
      : state === "checking"
        ? "serving api: checking..."
        : "serving api: unreachable";

  return (
    <span className="status-pill" title="Live client-side ping of the deployed FastAPI /health endpoint">
      <span className={`status-dot ${dotClass}`} />
      {label}
    </span>
  );
}

export default function StatusBar() {
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 border-b border-border"
      style={{ background: "rgba(13,12,10,0.92)", backdropFilter: "blur(6px)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs font-semibold tracking-[0.08em] text-foreground">
            WC26<span className="text-series-1">-MLOPS</span>
          </span>
          <a
            href={`https://github.com/${REPO}/actions/workflows/ci.yml`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- external, dynamically-generated status badge, not a static asset next/image can optimize */}
            <img
              src={`https://github.com/${REPO}/actions/workflows/ci.yml/badge.svg`}
              alt="CI status"
              className="h-[18px]"
            />
          </a>
          <ServingStatusPill />
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-text-secondary">
          <a href="#leaderboard" className="hover:text-foreground transition-colors">Predictions</a>
          <a href="#fixtures" className="hover:text-foreground transition-colors">Fixtures</a>
          <a href="#performance" className="hover:text-foreground transition-colors">Track record</a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#engineering" className="hover:text-foreground transition-colors">Engineering</a>
        </nav>
      </div>
    </div>
  );
}

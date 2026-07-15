"""Prometheus metrics for the FastAPI serving layer.

This turns the OpenTelemetry traces (otel.py, already present) into
scrape-able RED-style metrics (Rate, Errors, Duration) plus a couple of
domain-specific ones (predictions by outcome, loaded model version). A
Prometheus container scrapes ``/metrics`` and Grafana renders them --
both wired into ``docker-compose.airflow.yml``.

Best-effort by design, same as otel.py / tracking.py: if
``prometheus_client`` isn't installed the whole module degrades to no-ops
and the two endpoints return a clear "not installed" payload instead of
crashing the serving process. That keeps the core /predict path free of a
hard dependency on the observability stack.
"""

from __future__ import annotations

import time

try:
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        Counter,
        Gauge,
        Histogram,
        generate_latest,
    )

    _AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only when the lib is absent
    _AVAILABLE = False
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"

# Process start, used for a genuine uptime gauge (uptime is computed at
# scrape time rather than stored, so it's always current).
_START_TIME = time.time()

if _AVAILABLE:
    # A dedicated registry (not the global default) so importing this module
    # more than once in a test process can't raise "Duplicate timeseries",
    # and so /metrics exposes exactly this app's series and nothing a
    # transitive import might have registered globally.
    REGISTRY = CollectorRegistry()

    REQUESTS = Counter(
        "wc26_serving_requests_total",
        "Total HTTP requests handled by the serving API.",
        ["method", "path", "status"],
        registry=REGISTRY,
    )
    REQUEST_LATENCY = Histogram(
        "wc26_serving_request_latency_seconds",
        "HTTP request latency in seconds.",
        ["method", "path"],
        # Buckets tuned for this API: sub-ms cached reads up to the ~10s
        # cold-start-plus-local-training first request on Render's free tier.
        buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
        registry=REGISTRY,
    )
    PREDICTIONS = Counter(
        "wc26_serving_predictions_total",
        "Match predictions served, labelled by the model's most likely outcome.",
        ["outcome"],
        registry=REGISTRY,
    )
    IN_PROGRESS = Gauge(
        "wc26_serving_requests_in_progress",
        "In-flight HTTP requests.",
        registry=REGISTRY,
    )
    UPTIME = Gauge(
        "wc26_serving_uptime_seconds",
        "Seconds since this serving process started.",
        registry=REGISTRY,
    )
    MODEL_INFO = Gauge(
        "wc26_serving_model_info",
        "Loaded model metadata (always 1; the label set carries the info).",
        ["model_version", "model_source"],
        registry=REGISTRY,
    )


def enabled() -> bool:
    return _AVAILABLE


def observe_request(method: str, path: str, status: int, latency_seconds: float) -> None:
    """Record one completed request. Called from the app's HTTP middleware."""
    if not _AVAILABLE:
        return
    REQUESTS.labels(method=method, path=path, status=str(status)).inc()
    REQUEST_LATENCY.labels(method=method, path=path).observe(latency_seconds)


def observe_prediction(outcome: str) -> None:
    """Record one served /predict, labelled by argmax outcome
    (home_win / draw / away_win)."""
    if not _AVAILABLE:
        return
    PREDICTIONS.labels(outcome=outcome).inc()


def set_model_info(model_version: str, model_source: str) -> None:
    if not _AVAILABLE:
        return
    # Clear any prior label set (e.g. a reload picking up a new registry
    # version) so exactly one model_info series is exported.
    MODEL_INFO.clear()
    MODEL_INFO.labels(model_version=model_version, model_source=model_source).set(1)


def render_latest() -> bytes:
    """Prometheus text exposition for the /metrics endpoint."""
    if not _AVAILABLE:
        return b"# prometheus_client not installed; metrics disabled\n"
    UPTIME.set(time.time() - _START_TIME)
    return generate_latest(REGISTRY)


def summary() -> dict:
    """A small JSON view of the same metrics, for the admin dashboard's
    Observability card -- so the browser gets clean numbers without parsing
    Prometheus text (and without a CORS-exposed /metrics scrape).

    Read via each collector's public ``.collect()`` sample stream rather
    than private counters, so it stays valid across prometheus_client
    versions."""
    if not _AVAILABLE:
        return {"enabled": False}

    requests_total = 0.0
    latency_sum = 0.0
    latency_count = 0.0
    predictions: dict[str, float] = {}

    for sample in REQUESTS.collect()[0].samples:
        if sample.name.endswith("_total"):
            requests_total += sample.value
    for sample in REQUEST_LATENCY.collect()[0].samples:
        if sample.name.endswith("_sum"):
            latency_sum += sample.value
        elif sample.name.endswith("_count"):
            latency_count += sample.value
    for sample in PREDICTIONS.collect()[0].samples:
        if sample.name.endswith("_total"):
            predictions[sample.labels["outcome"]] = sample.value

    avg_latency_ms = (latency_sum / latency_count * 1000) if latency_count else None
    return {
        "enabled": True,
        "uptime_seconds": round(time.time() - _START_TIME, 1),
        "requests_total": int(requests_total),
        "avg_latency_ms": round(avg_latency_ms, 1) if avg_latency_ms is not None else None,
        "predictions_total": int(sum(predictions.values())),
        "predictions_by_outcome": {k: int(v) for k, v in sorted(predictions.items())},
    }

"""Optional MLflow experiment tracking + model registry hook for Layer 1.

Every call here is wrapped so a missing/unreachable MLflow server (e.g.
docker-compose.airflow.yml's `mlflow` service not up) degrades to a printed
warning -- it never breaks the actual pipeline run. MLflow is supplementary
tracking, not a dependency of producing predictions (see DECISIONS.md).
"""

import os
import socket
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

import mlflow
import mlflow.artifacts
import mlflow.sklearn
from mlflow import MlflowClient

# mlflow's fluent API prints run-summary lines containing emoji (e.g. "🏃
# View run..."). Windows consoles default to a codepage (e.g. cp1252) that
# can't encode them, which raises mid-`with mlflow.start_run()` and leaves
# the run stuck in RUNNING status server-side even though all the real data
# was already logged. Force UTF-8 on stdout so that print never crashes.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

EXPERIMENT_NAME = "wc26-layer1-ensemble"
REGISTERED_MODEL_NAME = "wc26-layer1-stacked-ensemble"
PREFLIGHT_TIMEOUT_SECONDS = 1.5  # fail fast -- mlflow's own client retry/backoff can take minutes


def _tracking_uri() -> str:
    return os.environ.get("MLFLOW_TRACKING_URI", "http://localhost:5000")


def _is_reachable(uri: str) -> bool:
    """Cheap TCP preflight so an unreachable MLflow server fails in ~1s
    instead of falling through to mlflow's internal request retries, which
    can take minutes and would stall the daily pipeline (see module
    docstring)."""
    parsed = urlparse(uri)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        # AF_INET only: trying IPv6 first (e.g. "localhost" -> ::1) and
        # falling back to IPv4 would double the worst-case preflight time.
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(PREFLIGHT_TIMEOUT_SECONDS)
            sock.connect((host, port))
            return True
    except (OSError, socket.gaierror):
        return False


def load_latest_stack():
    """Best-effort load of the latest registered Layer 1 model
    (REGISTERED_MODEL_NAME) from the MLflow registry, for the FastAPI
    serving layer (src/serving/app.py). Returns (stack, source_label):
    stack is the fitted sklearn StackingClassifier, or None if the
    registry is unreachable/empty -- callers should fall back to training
    one locally, same best-effort philosophy as log_run above."""
    uri = _tracking_uri()
    if not _is_reachable(uri):
        return None, f"trained_locally (mlflow unreachable at {uri})"
    try:
        mlflow.set_tracking_uri(uri)
        model = mlflow.sklearn.load_model(f"models:/{REGISTERED_MODEL_NAME}/latest")
        return model, "mlflow_registry"
    except Exception as exc:  # noqa: BLE001 -- best-effort, see module docstring
        print(f"[mlflow] registry load failed, training locally instead ({exc.__class__.__name__}: {exc})")
        return None, f"trained_locally (registry load failed: {exc.__class__.__name__})"


def get_registry_info() -> dict | None:
    """Best-effort lookup of the current registered model version -- for
    the dashboard's model-registry card and the serving layer's
    model_version field. Returns None (never raises) if MLflow is
    unreachable or the model has no registered versions yet, same
    best-effort philosophy as load_latest_stack above."""
    uri = _tracking_uri()
    if not _is_reachable(uri):
        return None
    try:
        mlflow.set_tracking_uri(uri)
        versions = MlflowClient().search_model_versions(f"name='{REGISTERED_MODEL_NAME}'")
        if not versions:
            return None
        latest = max(versions, key=lambda v: int(v.version))
        created_at = datetime.fromtimestamp(latest.creation_timestamp / 1000, tz=timezone.utc)
        info = {
            "version": latest.version,
            "run_id": latest.run_id,
            "created_at": created_at.isoformat(),
            "params": {},
            "metrics": {},
            "ensemble_weights": {},
        }
        try:
            run = MlflowClient().get_run(latest.run_id)
            info["params"] = dict(run.data.params)
            info["metrics"] = dict(run.data.metrics)
        except Exception as exc:  # noqa: BLE001 -- run detail is a nice-to-have, not required
            print(f"[mlflow] run detail lookup failed (non-fatal): {exc.__class__.__name__}: {exc}")
        try:
            info["ensemble_weights"] = mlflow.artifacts.load_dict(
                f"runs:/{latest.run_id}/meta_learner_weights.json"
            )
        except Exception as exc:  # noqa: BLE001 -- artifact is a nice-to-have, not required
            print(f"[mlflow] ensemble-weights artifact lookup failed (non-fatal): {exc.__class__.__name__}: {exc}")
        return info
    except Exception as exc:  # noqa: BLE001 -- best-effort, see module docstring
        print(f"[mlflow] registry info lookup failed (non-fatal): {exc.__class__.__name__}: {exc}")
        return None


def relative_member_influence(ensemble_weights: dict) -> dict[str, float]:
    """Derives a simple per-member "relative influence" from the
    meta-learner's real logistic-regression coefficients (the
    meta_learner_weights.json artifact returned in get_registry_info's
    "ensemble_weights"): each base member (xgboost/elo_logreg/
    fifa_heuristic) contributes one 3-class probability block to the
    meta-learner's input, so summing |coefficient| over a member's block
    across all output classes gives an honest, if coarse, stand-in for
    "how much this member moves the final prediction" -- explicitly NOT
    SHAP (see the dashboard Model Card); real numbers derived from the
    actual fitted model, not fabricated. Returns {} if the shape is
    missing/malformed (e.g. MLflow unreachable, so ensemble_weights={})."""
    member_order = ensemble_weights.get("member_order")
    coef = ensemble_weights.get("coef")
    if not member_order or not coef:
        return {}
    n_members = len(member_order)
    n_classes_per_member = len(coef[0]) // n_members
    raw = {
        member: sum(
            abs(row[i * n_classes_per_member + j])
            for row in coef
            for j in range(n_classes_per_member)
        )
        for i, member in enumerate(member_order)
    }
    total = sum(raw.values()) or 1.0
    return {member: value / total for member, value in raw.items()}


def log_run(ensemble, run_name: str, params: dict, metrics: dict, register: bool = False) -> None:
    uri = _tracking_uri()
    if not _is_reachable(uri):
        print(f"[mlflow] skipped logging (tracking server unreachable at {uri})")
        return
    try:
        mlflow.set_tracking_uri(uri)
        mlflow.set_experiment(EXPERIMENT_NAME)
        with mlflow.start_run(run_name=run_name):
            mlflow.log_params(params)
            mlflow.log_metrics(metrics)
            mlflow.log_dict(ensemble.meta_learner_weights(), "meta_learner_weights.json")
            mlflow.sklearn.log_model(
                ensemble.stack,
                artifact_path="layer1_stacked_ensemble",
                registered_model_name=REGISTERED_MODEL_NAME if register else None,
            )
    except Exception as exc:  # noqa: BLE001 -- tracking is best-effort, see module docstring
        print(f"[mlflow] skipped logging ({exc.__class__.__name__}: {exc})")


def log_backtest_run(
    ensemble,
    run_name: str,
    params: dict,
    checkpoint_metrics: list[dict],
    register: bool = False,
) -> None:
    """Like log_run, but logs one dict of metrics per knockout checkpoint
    (step=0..N) so the MLflow UI plots Brier/log-loss trending across the
    tournament for this run, instead of a single flat number."""
    uri = _tracking_uri()
    if not _is_reachable(uri):
        print(f"[mlflow] skipped logging (tracking server unreachable at {uri})")
        return
    try:
        mlflow.set_tracking_uri(uri)
        mlflow.set_experiment(EXPERIMENT_NAME)
        with mlflow.start_run(run_name=run_name):
            mlflow.log_params(params)
            for step, metrics in enumerate(checkpoint_metrics):
                mlflow.log_metrics(metrics, step=step)
            mlflow.log_dict(ensemble.meta_learner_weights(), "meta_learner_weights.json")
            mlflow.sklearn.log_model(
                ensemble.stack,
                artifact_path="layer1_stacked_ensemble",
                registered_model_name=REGISTERED_MODEL_NAME if register else None,
            )
    except Exception as exc:  # noqa: BLE001 -- tracking is best-effort, see module docstring
        print(f"[mlflow] skipped logging ({exc.__class__.__name__}: {exc})")

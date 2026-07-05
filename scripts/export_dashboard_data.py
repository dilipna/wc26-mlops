"""Converts the pipeline's raw data (CSV logs + backtest JSON) into the
compact JSON files the Next.js dashboard reads at build time. Keeps the
dashboard self-contained (no cross-directory reads at deploy time) and
avoids standing up a database for Tier 1 -- see DECISIONS.md.

Run: python scripts/export_dashboard_data.py
(Run this, then rebuild/redeploy the dashboard, any time the daily
pipeline produces new data.)
"""

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.ingestion import live_results_store, supabase_store  # noqa: E402
from src.models.layer1_ensemble import tracking  # noqa: E402
from src.models.layer1_ensemble.features import FEATURE_NAMES  # noqa: E402
from src.models.layer2_simulation import live_bracket  # noqa: E402

DATA_DIR = ROOT / "data"
OUT_DIR = ROOT / "dashboard" / "data"


def export_predictions_timeseries():
    path = DATA_DIR / "predictions" / "predictions_log.csv"
    rows = []
    if path.exists():
        with open(path, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                rows.append(
                    {
                        "date": row["date"],
                        "team": row["team"],
                        "win_probability": float(row["win_probability"]),
                        "model_version": row["model_version"],
                    }
                )
    (OUT_DIR / "predictions_timeseries.json").write_text(json.dumps(rows, indent=2))
    return rows


def export_backtest():
    combined = {}
    for year in (2018, 2022):
        path = DATA_DIR / "backtest" / f"{year}.json"
        if path.exists():
            combined[str(year)] = json.loads(path.read_text())
    (OUT_DIR / "backtest.json").write_text(json.dumps(combined, indent=2))
    return combined


def export_results():
    path = DATA_DIR / "live" / "results_log.csv"
    rows = []
    if path.exists():
        with open(path, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    rows.sort(key=lambda r: r["date"], reverse=True)
    (OUT_DIR / "results.json").write_text(json.dumps(rows, indent=2))
    return rows


def export_upcoming_matches():
    live_dir = DATA_DIR / "live"
    snapshots = sorted(live_dir.glob("match_predictions_*.json"))
    matches = json.loads(snapshots[-1].read_text()) if snapshots else []
    (OUT_DIR / "upcoming_matches.json").write_text(json.dumps(matches, indent=2))
    return matches


MODEL_SERIES = "stacked_l2_montecarlo_v1"
BOOKMAKER_SERIES = "bookmaker_outright_baseline_v1"


def export_summary(predictions_rows, results_rows, upcoming_matches):
    # The hero/leaderboard show the MODEL's own numbers once its series
    # exists (live Layer 2, 2026-07-04); bookmaker outright is the fallback
    # for the days before that.
    primary = [r for r in predictions_rows if r["model_version"] == MODEL_SERIES]
    if not primary:
        primary = [r for r in predictions_rows if r["model_version"] == BOOKMAKER_SERIES]
    latest_date = max((r["date"] for r in primary), default=None)
    top_favorites = []
    if latest_date:
        latest = [r for r in primary if r["date"] == latest_date]
        top_favorites = sorted(latest, key=lambda r: -r["win_probability"])[:5]

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "latest_predictions_date": latest_date,
        "primary_series": MODEL_SERIES if primary and primary[0]["model_version"] == MODEL_SERIES else BOOKMAKER_SERIES,
        "top_favorites": top_favorites,
        "completed_results_count": len(results_rows),
        "upcoming_matches_count": len(upcoming_matches),
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))
    return summary


def export_teams(predictions_rows):
    """Full 2026 roster -- every team that's played at least one logged
    match, so no external "which 48 teams qualified" list is needed --
    with alive/eliminated status from the live bracket tree and current
    model P(champion) where available. Powers the dashboard's "check your
    country" lookup (PROJECT_BRAIN #12 item 4)."""
    matches = live_results_store.load_live_matches()
    roster = sorted({m.home_team for m in matches} | {m.away_team for m in matches})

    tree = live_bracket.build_2026_tree(matches, upcoming_fixtures=[])
    alive = live_bracket.alive_teams(tree)

    primary = [r for r in predictions_rows if r["model_version"] == MODEL_SERIES]
    if not primary:
        primary = [r for r in predictions_rows if r["model_version"] == BOOKMAKER_SERIES]
    latest_date = max((r["date"] for r in primary), default=None)
    current_by_team = {r["team"]: r["win_probability"] for r in primary if r["date"] == latest_date} if latest_date else {}

    teams = [
        {
            "team": team,
            "status": "alive" if team in alive else "eliminated",
            "current_probability": current_by_team.get(team),
        }
        for team in roster
    ]
    (OUT_DIR / "teams.json").write_text(json.dumps(teams, indent=2))
    return teams


def export_model_registry():
    """Model versioning card (PROJECT_BRAIN.md #8 Step 2): the real MLflow
    registry version/run/training params if MLflow is reachable at export
    time; an honest "unreachable" shape otherwise -- never fabricates a
    version number or training date."""
    info = tracking.get_registry_info()
    ensemble_weights = info["ensemble_weights"] if info else {}
    registry = {
        "registered_model_name": tracking.REGISTERED_MODEL_NAME,
        "feature_names": FEATURE_NAMES,
        "mlflow_reachable": info is not None,
        "version": info["version"] if info else None,
        "run_id": info["run_id"] if info else None,
        "trained_at": info["created_at"] if info else None,
        "params": info["params"] if info else {},
        "metrics": info["metrics"] if info else {},
        "member_influence": tracking.relative_member_influence(ensemble_weights),
    }
    (OUT_DIR / "model_registry.json").write_text(json.dumps(registry, indent=2))
    return registry


def export_drift():
    """Real Evidently drift-check output (data/monitoring/) -- the latest
    snapshot plus the accumulated history CSV as a genuine (currently
    thin, growing daily) trend series. Missing files (drift check never
    run yet) degrade to an honest empty shape, not fabricated numbers."""
    monitoring_dir = DATA_DIR / "monitoring"
    latest_path = monitoring_dir / "drift_report.json"
    history_path = monitoring_dir / "drift_history.csv"

    latest = json.loads(latest_path.read_text()) if latest_path.exists() else None
    history = []
    if history_path.exists():
        with open(history_path, encoding="utf-8") as f:
            history = list(csv.DictReader(f))

    drift = {"latest": latest, "history": history}
    (OUT_DIR / "drift.json").write_text(json.dumps(drift, indent=2))
    return drift


def export_data_quality():
    """Real data-quality check output (scripts/check_data_quality.py) --
    same "snapshot + accumulated history" pattern as export_drift. Missing
    files (check never run yet) degrade to an honest empty shape."""
    monitoring_dir = DATA_DIR / "monitoring"
    latest_path = monitoring_dir / "data_quality.json"
    history_path = monitoring_dir / "data_quality_history.csv"

    latest = json.loads(latest_path.read_text()) if latest_path.exists() else None
    history = []
    if history_path.exists():
        with open(history_path, encoding="utf-8") as f:
            history = list(csv.DictReader(f))

    data_quality = {"latest": latest, "history": history}
    (OUT_DIR / "data_quality.json").write_text(json.dumps(data_quality, indent=2))
    return data_quality


def export_system_health():
    """Real reachability checks for the admin dashboard's System section.
    The serving API itself is checked client-side (StatusBar's existing
    live ping) since this script runs at export time, not request time --
    this only covers the two backend dependencies checkable from here."""
    health = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mlflow_reachable": tracking.is_reachable(),
        "supabase_reachable": supabase_store.is_reachable(),
    }
    (OUT_DIR / "system_health.json").write_text(json.dumps(health, indent=2))
    return health


def export_training_history():
    """Real MLflow run history (up to 10 most recent runs) for the admin
    dashboard's Training section -- empty list (not fabricated rows) if
    MLflow is unreachable or no runs are logged yet."""
    runs = tracking.list_recent_runs(n=10)
    (OUT_DIR / "training_history.json").write_text(json.dumps(runs, indent=2))
    return runs


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    predictions_rows = export_predictions_timeseries()
    export_backtest()
    results_rows = export_results()
    upcoming_matches = export_upcoming_matches()
    summary = export_summary(predictions_rows, results_rows, upcoming_matches)
    teams = export_teams(predictions_rows)
    registry = export_model_registry()
    drift = export_drift()
    data_quality = export_data_quality()
    system_health = export_system_health()
    training_history = export_training_history()
    print(f"Exported dashboard data to {OUT_DIR}")
    print(f"  {len(predictions_rows)} prediction rows, {len(results_rows)} results, "
          f"{len(upcoming_matches)} upcoming matches")
    print(f"  Top favorites as of {summary['latest_predictions_date']}: "
          f"{[(f['team'], round(f['win_probability'], 3)) for f in summary['top_favorites']]}")
    n_alive = sum(1 for t in teams if t["status"] == "alive")
    print(f"  {len(teams)} teams tracked ({n_alive} alive, {len(teams) - n_alive} eliminated)")
    print(f"  Model registry: version={registry['version']} (mlflow_reachable={registry['mlflow_reachable']})")
    print(f"  Drift: {len(drift['history'])} history row(s), "
          f"latest generated_at={drift['latest']['generated_at'] if drift['latest'] else None}")
    print(f"  Data quality: {len(data_quality['history'])} history row(s)")
    print(f"  System health: mlflow_reachable={system_health['mlflow_reachable']}, "
          f"supabase_reachable={system_health['supabase_reachable']}")
    print(f"  Training history: {len(training_history)} run(s) from MLflow")


if __name__ == "__main__":
    main()

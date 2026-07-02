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
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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


def export_summary(predictions_rows, results_rows, upcoming_matches):
    latest_date = max((r["date"] for r in predictions_rows), default=None)
    top_favorites = []
    if latest_date:
        latest = [r for r in predictions_rows if r["date"] == latest_date]
        top_favorites = sorted(latest, key=lambda r: -r["win_probability"])[:5]

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "latest_predictions_date": latest_date,
        "top_favorites": top_favorites,
        "completed_results_count": len(results_rows),
        "upcoming_matches_count": len(upcoming_matches),
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))
    return summary


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    predictions_rows = export_predictions_timeseries()
    export_backtest()
    results_rows = export_results()
    upcoming_matches = export_upcoming_matches()
    summary = export_summary(predictions_rows, results_rows, upcoming_matches)
    print(f"Exported dashboard data to {OUT_DIR}")
    print(f"  {len(predictions_rows)} prediction rows, {len(results_rows)} results, "
          f"{len(upcoming_matches)} upcoming matches")
    print(f"  Top favorites as of {summary['latest_predictions_date']}: "
          f"{[(f['team'], round(f['win_probability'], 3)) for f in summary['top_favorites']]}")


if __name__ == "__main__":
    main()

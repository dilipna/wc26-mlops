"""Evidently drift check (Tier 2 -- CLAUDE.md). Compares Layer 1's six
feature distributions between a historical reference window (2016 ->
tournament start) and the actual 2026 World Cup matches played so far.

Writes data/monitoring/drift_report.json (summary, dashboard-consumable)
and data/monitoring/drift_report.html (full Evidently report).

Run: python scripts/check_drift.py
"""

import csv
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from src.features.data_loading import load_fifa_rankings  # noqa: E402
from src.features.team_timeline import build_timelines  # noqa: E402
from src.ingestion import live_results_store  # noqa: E402
from src.monitoring.drift_report import feature_frame, run_drift_report, summarize  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "monitoring"
# Dated, git-tracked copy of the full Evidently HTML report -- one per
# pipeline day, committed by the daily GitHub Actions workflow so the
# drift-report history is public and auditable (data/monitoring/*.html
# stays gitignored as the un-dated scratch copy).
REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports" / "drift"
HISTORY_PATH = OUT_DIR / "drift_history.csv"
REFERENCE_START = date(2016, 1, 1)
TOURNAMENT_START = date(2026, 1, 1)


def append_history(generated_at: str, reference_rows: int, current_rows: int, summary: dict) -> None:
    """Appends one row per run to data/monitoring/drift_history.csv --
    drift_report.json only ever holds the latest snapshot, so this is the
    real (thin at first, growing daily) trend source for the dashboard's
    drift-over-time chart."""
    columns = sorted(summary["columns"])
    write_header = not HISTORY_PATH.exists()
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            header = ["generated_at", "reference_rows", "current_rows", "dataset_drift", "share_of_drifted_columns"]
            for col in columns:
                header += [f"{col}_drift_score", f"{col}_drift_detected"]
            writer.writerow(header)
        row = [generated_at, reference_rows, current_rows, summary["dataset_drift"], summary["share_of_drifted_columns"]]
        for col in columns:
            row += [summary["columns"][col]["drift_score"], summary["columns"][col]["drift_detected"]]
        writer.writerow(row)


def main():
    today = datetime.now(timezone.utc).date()
    all_matches = live_results_store.load_combined_matches()
    rankings = load_fifa_rankings()
    timelines = build_timelines(all_matches)

    reference = feature_frame(all_matches, timelines, rankings, REFERENCE_START, TOURNAMENT_START)
    current = feature_frame(all_matches, timelines, rankings, TOURNAMENT_START, today)

    if current.empty:
        print(f"No 2026 matches in [{TOURNAMENT_START}, {today}) yet -- nothing to check.")
        return

    report = run_drift_report(reference, current)
    summary = summarize(report)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "drift_report.json").write_text(
        json.dumps(
            {
                "generated_at": today.isoformat(),
                "reference_window": [REFERENCE_START.isoformat(), TOURNAMENT_START.isoformat()],
                "current_window": [TOURNAMENT_START.isoformat(), today.isoformat()],
                "reference_rows": len(reference),
                "current_rows": len(current),
                **summary,
            },
            indent=2,
        )
    )
    report.save_html(str(OUT_DIR / "drift_report.html"))
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report.save_html(str(REPORTS_DIR / f"{today.isoformat()}.html"))
    append_history(today.isoformat(), len(reference), len(current), summary)

    print(
        f"Reference: {len(reference)} rows ({REFERENCE_START}->{TOURNAMENT_START}); "
        f"current: {len(current)} rows ({TOURNAMENT_START}->{today})"
    )
    print(
        f"Dataset drift detected: {summary['dataset_drift']} "
        f"({summary['number_of_drifted_columns']}/{summary['number_of_columns']} columns, "
        f"{summary['share_of_drifted_columns']:.0%})"
    )
    for col, info in summary["columns"].items():
        flag = "DRIFT" if info["drift_detected"] else "ok"
        print(f"  {col:28s} {flag:6s} score={info['drift_score']:.4f} ({info['stattest_name']})")


if __name__ == "__main__":
    main()

"""Data-quality check over the match data feeding Layer 1 (see
src/monitoring/data_quality.py for what's actually checked and why).

Writes data/monitoring/data_quality.json (latest snapshot, dashboard-
consumable) and appends one row to data/monitoring/data_quality_history.csv
-- the same "snapshot + accumulating history" pattern as check_drift.py.

Run: python scripts/check_data_quality.py
"""

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from src.features.data_loading import load_results  # noqa: E402
from src.ingestion.live_results_store import load_live_matches  # noqa: E402
from src.monitoring.data_quality import build_report  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "monitoring"
HISTORY_PATH = OUT_DIR / "data_quality_history.csv"


def append_history(generated_at: str, report: dict) -> None:
    write_header = not HISTORY_PATH.exists()
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(
                [
                    "generated_at",
                    "total_rows",
                    "schema_valid",
                    "duplicate_rows",
                    "historical_count",
                    "live_count",
                    "overlap_count",
                ]
            )
        writer.writerow(
            [
                generated_at,
                report["duplicates_before_dedup"]["total_rows"],
                report["schema"]["valid"],
                report["duplicates_before_dedup"]["duplicate_rows"],
                report["historical_live_overlap"]["historical_count"],
                report["historical_live_overlap"]["live_count"],
                report["historical_live_overlap"]["overlap_count"],
            ]
        )


def main():
    today = datetime.now(timezone.utc).date()
    historical = load_results()
    live = load_live_matches()
    report = build_report(historical, live)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "data_quality.json").write_text(
        json.dumps({"generated_at": today.isoformat(), **report}, indent=2)
    )
    append_history(today.isoformat(), report)

    print(f"Rows checked: {report['duplicates_before_dedup']['total_rows']}")
    print(f"Schema valid: {report['schema']['valid']}")
    print(f"Duplicate keys (pre-dedup): {report['duplicates_before_dedup']['duplicate_keys']}")
    print(
        "Historical/live overlap: "
        f"{report['historical_live_overlap']['overlap_count']} of "
        f"{report['historical_live_overlap']['live_count']} live-logged matches"
    )


if __name__ == "__main__":
    main()

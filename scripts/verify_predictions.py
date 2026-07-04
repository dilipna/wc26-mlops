"""Runs the 'model vs reality' proof tracker (src/verification/proof_tracker.py)
and writes dashboard/data/proof_tracker.json.

Run after daily_update.py (needs that run's fresh results/predictions);
wired as the third Airflow DAG task in wc26_daily_pipeline.py, before
export_dashboard_data.py.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from src.ingestion import supabase_store  # noqa: E402
from src.verification import proof_tracker  # noqa: E402

OUT_PATH = Path(__file__).resolve().parent.parent / "dashboard" / "data" / "proof_tracker.json"


def main():
    prediction_rows = supabase_store.fetch_match_predictions()
    if not prediction_rows:
        if OUT_PATH.exists():
            print("[verify_predictions] Supabase unavailable/empty; leaving existing proof_tracker.json untouched")
            return
        prediction_rows = []  # fall through and write an empty-but-valid file so the dashboard never 404s

    results_by_fixture = proof_tracker.load_results()
    report = proof_tracker.build_report(prediction_rows, results_by_fixture)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(report, indent=2))

    summary = report["summary"]
    print(f"[verify_predictions] graded {summary['n_graded']} completed fixture(s) -> {OUT_PATH}")
    print(f"  model:     accuracy={summary['model_accuracy']}, avg_brier={summary['model_avg_brier']}")
    print(f"  bookmaker: accuracy={summary['bookmaker_accuracy']}, avg_brier={summary['bookmaker_avg_brier']} "
          f"(n={summary['n_bookmaker_graded']})")


if __name__ == "__main__":
    main()

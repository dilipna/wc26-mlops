"""Evidently data-drift check (CLAUDE.md Tier 2): are the Elo/form/rank
feature distributions of the actual 2026 World Cup matches shifting away
from the historical distribution Layer 1 was trained on?

This is *input* drift, not model-performance drift -- proof_tracker.py
already grades predictions against real outcomes once matches finish.
This check answers a different question: does a World Cup field even look
statistically like the average international fixture Layer 1 has seen
since 2016? (Answer is expected to be "somewhat" -- a World Cup skews
toward stronger teams -- so drift here is informative context, not
automatically a bug.)
"""

from datetime import date

import pandas as pd
from evidently.metric_preset import DataDriftPreset
from evidently.report import Report

from src.models.layer1_ensemble.features import FEATURE_NAMES, build_training_set

# `neutral` is a fixed 0/1 flag the pipeline sets per fixture, not a
# distribution that can meaningfully "drift" -- drop it from the check.
FEATURE_COLUMNS = [c for c in FEATURE_NAMES if c != "neutral"]


def feature_frame(matches, timelines, rankings, start: date, end: date) -> pd.DataFrame:
    """Symmetric per-match feature rows (see build_training_set) for
    matches in [start, end), feature columns only."""
    X, _y = build_training_set(matches, timelines, rankings, start, end)
    return pd.DataFrame(X, columns=FEATURE_NAMES)[FEATURE_COLUMNS]


def run_drift_report(reference: pd.DataFrame, current: pd.DataFrame) -> Report:
    report = Report(metrics=[DataDriftPreset()])
    report.run(reference_data=reference, current_data=current)
    return report


def summarize(report: Report) -> dict:
    table = next(
        m["result"] for m in report.as_dict()["metrics"] if m["metric"] == "DataDriftTable"
    )
    return {
        "dataset_drift": table["dataset_drift"],
        "share_of_drifted_columns": table["share_of_drifted_columns"],
        "number_of_drifted_columns": table["number_of_drifted_columns"],
        "number_of_columns": table["number_of_columns"],
        "columns": {
            col: {
                "drift_detected": info["drift_detected"],
                "drift_score": info["drift_score"],
                "stattest_name": info["stattest_name"],
            }
            for col, info in table["drift_by_columns"].items()
        },
    }

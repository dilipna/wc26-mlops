import csv
import importlib.util
from datetime import date
from pathlib import Path

# Imported by file path, not `from scripts import daily_update` -- an
# unrelated third-party "scripts" package installed in site-packages
# shadows the local scripts/ directory on this machine's import path.
_spec = importlib.util.spec_from_file_location(
    "wc26_daily_update", Path(__file__).resolve().parent.parent / "scripts" / "daily_update.py"
)
daily_update = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(daily_update)


def test_append_predictions_log_is_idempotent_per_day(tmp_path, monkeypatch):
    log_path = tmp_path / "predictions_log.csv"
    monkeypatch.setattr(daily_update, "PREDICTIONS_LOG", log_path)

    today = date(2026, 7, 5)
    daily_update.append_predictions_log(today, {"Argentina": 0.25, "France": 0.18}, "stacked_l2_montecarlo_v1")
    daily_update.append_predictions_log(today, {"Argentina": 0.26, "France": 0.19}, "stacked_l2_montecarlo_v1")

    with open(log_path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))[1:]

    assert len(rows) == 2
    values = {row[1]: float(row[2]) for row in rows}
    assert values == {"Argentina": 0.26, "France": 0.19}


def test_append_predictions_log_keeps_other_dates_and_series(tmp_path, monkeypatch):
    log_path = tmp_path / "predictions_log.csv"
    monkeypatch.setattr(daily_update, "PREDICTIONS_LOG", log_path)

    daily_update.append_predictions_log(date(2026, 7, 4), {"Spain": 0.15}, "stacked_l2_montecarlo_v1")
    daily_update.append_predictions_log(date(2026, 7, 5), {"Spain": 0.16}, "bookmaker_outright_baseline_v1")
    daily_update.append_predictions_log(date(2026, 7, 5), {"Spain": 0.17}, "stacked_l2_montecarlo_v1")

    with open(log_path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))[1:]

    assert len(rows) == 3

"""'Model vs reality' proof tracker (PROJECT_BRAIN.md #12 item 3 -- Dilip's
highest-value ask): joins each fixture's LAST pre-kickoff prediction
snapshot against its completed result and grades it, so the dashboard can
show e.g. "July 2, 10:04 UTC: model said 61% Spain -- Spain won 3-0",
plus running accuracy/Brier/calibration for the model vs the bookmaker.

Predictions come from Supabase's match_predictions table (append-only --
see supabase/schema.sql) because it's the only durable history of
pre-kickoff snapshots; the local data/live/match_predictions_<ts>.json
files are gitignored and only the latest survives. Results come from
data/live/results_log.csv (already the durable, git-tracked source used
everywhere else in the pipeline).
"""

import csv
from datetime import datetime, timezone
from pathlib import Path

RESULTS_LOG = Path(__file__).resolve().parent.parent.parent / "data" / "live" / "results_log.csv"

OUTCOME_KEYS = ("home_win", "draw", "away_win")


def latest_prediction_per_fixture(rows: list[dict]) -> dict[tuple, dict]:
    """rows must be ordered oldest-first (supabase_store.fetch_match_predictions
    sorts by logged_at) so the last write per fixture wins -- that's the
    model's final pre-kickoff call, the most meaningful one to grade."""
    latest: dict[tuple, dict] = {}
    for row in rows:
        key = (row["home_team"], row["away_team"], row["commence_time"])
        latest[key] = row
    return latest


def _outcome(home_score: int, away_score: int) -> str:
    if home_score > away_score:
        return "home_win"
    if away_score > home_score:
        return "away_win"
    return "draw"


def _brier(probs: dict[str, float], actual: str) -> float:
    """Multi-class Brier score (0 = perfect, 2 = worst possible)."""
    return sum((probs[k] - (1.0 if k == actual else 0.0)) ** 2 for k in OUTCOME_KEYS)


def grade_match(prediction: dict, result: dict) -> dict:
    """prediction: a row from match_predictions (flattened bookmaker_*
    columns, which may be None if odds were unavailable that day). result:
    a row from results_log.csv. Returns one graded card for the dashboard."""
    actual = _outcome(int(result["home_score"]), int(result["away_score"]))
    model_probs = {
        "home_win": prediction["model_home_win"],
        "draw": prediction["model_draw"],
        "away_win": prediction["model_away_win"],
    }
    model_predicted = max(model_probs, key=model_probs.get)

    card = {
        "home_team": prediction["home_team"],
        "away_team": prediction["away_team"],
        "commence_time": prediction["commence_time"],
        "logged_at": prediction["logged_at"],
        "home_score": int(result["home_score"]),
        "away_score": int(result["away_score"]),
        "actual_outcome": actual,
        "model": model_probs,
        "model_predicted_outcome": model_predicted,
        "model_correct": model_predicted == actual,
        "model_brier": _brier(model_probs, actual),
        "bookmaker": None,
        "bookmaker_predicted_outcome": None,
        "bookmaker_correct": None,
        "bookmaker_brier": None,
    }

    if prediction.get("bookmaker_home_win") is not None:
        bookmaker_probs = {
            "home_win": prediction["bookmaker_home_win"],
            "draw": prediction["bookmaker_draw"],
            "away_win": prediction["bookmaker_away_win"],
        }
        bookmaker_predicted = max(bookmaker_probs, key=bookmaker_probs.get)
        card["bookmaker"] = bookmaker_probs
        card["bookmaker_predicted_outcome"] = bookmaker_predicted
        card["bookmaker_correct"] = bookmaker_predicted == actual
        card["bookmaker_brier"] = _brier(bookmaker_probs, actual)

    return card


def build_calibration(graded: list[dict], n_bins: int = 5) -> list[dict]:
    """Reliability diagram: bucket each graded match by the confidence the
    model placed on whichever outcome it picked, then report what fraction
    of picks in that bucket were actually correct. Built incrementally
    here (every daily run) rather than only once at the final
    post-tournament summary -- see CLAUDE.md's Tier 1 calibration ask."""
    bins: list[list[bool]] = [[] for _ in range(n_bins)]
    for g in graded:
        p = g["model"][g["model_predicted_outcome"]]
        idx = min(int(p * n_bins), n_bins - 1)
        bins[idx].append(g["model_correct"])

    out = []
    for i, bucket in enumerate(bins):
        lo, hi = i / n_bins, (i + 1) / n_bins
        out.append(
            {
                "bucket_label": f"{int(lo * 100)}-{int(hi * 100)}%",
                "predicted_mid": (lo + hi) / 2,
                "n": len(bucket),
                "actual_rate": (sum(bucket) / len(bucket)) if bucket else None,
            }
        )
    return out


def summarize(graded: list[dict]) -> dict:
    n = len(graded)
    bookmaker_graded = [g for g in graded if g["bookmaker_brier"] is not None]
    n_bm = len(bookmaker_graded)
    return {
        "n_graded": n,
        "model_accuracy": (sum(g["model_correct"] for g in graded) / n) if n else None,
        "model_avg_brier": (sum(g["model_brier"] for g in graded) / n) if n else None,
        "n_bookmaker_graded": n_bm,
        "bookmaker_accuracy": (sum(g["bookmaker_correct"] for g in bookmaker_graded) / n_bm) if n_bm else None,
        "bookmaker_avg_brier": (sum(g["bookmaker_brier"] for g in bookmaker_graded) / n_bm) if n_bm else None,
    }


def load_results(path: Path = RESULTS_LOG) -> dict[tuple, dict]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return {(r["home_team"], r["away_team"]): r for r in csv.DictReader(f)}


def build_report(prediction_rows: list[dict], results_by_fixture: dict[tuple, dict]) -> dict:
    latest = latest_prediction_per_fixture(prediction_rows)
    graded = []
    for (home, away, _commence_time), prediction in latest.items():
        result = results_by_fixture.get((home, away))
        if result is None:
            continue  # not played yet
        graded.append(grade_match(prediction, result))
    graded.sort(key=lambda g: g["commence_time"], reverse=True)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "graded_matches": graded,
        "summary": summarize(graded),
        "calibration": build_calibration(graded),
    }

"""Daily live-tracking update (Tier 1, Phase 1 -- see chat/DECISIONS.md for
scope). For each run:

1. Pull completed match results from the last 3 days (Odds API /scores)
   and append any new ones to the live results log.
2. Rebuild Elo/form timelines from historical + live results (leakage-safe
   as of today).
3. Score every upcoming/live fixture (Odds API h2h market) with Layer 1,
   alongside the bookmaker's own implied match probabilities.
4. Pull the bookmaker "wins the tournament" outright market and append it
   to the predictions log as (date, team, win_probability, model_version)
   -- a real timestamped series today, ahead of Layer 2's own tournament-
   win output (deferred: needs the actual knockout bracket skeleton, which
   isn't safely derivable until enough of the live bracket has actually
   been played -- see DECISIONS.md).

Run: python scripts/daily_update.py
"""

import csv
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from src.features.data_loading import load_fifa_rankings, load_results  # noqa: E402
from src.features.team_timeline import build_timelines  # noqa: E402
from src.ingestion import live_results_store, odds_api  # noqa: E402
from src.models.layer1_ensemble.ensemble import Layer1Ensemble  # noqa: E402

LIVE_DIR = Path(__file__).resolve().parent.parent / "data" / "live"
PREDICTIONS_LOG = Path(__file__).resolve().parent.parent / "data" / "predictions" / "predictions_log.csv"
TRAIN_START = date(1992, 1, 1)
MODEL_VERSION_BASELINE = "bookmaker_outright_baseline_v1"


def append_predictions_log(today: date, team_probs: dict[str, float], model_version: str):
    PREDICTIONS_LOG.parent.mkdir(parents=True, exist_ok=True)
    write_header = not PREDICTIONS_LOG.exists()
    with open(PREDICTIONS_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["date", "team", "win_probability", "model_version"])
        for team, prob in team_probs.items():
            writer.writerow([today.isoformat(), team, prob, model_version])


def devig_match_odds(event: dict) -> dict[str, float]:
    outcome_prices: dict[str, list[float]] = {}
    for bookmaker in event.get("bookmakers", []):
        for market in bookmaker.get("markets", []):
            if market["key"] != "h2h":
                continue
            for outcome in market["outcomes"]:
                outcome_prices.setdefault(outcome["name"], []).append(1.0 / outcome["price"])
    return odds_api.devig(outcome_prices)


def main():
    today = datetime.now(timezone.utc).date()
    print(f"=== Daily update: {today.isoformat()} ===")

    print("Odds API quota:", odds_api.get_quota_status())

    score_events = odds_api.fetch_scores(days_from=3)
    added = live_results_store.append_new_results(score_events)
    print(f"Live results log: {added} new completed match(es) appended")

    historical = load_results()
    live = live_results_store.load_live_matches()
    all_matches = sorted(historical + live, key=lambda m: m.date)
    rankings = load_fifa_rankings()
    timelines = build_timelines(all_matches)

    ensemble = Layer1Ensemble(all_matches, timelines, rankings, TRAIN_START, today)

    match_odds_events = odds_api.fetch_match_odds()
    match_predictions = []
    for event in match_odds_events:
        home, away = event["home_team"], event["away_team"]
        p_loss, p_draw, p_win = ensemble.match_probs(home, away, today, neutral=True)
        bookmaker_probs = devig_match_odds(event)
        match_predictions.append(
            {
                "commence_time": event["commence_time"],
                "home_team": home,
                "away_team": away,
                "model": {"home_win": p_win, "draw": p_draw, "away_win": p_loss},
                "bookmaker": bookmaker_probs,
            }
        )

    LIVE_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    match_pred_path = LIVE_DIR / f"match_predictions_{timestamp}.json"
    match_pred_path.write_text(json.dumps(match_predictions, indent=2))
    print(f"Wrote {match_pred_path} ({len(match_predictions)} upcoming/live fixtures scored)")

    outright_probs = odds_api.fetch_outright_probabilities()
    append_predictions_log(today, outright_probs, MODEL_VERSION_BASELINE)
    print(
        f"Appended {len(outright_probs)} team rows to {PREDICTIONS_LOG} "
        f"(model_version={MODEL_VERSION_BASELINE})"
    )
    top5 = sorted(outright_probs.items(), key=lambda kv: -kv[1])[:5]
    print("Bookmaker-implied tournament favorites today:", top5)


if __name__ == "__main__":
    main()

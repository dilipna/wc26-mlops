"""Recompute the live Layer 2 title odds for the days the frozen-bracket
bug corrupted (DECISIONS.md 2026-09-14), without touching the raw
predictions log.

For every date the log has a `stacked_l2_montecarlo_v1` series from the
first knockout draw onward, rebuild what the daily run SHOULD have seen
that morning: results dated before that day only, Layer 1 retrained with
train_end = that day (exactly as scripts/daily_update.py does), the fixed
bracket resolver. Days whose alive-team set came out identical to the
original are left alone -- only genuinely corrupted days are replaced.

Writes data/predictions/bracket_incident_corrections.csv, same columns as
predictions_log.csv. export_dashboard_data.py overlays it for the chart;
the original rows stay in predictions_log.csv (and git history) as the
incident record.

Run: python scripts/replay_bracket_incident.py
"""

import csv
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.features.data_loading import load_fifa_rankings  # noqa: E402
from src.features.team_timeline import build_timelines  # noqa: E402
from src.ingestion import live_results_store  # noqa: E402
from src.models.layer1_ensemble.ensemble import Layer1Ensemble, load_tuned_xgb_params  # noqa: E402
from src.models.layer2_simulation import live_bracket  # noqa: E402

LOG = ROOT / "data" / "predictions" / "predictions_log.csv"
OUT = ROOT / "data" / "predictions" / "bracket_incident_corrections.csv"
SERIES = ["stacked_l2_montecarlo_v1", "heuristic_l2_montecarlo_v1"]
FIRST_KNOCKOUT_DRAW = date(2026, 7, 7)
FINAL = date(2026, 7, 19)
TRAIN_START = date(1992, 1, 1)


def main():
    logged = defaultdict(set)  # date -> alive teams in the ORIGINAL model series
    with open(LOG, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r["model_version"] == SERIES[0]:
                logged[date.fromisoformat(r["date"])].add(r["team"])

    all_matches = live_results_store.load_combined_matches()
    live = live_results_store.load_live_matches()
    rankings = load_fifa_rankings()

    rows = []
    for day in sorted(d for d in logged if FIRST_KNOCKOUT_DRAW < d <= FINAL):
        known_live = [m for m in live if m.date < day]
        # Later knockout pairings stand in for the Odds API fixture feed.
        # They are only consulted to resolve a finished shootout (whose
        # winner was public the moment it ended) -- never for a score.
        schedule = [(m.home_team, m.away_team) for m in live if day <= m.date <= FINAL]
        tree = live_bracket.build_2026_tree(known_live, schedule)
        alive = live_bracket.alive_teams(tree)
        if alive == logged[day]:
            print(f"{day}: alive set matches original -- unaffected, skipped")
            continue

        known_all = [m for m in all_matches if m.date < day]
        timelines = build_timelines(known_all)
        ensemble = Layer1Ensemble(known_all, timelines, rankings, TRAIN_START, day,
                                  xgb_params=load_tuned_xgb_params())
        model = live_bracket.simulate_champion_probabilities(
            tree, lambda a, b: ensemble.advance_probability(a, b, day))
        heuristic = live_bracket.simulate_champion_probabilities(
            tree, lambda a, b: ensemble.baseline_advance_probability(a, b, day))
        for series, probs in zip(SERIES, (model, heuristic)):
            rows += [{"date": day.isoformat(), "team": t, "win_probability": round(p, 4),
                      "model_version": series} for t, p in probs.items()]
        print(f"{day}: original alive={sorted(logged[day])} -> corrected {sorted(model.items(), key=lambda kv: -kv[1])}")

    with open(OUT, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["date", "team", "win_probability", "model_version"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} corrected rows to {OUT}")


if __name__ == "__main__":
    main()

"""Phase 0 validation gate (CLAUDE.md): backtest the full two-layer
pipeline against the 2018 and 2022 World Cups. At each knockout-stage
checkpoint, simulate P(wins World Cup) for every team still alive using
Layer 1 + Layer 2, compare against the FIFA-rank-only baseline, and
persist the result as structured JSON (not a written report) so the
live dashboard's future "Model Validation" section can consume it
directly.

Run: python scripts/backtest_2018_2022.py
"""

import json
import math
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.features.data_loading import (  # noqa: E402
    load_fifa_rankings,
    load_results,
    load_shootouts,
    world_cup_matches,
)
from src.features.team_timeline import build_timelines  # noqa: E402
from src.models.layer1_ensemble.ensemble import Layer1Ensemble  # noqa: E402
from src.models.layer2_simulation.bracket import build_bracket  # noqa: E402
from src.models.layer2_simulation.monte_carlo import simulate_champion_probabilities  # noqa: E402

N_SIMS = 10_000
TRAIN_START = date(1992, 1, 1)  # matches FIFA ranking data's earliest coverage
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "backtest"

# start_round -> the checkpoint name it represents ("post_group" means the
# next round to be simulated, from scratch, is the Round of 16, etc.)
CHECKPOINTS = [
    ("R16", "post_group"),
    ("QF", "post_r16"),
    ("SF", "post_qf"),
    ("F", "post_sf"),
]


def brier_score(probs: dict, champion: str) -> float:
    return sum((p - (1.0 if team == champion else 0.0)) ** 2 for team, p in probs.items()) / len(probs)


def log_loss_champion(probs: dict, champion: str) -> float:
    p = max(probs.get(champion, 0.0), 1e-9)
    return -math.log(p)


def run_backtest_for_year(year: int, matches, timelines, rankings, shootouts) -> dict:
    wc_matches = world_cup_matches(matches, year)
    bracket = build_bracket(wc_matches, shootouts)
    tournament_start = min(m.date for m in wc_matches)

    ensemble = Layer1Ensemble(matches, timelines, rankings, TRAIN_START, tournament_start)

    checkpoints = {}
    for start_round, checkpoint_name in CHECKPOINTS:
        as_of = bracket.round_start_date[start_round]

        model_probs = simulate_champion_probabilities(
            bracket, start_round, ensemble.advance_probability, as_of, n_sims=N_SIMS, seed=42
        )
        baseline_probs = simulate_champion_probabilities(
            bracket, start_round, ensemble.baseline_advance_probability, as_of, n_sims=N_SIMS, seed=42
        )

        checkpoints[checkpoint_name] = {
            "as_of": as_of.isoformat(),
            "model": {
                "team_probs": model_probs,
                "champion_prob": model_probs.get(bracket.champion, 0.0),
                "brier": brier_score(model_probs, bracket.champion),
                "log_loss": log_loss_champion(model_probs, bracket.champion),
            },
            "baseline": {
                "team_probs": baseline_probs,
                "champion_prob": baseline_probs.get(bracket.champion, 0.0),
                "brier": brier_score(baseline_probs, bracket.champion),
                "log_loss": log_loss_champion(baseline_probs, bracket.champion),
            },
        }

    return {
        "year": year,
        "champion": bracket.champion,
        "n_sims": N_SIMS,
        "checkpoints": checkpoints,
    }


def main():
    matches = load_results()
    rankings = load_fifa_rankings()
    shootouts = load_shootouts()
    timelines = build_timelines(matches)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = {}
    for year in (2018, 2022):
        result = run_backtest_for_year(year, matches, timelines, rankings, shootouts)
        results[year] = result
        out_path = OUT_DIR / f"{year}.json"
        out_path.write_text(json.dumps(result, indent=2))
        print(f"Wrote {out_path}")

    # --- Success-bar summary (proposed in the Phase 0 plan, now agreed) ---
    deltas_brier, deltas_logloss = [], []
    print("\n=== Phase 0 backtest summary ===")
    for year, result in results.items():
        champ = result["champion"]
        seq = [result["checkpoints"][name]["model"]["champion_prob"] for _, name in CHECKPOINTS]
        rising = seq[-1] > seq[0]
        sf_checkpoint = result["checkpoints"]["post_qf"]
        beats_baseline_sf = (
            sf_checkpoint["model"]["brier"] < sf_checkpoint["baseline"]["brier"]
            and sf_checkpoint["model"]["log_loss"] < sf_checkpoint["baseline"]["log_loss"]
        )
        print(f"{year} ({champ}): P(champion) by checkpoint = {[round(p, 3) for p in seq]}")
        print(f"  rising trend (last > first): {rising}")
        print(f"  beats baseline at semifinal checkpoint (Brier & log-loss): {beats_baseline_sf}")
        for _, name in CHECKPOINTS:
            cp = result["checkpoints"][name]
            deltas_brier.append(cp["model"]["brier"] - cp["baseline"]["brier"])
            deltas_logloss.append(cp["model"]["log_loss"] - cp["baseline"]["log_loss"])

    avg_brier_delta = sum(deltas_brier) / len(deltas_brier)
    avg_logloss_delta = sum(deltas_logloss) / len(deltas_logloss)
    print(f"\nAvg Brier delta (model - baseline, all checkpoints, both tournaments): {avg_brier_delta:+.4f}")
    print(f"Avg log-loss delta (model - baseline, all checkpoints, both tournaments): {avg_logloss_delta:+.4f}")
    print("(negative = model beats baseline on average)")


if __name__ == "__main__":
    main()

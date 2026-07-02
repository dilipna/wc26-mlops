"""Layer 2: Monte Carlo simulation of the actual remaining bracket, using
Layer 1's per-match probabilities recursively (CLAUDE.md). Simulates
10,000+ runs and tallies champion frequency -> P(win World Cup) per team.

Only a handful of distinct matchups are ever possible within a fixed
bracket tree (every simulated winner is still drawn from the same ~16
real entrants), so match probabilities are memoized instead of
recomputed per simulation -- this is what keeps 10,000+ runs fast.
"""

import random
from collections import Counter
from datetime import date
from typing import Callable

from src.models.layer2_simulation.bracket import ROUND_ORDER, Bracket

ProbFn = Callable[[str, str, date], float]


def _seed_teams(bracket: Bracket, start_round: str) -> list[tuple[str, str]]:
    if start_round == "R16":
        return [m.teams for m in bracket.rounds["R16"]]
    prev_round = ROUND_ORDER[ROUND_ORDER.index(start_round) - 1]
    prev_winners = bracket.winners[prev_round]
    return [(prev_winners[i], prev_winners[j]) for m in bracket.rounds[start_round] for (i, j) in [m.children]]


def simulate_champion_probabilities(
    bracket: Bracket,
    start_round: str,
    prob_fn: ProbFn,
    as_of: date,
    n_sims: int = 10_000,
    seed: int = 42,
) -> dict[str, float]:
    """P(wins World Cup) for every team still alive as of `start_round`."""
    rng = random.Random(seed)
    seed_teams = _seed_teams(bracket, start_round)

    cache: dict[tuple[str, str], float] = {}

    def p_a_advances(team_a: str, team_b: str) -> float:
        key = (team_a, team_b)
        if key not in cache:
            cache[key] = prob_fn(team_a, team_b, as_of)
        return cache[key]

    start_idx = ROUND_ORDER.index(start_round)
    tally: Counter = Counter()

    for _ in range(n_sims):
        current_winners = []
        for team_a, team_b in seed_teams:
            p = p_a_advances(team_a, team_b)
            current_winners.append(team_a if rng.random() < p else team_b)

        for round_name in ROUND_ORDER[start_idx + 1 :]:
            next_winners = []
            for match in bracket.rounds[round_name]:
                i, j = match.children
                team_a, team_b = current_winners[i], current_winners[j]
                p = p_a_advances(team_a, team_b)
                next_winners.append(team_a if rng.random() < p else team_b)
            current_winners = next_winners

        tally[current_winners[0]] += 1

    all_teams = {t for pair in seed_teams for t in pair}
    return {team: tally.get(team, 0) / n_sims for team in all_teams}

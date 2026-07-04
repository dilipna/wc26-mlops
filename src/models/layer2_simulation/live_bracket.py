"""Live Layer 2 for the 2026 World Cup: the official remaining-bracket
skeleton (encoded once, verified against the FIFA schedule via the raw
wikitext of Wikipedia's knockout-stage page on 2026-07-04 -- match
numbers 89-104), resolved daily against real results, then Monte Carlo
simulated with Layer 1's probabilities.

Unlike bracket.py (which reconstructs a COMPLETED bracket for backtests),
this handles partial state: any mix of played and unplayed matches,
including the nested case where an R16 slot is itself the winner of a
still-unplayed R32 match.

Knockout draws: a 90-minute draw goes to penalties, but the Odds API
score feed doesn't say who won the shootout. Until the winner shows up in
a later-round fixture (see `_infer_drawn_winner`), a drawn-but-decided
match is treated as still pending and re-simulated -- self-correcting
within a day, and exact for genuinely unplayed matches.
"""

import random
from collections import Counter
from typing import Callable

from src.features.data_loading import Match

# P(team_a advances) over team_b in a knockout match -- Layer 1's
# P(win) + 0.5 * P(draw), same convention as the backtest (DECISIONS.md).
AdvanceProbFn = Callable[[str, str], float]

KNOCKOUT_START = "2026-06-28"  # R32 began; earlier meetings are group games

# Round of 16, matches 89-96 in order. A tuple slot is the winner of a
# still-pending earlier match (M87, Colombia vs Ghana).
R16_SLOTS = [
    ("Paraguay", "France"),                    # M89
    ("Canada", "Morocco"),                     # M90
    ("Brazil", "Norway"),                      # M91
    ("Mexico", "England"),                     # M92
    ("Portugal", "Spain"),                     # M93
    ("United States", "Belgium"),              # M94
    ("Argentina", "Egypt"),                    # M95
    ("Switzerland", ("Colombia", "Ghana")),    # M96
]
# Quarterfinals M97-M100 as index pairs into R16 (97=W89vW90, 98=W93vW94,
# 99=W91vW92, 100=W95vW96 -- note 98/99 are NOT in naive sequential order).
QF_CHILDREN = [(0, 1), (4, 5), (2, 3), (6, 7)]
# Semifinals M101 (W97 v W98), M102 (W99 v W100); final = winners of both.
SF_CHILDREN = [(0, 1), (2, 3)]

_DRAW = "__draw__"


def _result_lookup(matches: list[Match]) -> dict[frozenset, str]:
    """Knockout-window results: pair -> winner, or _DRAW if it went to a
    shootout whose winner the score feed can't tell us."""
    lookup: dict[frozenset, str] = {}
    for m in matches:
        if m.date.isoformat() < KNOCKOUT_START:
            continue
        key = frozenset((m.home_team, m.away_team))
        if m.home_score != m.away_score:
            lookup[key] = m.home_team if m.home_score > m.away_score else m.away_team
        else:
            lookup[key] = _DRAW
    return lookup


def _infer_drawn_winner(a: str, b: str, fixtures: list[tuple[str, str]]) -> str | None:
    """After (a, b) ended in a shootout, whichever of them appears in a
    fixture against a DIFFERENT opponent has advanced."""
    for home, away in fixtures:
        pair = {home, away}
        if a in pair and b not in pair:
            return a
        if b in pair and a not in pair:
            return b
    return None


def build_2026_tree(matches: list[Match], upcoming_fixtures: list[tuple[str, str]] | None = None):
    """Current bracket state as a tree. A node is either a team name
    (winner known / slot resolved) or ("match", node_a, node_b) for a
    match still to be decided. Returns the final's node."""
    lookup = _result_lookup(matches)
    fixtures = upcoming_fixtures or []

    def match_node(node_a, node_b):
        if isinstance(node_a, str) and isinstance(node_b, str):
            outcome = lookup.get(frozenset((node_a, node_b)))
            if outcome == _DRAW:
                outcome = _infer_drawn_winner(node_a, node_b, fixtures)
            if outcome:
                return outcome
        return ("match", node_a, node_b)

    def slot_node(slot):
        if isinstance(slot, tuple):  # pending earlier match feeding this slot
            return match_node(slot[0], slot[1])
        return slot

    r16 = [match_node(slot_node(a), slot_node(b)) for a, b in R16_SLOTS]
    qf = [match_node(r16[i], r16[j]) for i, j in QF_CHILDREN]
    sf = [match_node(qf[i], qf[j]) for i, j in SF_CHILDREN]
    return match_node(sf[0], sf[1])


def alive_teams(tree) -> set[str]:
    if isinstance(tree, str):
        return {tree}
    return alive_teams(tree[1]) | alive_teams(tree[2])


def simulate_champion_probabilities(
    tree,
    advance_prob_fn: AdvanceProbFn,
    n_sims: int = 10_000,
    seed: int = 42,
) -> dict[str, float]:
    """P(wins World Cup) for every team still alive in the tree. Match
    probabilities are memoized across simulations (same rationale as the
    backtest simulator: only a few dozen distinct matchups exist)."""
    rng = random.Random(seed)
    cache: dict[tuple[str, str], float] = {}

    def p_advances(a: str, b: str) -> float:
        key = (a, b)
        if key not in cache:
            cache[key] = advance_prob_fn(a, b)
        return cache[key]

    def resolve(node) -> str:
        if isinstance(node, str):
            return node
        a, b = resolve(node[1]), resolve(node[2])
        return a if rng.random() < p_advances(a, b) else b

    tally: Counter = Counter()
    for _ in range(n_sims):
        tally[resolve(tree)] += 1

    return {team: tally.get(team, 0) / n_sims for team in alive_teams(tree)}

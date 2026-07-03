"""The Layer 1 ensemble's third member: a simple, non-trained team-strength
heuristic based on FIFA ranking points difference. Also reused, on its own
(un-blended), as the "trivial baseline" CLAUDE.md asks the dashboard to show
lift over -- e.g. "higher-FIFA-ranking-wins" made smooth enough to score
(Brier/log-loss) instead of a hard 100/0 call. See DECISIONS.md.
"""

import math

RANK_SCALE = 200.0  # fixed, not fit to data -- keeps this a "heuristic"
PEAK_DRAW_RATE = 0.30  # draw rate between two evenly matched teams (gap = 0)
FLOOR_DRAW_RATE = 0.06  # draw rate floor once the gap is large
DRAW_DECAY_SCALE = 250.0  # controls how fast draw probability shrinks with the gap


def fifa_heuristic_probs(rank_points_diff: float) -> tuple[float, float, float]:
    """Returns (p_loss, p_draw, p_win) for the team with `rank_points_diff`
    = its FIFA points minus the opponent's.

    Draw probability decays (Gaussian, symmetric in the gap's sign) from
    PEAK_DRAW_RATE at an even match to FLOOR_DRAW_RATE as the gap widens --
    replacing a flat 25% rate that assumed the same draw chance regardless
    of mismatch. The trained members (XGBoost, logistic) already learn this
    from data; only the heuristic needed the explicit fix (see DECISIONS.md).
    """
    raw_win = 1.0 / (1.0 + 10 ** (-rank_points_diff / RANK_SCALE))
    decay = math.exp(-((rank_points_diff / DRAW_DECAY_SCALE) ** 2))
    p_draw = FLOOR_DRAW_RATE + (PEAK_DRAW_RATE - FLOOR_DRAW_RATE) * decay
    p_win = raw_win * (1.0 - p_draw)
    p_loss = (1.0 - raw_win) * (1.0 - p_draw)
    return p_loss, p_draw, p_win

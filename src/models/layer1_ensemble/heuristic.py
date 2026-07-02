"""The Layer 1 ensemble's third member: a simple, non-trained team-strength
heuristic based on FIFA ranking points difference. Also reused, on its own
(un-blended), as the "trivial baseline" CLAUDE.md asks the dashboard to show
lift over -- e.g. "higher-FIFA-ranking-wins" made smooth enough to score
(Brier/log-loss) instead of a hard 100/0 call. See DECISIONS.md.
"""

RANK_SCALE = 200.0  # fixed, not fit to data -- keeps this a "heuristic"
FIXED_DRAW_RATE = 0.25  # roughly international football's historical draw rate


def fifa_heuristic_probs(rank_points_diff: float) -> tuple[float, float, float]:
    """Returns (p_loss, p_draw, p_win) for the team with `rank_points_diff`
    = its FIFA points minus the opponent's."""
    raw_win = 1.0 / (1.0 + 10 ** (-rank_points_diff / RANK_SCALE))
    p_draw = FIXED_DRAW_RATE
    p_win = raw_win * (1.0 - p_draw)
    p_loss = (1.0 - raw_win) * (1.0 - p_draw)
    return p_loss, p_draw, p_win

"""Feature construction for Layer 1: turns two teams' Elo/form/rank state
as-of a given date into a symmetric feature row, and builds a labeled
training set from match history.

Label convention (3-class, "team_a" perspective): 0 = team_a lost,
1 = draw, 2 = team_a won.
"""

from datetime import date

from src.features import team_timeline
from src.features.rankings import rank_points_as_of

FEATURE_NAMES = [
    "elo_diff",
    "form_goals_for_diff",
    "form_goals_against_diff",
    "form_win_rate_diff",
    "rank_points_diff",
    "neutral",
]
ELO_IDX = 0
NEUTRAL_IDX = 5
RANK_IDX = 4


def build_feature_row(
    team_a: str,
    team_b: str,
    as_of: date,
    timelines: dict,
    rankings: dict,
    neutral: bool,
) -> list[float]:
    snap_a = team_timeline.snapshot_as_of(timelines, team_a, as_of)
    snap_b = team_timeline.snapshot_as_of(timelines, team_b, as_of)
    rank_a = rank_points_as_of(rankings, team_a, as_of)
    rank_b = rank_points_as_of(rankings, team_b, as_of)
    rank_diff = (rank_a - rank_b) if rank_a is not None and rank_b is not None else 0.0
    return [
        snap_a.elo - snap_b.elo,
        snap_a.form_goals_for - snap_b.form_goals_for,
        snap_a.form_goals_against - snap_b.form_goals_against,
        snap_a.form_win_rate - snap_b.form_win_rate,
        rank_diff,
        1.0 if neutral else 0.0,
    ]


def build_training_set(matches, timelines, rankings, start: date, end: date):
    """One symmetric pair of rows per match in [start, end): (home, away)
    and (away, home), so the model doesn't learn an artificial "team listed
    first" bias on top of the real, feature-encoded home-field effect."""
    X, y = [], []
    for m in matches:
        if not (start <= m.date < end):
            continue
        row_home = build_feature_row(
            m.home_team, m.away_team, m.date, timelines, rankings, m.neutral
        )
        if m.home_score > m.away_score:
            label_home, label_away = 2, 0
        elif m.home_score < m.away_score:
            label_home, label_away = 0, 2
        else:
            label_home, label_away = 1, 1

        row_away = [-v for v in row_home[:-1]] + [row_home[-1]]

        X.append(row_home)
        y.append(label_home)
        X.append(row_away)
        y.append(label_away)
    return X, y

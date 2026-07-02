"""Incremental Elo rating + rolling form, computed in one chronological pass
over match history (CLAUDE.md: "a simple state-space rating update" /
"rolling averages" feeding Layer 1).

Snapshots are recorded *after* each match a team plays. `snapshot_as_of`
only ever returns a snapshot strictly before the requested date, so
features for a given match never see that match's own result.
"""

import bisect
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import date

from src.features.data_loading import Match

DEFAULT_ELO = 1500.0


@dataclass
class Snapshot:
    date: date
    elo: float
    form_goals_for: float
    form_goals_against: float
    form_win_rate: float  # avg points/3 over the trailing window
    matches_played: int


def _expected_score(rating_a: float, rating_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))


def _goal_diff_multiplier(diff: int) -> float:
    if diff <= 1:
        return 1.0
    if diff == 2:
        return 1.5
    return (11 + diff) / 8.0


def build_timelines(
    matches: list[Match],
    k: float = 32.0,
    home_advantage: float = 100.0,
    form_window: int = 10,
) -> dict[str, list[Snapshot]]:
    elo: dict[str, float] = defaultdict(lambda: DEFAULT_ELO)
    recent: dict[str, deque] = defaultdict(lambda: deque(maxlen=form_window))
    timelines: dict[str, list[Snapshot]] = defaultdict(list)

    for m in matches:
        home_elo, away_elo = elo[m.home_team], elo[m.away_team]
        eff_home_elo = home_elo + (0.0 if m.neutral else home_advantage)
        expected_home = _expected_score(eff_home_elo, away_elo)

        if m.home_score > m.away_score:
            actual_home, home_pts, away_pts = 1.0, 3, 0
        elif m.home_score < m.away_score:
            actual_home, home_pts, away_pts = 0.0, 0, 3
        else:
            actual_home, home_pts, away_pts = 0.5, 1, 1

        delta = k * _goal_diff_multiplier(abs(m.home_score - m.away_score)) * (
            actual_home - expected_home
        )
        elo[m.home_team] = home_elo + delta
        elo[m.away_team] = away_elo - delta

        for team, gf, ga, pts in (
            (m.home_team, m.home_score, m.away_score, home_pts),
            (m.away_team, m.away_score, m.home_score, away_pts),
        ):
            dq = recent[team]
            dq.append((gf, ga, pts))
            n = len(dq)
            timelines[team].append(
                Snapshot(
                    date=m.date,
                    elo=elo[team],
                    form_goals_for=sum(x[0] for x in dq) / n,
                    form_goals_against=sum(x[1] for x in dq) / n,
                    form_win_rate=sum(x[2] for x in dq) / (3.0 * n),
                    matches_played=n,
                )
            )

    return timelines


def snapshot_as_of(
    timelines: dict[str, list[Snapshot]], team: str, as_of: date
) -> Snapshot:
    """Team's state from its last match strictly before `as_of`, or a
    neutral default (1500 Elo, no form history) if it has none."""
    snaps = timelines.get(team)
    if not snaps:
        return Snapshot(as_of, DEFAULT_ELO, 0.0, 0.0, 0.5, 0)
    dates = [s.date for s in snaps]
    idx = bisect.bisect_left(dates, as_of) - 1
    if idx < 0:
        return Snapshot(as_of, DEFAULT_ELO, 0.0, 0.0, 0.5, 0)
    return snaps[idx]

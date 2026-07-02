from datetime import date

from src.features.data_loading import Match
from src.features.team_timeline import DEFAULT_ELO, build_timelines, snapshot_as_of


def _match(d, home, away, hs, as_, neutral=True):
    return Match(date=d, home_team=home, away_team=away, home_score=hs, away_score=as_,
                 tournament="Friendly", neutral=neutral)


def test_snapshot_as_of_never_leaks_same_or_future_matches():
    matches = [
        _match(date(2020, 1, 1), "A", "B", 3, 0),
        _match(date(2020, 6, 1), "A", "B", 0, 3),
    ]
    timelines = build_timelines(matches)

    # Before any match: default rating, no history.
    snap = snapshot_as_of(timelines, "A", date(2020, 1, 1))
    assert snap.elo == DEFAULT_ELO
    assert snap.matches_played == 0

    # Strictly between the two matches: only the first match counted.
    snap = snapshot_as_of(timelines, "A", date(2020, 3, 1))
    assert snap.matches_played == 1
    assert snap.elo > DEFAULT_ELO  # A won the first match

    # On the second match's own date: still must not include it.
    snap = snapshot_as_of(timelines, "A", date(2020, 6, 1))
    assert snap.matches_played == 1


def test_elo_moves_toward_the_winner():
    matches = [_match(date(2020, 1, 1), "A", "B", 2, 0)]
    timelines = build_timelines(matches)

    snap_a = snapshot_as_of(timelines, "A", date(2020, 1, 2))
    snap_b = snapshot_as_of(timelines, "B", date(2020, 1, 2))
    assert snap_a.elo > DEFAULT_ELO
    assert snap_b.elo < DEFAULT_ELO

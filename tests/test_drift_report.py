from datetime import date, timedelta

from src.features.data_loading import Match
from src.features.team_timeline import build_timelines
from src.monitoring.drift_report import feature_frame, run_drift_report, summarize


def _match(d, home, away, hs, as_):
    return Match(date=d, home_team=home, away_team=away, home_score=hs, away_score=as_,
                 tournament="Friendly", neutral=True)


def _matches_from(start, n, home_score, away_score):
    return [
        _match(start + timedelta(days=7 * i), "A", "B", home_score, away_score)
        for i in range(n)
    ]


def test_feature_frame_has_expected_columns_and_row_count():
    matches = _matches_from(date(2016, 1, 1), 5, 2, 0)
    timelines = build_timelines(matches)
    df = feature_frame(matches, timelines, {}, date(2016, 1, 1), date(2017, 1, 1))

    assert list(df.columns) == [
        "elo_diff", "form_goals_for_diff", "form_goals_against_diff",
        "form_win_rate_diff", "rank_points_diff",
    ]
    assert len(df) == 2 * len(matches)  # symmetric home+away rows per match


def test_drift_detected_when_current_window_is_a_clear_shift():
    # Reference: A and B are evenly matched (score draws) for years.
    reference_matches = _matches_from(date(2010, 1, 1), 60, 1, 1)
    # Current: A dominates B repeatedly right before the check -- a sharp,
    # obvious Elo/form shift the drift check should catch.
    current_start = date(2025, 1, 1)
    current_matches = _matches_from(current_start, 15, 4, 0)

    all_matches = reference_matches + current_matches
    timelines = build_timelines(all_matches)

    reference = feature_frame(all_matches, timelines, {}, date(2010, 1, 1), current_start)
    current = feature_frame(all_matches, timelines, {}, current_start, date(2026, 1, 1))

    report = run_drift_report(reference, current)
    summary = summarize(report)

    assert summary["dataset_drift"] is True
    assert summary["columns"]["elo_diff"]["drift_detected"] is True

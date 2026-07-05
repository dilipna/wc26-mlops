from datetime import date

from src.features.data_loading import Match
from src.monitoring.data_quality import (
    build_report,
    duplicate_report,
    historical_live_overlap,
    matches_to_frame,
    missing_value_report,
    schema_report,
)


def _match(d, home, away, hs=1, as_=0, tournament="Friendly", neutral=True):
    return Match(date=d, home_team=home, away_team=away, home_score=hs, away_score=as_,
                 tournament=tournament, neutral=neutral)


def test_missing_value_report_is_zero_for_complete_data():
    df = matches_to_frame([_match(date(2020, 1, 1), "A", "B")])
    report = missing_value_report(df)
    assert all(col["missing"] == 0 for col in report.values())
    assert report["home_team"]["total"] == 1


def test_schema_report_valid_for_expected_columns():
    df = matches_to_frame([_match(date(2020, 1, 1), "A", "B")])
    report = schema_report(df)
    assert report["valid"] is True
    assert report["dtype_mismatches"] == {}


def test_schema_report_flags_missing_column():
    df = matches_to_frame([_match(date(2020, 1, 1), "A", "B")]).drop(columns=["neutral"])
    report = schema_report(df)
    assert report["valid"] is False
    assert report["columns_present"]["neutral"] is False


def test_duplicate_report_detects_repeated_key():
    df = matches_to_frame([
        _match(date(2020, 1, 1), "A", "B"),
        _match(date(2020, 1, 1), "A", "B"),
        _match(date(2020, 1, 2), "C", "D"),
    ])
    report = duplicate_report(df)
    assert report["duplicate_rows"] == 2
    assert report["duplicate_keys"] == 1
    assert report["total_rows"] == 3


def test_historical_live_overlap_counts_shared_matches():
    historical = [_match(date(2026, 6, 1), "A", "B"), _match(date(2026, 6, 2), "C", "D")]
    live = [_match(date(2026, 6, 1), "A", "B"), _match(date(2026, 6, 3), "E", "F")]
    overlap = historical_live_overlap(historical, live)
    assert overlap == {"historical_count": 2, "live_count": 2, "overlap_count": 1}


def test_build_report_combines_all_checks():
    historical = [_match(date(2026, 6, 1), "A", "B")]
    live = [_match(date(2026, 6, 1), "A", "B")]
    report = build_report(historical, live)
    assert report["duplicates_before_dedup"]["total_rows"] == 2
    assert report["historical_live_overlap"]["overlap_count"] == 1
    assert report["schema"]["valid"] is True

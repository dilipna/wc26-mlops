from src.verification import proof_tracker


def _prediction(home, away, commence_time, logged_at, model, bookmaker=None):
    row = {
        "home_team": home,
        "away_team": away,
        "commence_time": commence_time,
        "logged_at": logged_at,
        "model_home_win": model[0],
        "model_draw": model[1],
        "model_away_win": model[2],
        "bookmaker_home_win": None,
        "bookmaker_draw": None,
        "bookmaker_away_win": None,
    }
    if bookmaker is not None:
        row["bookmaker_home_win"], row["bookmaker_draw"], row["bookmaker_away_win"] = bookmaker
    return row


def _result(home, away, home_score, away_score):
    return {"home_team": home, "away_team": away, "home_score": str(home_score), "away_score": str(away_score)}


def test_latest_prediction_per_fixture_keeps_last_snapshot():
    rows = [
        _prediction("Spain", "Italy", "2026-07-05T18:00:00Z", "2026-07-03T06:00:00Z", (0.5, 0.3, 0.2)),
        _prediction("Spain", "Italy", "2026-07-05T18:00:00Z", "2026-07-04T06:00:00Z", (0.61, 0.24, 0.15)),
    ]
    latest = proof_tracker.latest_prediction_per_fixture(rows)
    key = ("Spain", "Italy", "2026-07-05T18:00:00Z")
    assert latest[key]["model_home_win"] == 0.61


def test_grade_match_correct_pick_with_bookmaker():
    prediction = _prediction(
        "Spain", "Italy", "2026-07-05T18:00:00Z", "2026-07-04T06:00:00Z",
        model=(0.61, 0.24, 0.15), bookmaker=(0.55, 0.25, 0.20),
    )
    result = _result("Spain", "Italy", 3, 0)
    card = proof_tracker.grade_match(prediction, result)

    assert card["actual_outcome"] == "home_win"
    assert card["model_predicted_outcome"] == "home_win"
    assert card["model_correct"] is True
    assert card["model_brier"] == (0.61 - 1) ** 2 + 0.24**2 + 0.15**2
    assert card["bookmaker_correct"] is True


def test_grade_match_wrong_pick_and_no_bookmaker_odds():
    prediction = _prediction("France", "Norway", "2026-07-05T18:00:00Z", "2026-07-04T06:00:00Z", model=(0.7, 0.2, 0.1))
    result = _result("France", "Norway", 0, 2)
    card = proof_tracker.grade_match(prediction, result)

    assert card["actual_outcome"] == "away_win"
    assert card["model_correct"] is False
    assert card["bookmaker"] is None
    assert card["bookmaker_correct"] is None


def test_summarize_averages_across_graded_matches():
    graded = [
        proof_tracker.grade_match(
            _prediction("A", "B", "t1", "l1", model=(0.8, 0.1, 0.1), bookmaker=(0.6, 0.2, 0.2)),
            _result("A", "B", 2, 0),
        ),
        proof_tracker.grade_match(
            _prediction("C", "D", "t2", "l2", model=(0.2, 0.2, 0.6)),
            _result("C", "D", 1, 1),
        ),
    ]
    summary = proof_tracker.summarize(graded)
    assert summary["n_graded"] == 2
    assert summary["model_accuracy"] == 0.5  # first correct (home_win), second wrong (predicted away_win, actual draw)
    assert summary["n_bookmaker_graded"] == 1
    assert summary["bookmaker_accuracy"] == 1.0


def test_build_calibration_buckets_by_confidence():
    graded = [
        proof_tracker.grade_match(_prediction("A", "B", "t1", "l1", model=(0.9, 0.05, 0.05)), _result("A", "B", 1, 0)),
        proof_tracker.grade_match(_prediction("C", "D", "t2", "l2", model=(0.85, 0.1, 0.05)), _result("C", "D", 0, 2)),
    ]
    calibration = proof_tracker.build_calibration(graded, n_bins=5)
    top_bucket = calibration[-1]
    assert top_bucket["n"] == 2
    assert top_bucket["actual_rate"] == 0.5


def test_build_report_skips_unplayed_fixtures():
    prediction_rows = [
        _prediction("Spain", "Italy", "2026-07-05T18:00:00Z", "2026-07-04T06:00:00Z", model=(0.6, 0.25, 0.15)),
        _prediction("Brazil", "Norway", "2026-07-06T18:00:00Z", "2026-07-05T06:00:00Z", model=(0.7, 0.2, 0.1)),
    ]
    results_by_fixture = {("Spain", "Italy"): _result("Spain", "Italy", 2, 1)}  # Brazil-Norway not played yet

    report = proof_tracker.build_report(prediction_rows, results_by_fixture)

    assert report["summary"]["n_graded"] == 1
    assert len(report["graded_matches"]) == 1
    assert report["graded_matches"][0]["home_team"] == "Spain"

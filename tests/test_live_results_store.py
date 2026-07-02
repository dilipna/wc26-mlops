from src.ingestion import live_results_store


def _event(date, home, away, home_score, away_score, completed=True):
    return {
        "commence_time": f"{date}T18:00:00Z",
        "home_team": home,
        "away_team": away,
        "completed": completed,
        "scores": [
            {"name": home, "score": str(home_score)},
            {"name": away, "score": str(away_score)},
        ],
    }


def test_append_skips_incomplete_and_duplicate_matches(tmp_path, monkeypatch):
    monkeypatch.setattr(live_results_store, "LOG_PATH", tmp_path / "results_log.csv")

    events = [
        _event("2026-07-02", "France", "Sweden", 3, 0),
        _event("2026-07-02", "Spain", "Austria", 0, 0, completed=False),  # not finished yet
    ]
    added = live_results_store.append_new_results(events)
    assert added == 1

    matches = live_results_store.load_live_matches()
    assert len(matches) == 1
    assert matches[0].home_team == "France" and matches[0].home_score == 3

    # Re-fetching the same completed match (e.g. next day's rolling window
    # overlap) must not create a duplicate row.
    added_again = live_results_store.append_new_results(events)
    assert added_again == 0
    assert len(live_results_store.load_live_matches()) == 1

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


def test_combined_matches_dedups_swapped_order_and_utc_date_shift(monkeypatch):
    # Regression, 2026-09-14: 5 real WC matches were double-counted in Elo.
    from datetime import date

    from src.features.data_loading import Match

    def m(d, home, away, hs, as_, neutral):
        return Match(date.fromisoformat(d), home, away, hs, as_, "FIFA World Cup", neutral)

    historical = [
        m("2026-06-24", "Mexico", "Czech Republic", 3, 0, False),
        m("2026-06-30", "Mexico", "Ecuador", 2, 0, False),
    ]
    live = [
        m("2026-06-24", "Czech Republic", "Mexico", 0, 3, True),  # home/away swapped
        m("2026-07-01", "Mexico", "Ecuador", 2, 0, True),         # UTC date, +1 day
        m("2026-07-05", "Mexico", "England", 2, 3, True),         # genuinely new
    ]
    monkeypatch.setattr(live_results_store, "load_results", lambda: historical)
    monkeypatch.setattr(live_results_store, "load_live_matches", lambda: live)

    combined = live_results_store.load_combined_matches()
    assert len(combined) == 3
    assert combined[0].neutral is False  # historical row (real venue flag) wins
    assert combined[-1].away_team == "England"

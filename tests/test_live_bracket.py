from datetime import date

from src.features.data_loading import Match
from src.models.layer2_simulation import live_bracket


def _match(d, home, away, hs, as_):
    return Match(
        date=date.fromisoformat(d), home_team=home, away_team=away,
        home_score=hs, away_score=as_, tournament="FIFA World Cup", neutral=True,
    )


def test_empty_state_has_17_alive_teams():
    # 16 R16 entrants + the still-unplayed Colombia/Ghana R32 match = 17
    # teams that can still mathematically win.
    tree = live_bracket.build_2026_tree([])
    assert len(live_bracket.alive_teams(tree)) == 17


def test_decisive_results_resolve_and_group_games_are_ignored():
    results = [
        # Group-stage meeting of an R16 pairing must NOT resolve the tie
        # (Colombia beat Portugal in Group K before the knockout began).
        _match("2026-06-24", "Portugal", "Spain", 9, 0),
        # Real knockout results resolve slots.
        _match("2026-07-04", "Paraguay", "France", 0, 2),
        _match("2026-07-04", "Colombia", "Ghana", 1, 0),
    ]
    tree = live_bracket.build_2026_tree(results)
    alive = live_bracket.alive_teams(tree)
    assert "Paraguay" not in alive and "France" in alive
    assert "Ghana" not in alive and "Colombia" in alive
    assert "Portugal" in alive and "Spain" in alive  # group game ignored
    assert len(alive) == 15


def test_drawn_knockout_match_stays_pending_until_fixture_reveals_winner():
    results = [_match("2026-07-04", "Canada", "Morocco", 1, 1)]  # to pens
    tree = live_bracket.build_2026_tree(results)
    alive = live_bracket.alive_teams(tree)
    assert "Canada" in alive and "Morocco" in alive  # unresolved: both alive

    # Once Morocco shows up in a QF fixture against someone else, it's over.
    tree = live_bracket.build_2026_tree(results, upcoming_fixtures=[("France", "Morocco")])
    alive = live_bracket.alive_teams(tree)
    assert "Morocco" in alive and "Canada" not in alive


def test_drawn_match_stays_resolved_after_the_revealing_match_is_played():
    # Regression, 2026-09-14: Switzerland-Colombia went to pens; once the
    # Argentina-Switzerland QF was PLAYED (no longer an upcoming fixture)
    # the slot reverted to pending and froze that half of the bracket.
    results = [
        _match("2026-07-02", "Switzerland", "Algeria", 2, 0),  # R32: must not count
        _match("2026-07-04", "Colombia", "Ghana", 1, 0),       # R32: must not count
        _match("2026-07-07", "Argentina", "Egypt", 3, 2),
        _match("2026-07-07", "Switzerland", "Colombia", 0, 0),
        _match("2026-07-12", "Argentina", "Switzerland", 3, 1),
    ]
    alive = live_bracket.alive_teams(live_bracket.build_2026_tree(results))
    assert "Colombia" not in alive and "Switzerland" not in alive
    assert "Argentina" in alive


def test_full_real_2026_knockout_resolves_to_the_champion():
    real = [
        ("2026-07-04", "Colombia", "Ghana", 1, 0), ("2026-07-04", "Canada", "Morocco", 0, 3),
        ("2026-07-04", "Paraguay", "France", 0, 1), ("2026-07-05", "Brazil", "Norway", 1, 2),
        ("2026-07-06", "Mexico", "England", 2, 3), ("2026-07-06", "Portugal", "Spain", 0, 1),
        ("2026-07-07", "United States", "Belgium", 1, 4), ("2026-07-07", "Argentina", "Egypt", 3, 2),
        ("2026-07-07", "Switzerland", "Colombia", 0, 0), ("2026-07-09", "France", "Morocco", 2, 0),
        ("2026-07-10", "Spain", "Belgium", 2, 1), ("2026-07-11", "Norway", "England", 1, 2),
        ("2026-07-12", "Argentina", "Switzerland", 3, 1), ("2026-07-14", "France", "Spain", 0, 2),
        ("2026-07-15", "England", "Argentina", 1, 2), ("2026-07-18", "France", "England", 4, 6),
        ("2026-07-19", "Spain", "Argentina", 1, 0),
    ]
    tree = live_bracket.build_2026_tree([_match(*r) for r in real])
    assert tree == "Spain"
    probs = live_bracket.simulate_champion_probabilities(tree, lambda a, b: 0.5, n_sims=10)
    assert probs == {"Spain": 1.0}


def test_simulation_probs_sum_to_one_and_respect_certainty():
    tree = live_bracket.build_2026_tree([])
    probs = live_bracket.simulate_champion_probabilities(
        tree, lambda a, b: 0.5, n_sims=2000
    )
    assert abs(sum(probs.values()) - 1.0) < 1e-9
    assert set(probs) == live_bracket.alive_teams(tree)

    # A team that always advances must win every simulation.
    probs = live_bracket.simulate_champion_probabilities(
        tree, lambda a, b: 1.0 if a == "Brazil" else (0.0 if b == "Brazil" else 0.5),
        n_sims=500,
    )
    assert probs["Brazil"] == 1.0

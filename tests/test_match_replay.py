from dataclasses import replace
import math
import pytest
from src.core.match_replay import Game, probability, replay, metrics, load_games


def g(id, day, won=1, a="A", b="B", neutral=True):
    return Game(id, day, a, b, won, neutral)


def fixture():
    return [
        g("warm1", "2020-01-01"),
        g("warm2", "2020-01-02", 0),
        g("eval1", "2021-01-01"),
        g("eval2", "2021-01-02", 0),
    ]


def run(games):
    return replay(games, evaluation_start="2021-01-01", evaluation_end="2022-01-01")


def test_probability_symmetry_home_advantage_and_invalid_values():
    assert probability(1500, 1500) == 0.5
    assert probability(1500, 1500, 75) > 0.5
    assert probability(1600, 1500) == pytest.approx(1 - probability(1500, 1600))
    for bad in [float("nan"), float("inf")]:
        with pytest.raises(ValueError):
            probability(bad, 1500)
    with pytest.raises(ValueError):
        probability(1500, 1500, scale=0)


def test_metrics_against_hand_calculation():
    rows = [{"p": 0.75, "side_a_won": 1}, {"p": 0.25, "side_a_won": 0}]
    result = metrics(rows, "p")
    assert result["log_loss"] == pytest.approx(-math.log(0.75))
    assert result["summed_brier"] == pytest.approx(0.125)
    assert sum(b["n"] for b in result["calibration"]) == 2
    with pytest.raises(ValueError):
        metrics([], "p")


def test_training_baseline_does_not_use_evaluation_outcomes():
    first = run(fixture())
    changed = fixture()
    changed[-1] = replace(changed[-1], side_a_won=1)
    assert (
        first["baseline_probability_a"] == run(changed)["baseline_probability_a"] == 0.5
    )
    assert first["training_matches"] == 2
    assert first["model_metrics"]["n"] == 2


def test_future_outcomes_cannot_change_past_predictions():
    first = run(fixture())
    changed = fixture()
    changed[-1] = replace(changed[-1], side_a_won=1)
    assert first["predictions"][0] == run(changed)["predictions"][0]
    assert (
        first["predictions"][1]["probability_a"]
        == run(changed)["predictions"][1]["probability_a"]
    )


def test_entire_date_is_scored_before_any_outcomes_are_applied():
    games = fixture() + [g("same-day", "2021-01-01", 0)]
    result = run(games)
    same = [p for p in result["predictions"] if p["date"] == "2021-01-01"]
    assert len(same) == 2
    assert same[0]["probability_a"] == same[1]["probability_a"]
    assert same[0]["pre_date_state_sha256"] == same[1]["pre_date_state_sha256"]
    assert result == run(list(reversed(games)))


def test_rating_updates_conserve_total_and_neutral_overrides_advantage():
    result = run(fixture())
    assert sum(x["rating"] for x in result["ratings"]) == pytest.approx(3000)
    neutral = replay(
        fixture(),
        evaluation_start="2021-01-01",
        evaluation_end="2022-01-01",
        home_advantage=75,
    )
    assert neutral["predictions"] == result["predictions"]


@pytest.mark.parametrize(
    "change",
    [
        {"side_a_won": 2},
        {"side_a_won": True},
        {"side_b": "A"},
        {"date": "not-a-date"},
        {"neutral": 1},
        {"side_a": "A\nB"},
    ],
)
def test_invalid_game_contract_rejected(change):
    with pytest.raises(ValueError):
        replace(g("a", "2020-01-01"), **change)


def test_duplicate_ids_empty_warmup_and_empty_evaluation_rejected():
    with pytest.raises(ValueError):
        run(fixture() + [fixture()[0]])
    with pytest.raises(ValueError):
        run(fixture()[2:])
    with pytest.raises(ValueError):
        run(fixture()[:2])


def test_loader_rejects_schema_duplicates_and_bad_neutral(tmp_path):
    p = tmp_path / "games.csv"
    p.write_text("bad,columns\na,b\n")
    with pytest.raises(ValueError):
        load_games(p)
    body = "match_id,date,side_a,side_b,side_a_won,neutral\nx,2020-01-01,A,B,1,1\n"
    p.write_text(body + "x,2020-01-01,A,B,1,1\n")
    with pytest.raises(ValueError):
        load_games(p)
    p.write_text(body.replace(",1,1", ",1,9"))
    with pytest.raises(ValueError):
        load_games(p)


def test_replay_plugins_register_explicit_binary_contracts_without_football_coercion():
    from src.core.sport import get_sport
    from src.sports.replays import register_replay_sports

    plugins = register_replay_sports()
    assert set(plugins) == {"basketball", "nfl", "cricket"}
    for key, plugin in plugins.items():
        assert get_sport(key) is plugin
        assert plugin.config.outcome_labels == ("side_a_win", "side_b_win")
        assert plugin.source_key == key

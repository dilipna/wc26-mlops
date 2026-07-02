from src.features.data_loading import load_results, load_shootouts, world_cup_matches
from src.models.layer2_simulation.bracket import build_bracket


def test_2018_bracket_matches_real_history():
    matches = load_results()
    shootouts = load_shootouts()
    bracket = build_bracket(world_cup_matches(matches, 2018), shootouts)

    assert bracket.champion == "France"
    assert len(bracket.rounds["R16"]) == 8
    assert len(bracket.rounds["QF"]) == 4
    assert len(bracket.rounds["SF"]) == 2
    assert len(bracket.rounds["F"]) == 1
    # Every non-opening-round match's children must reference valid indices
    # into the previous round.
    assert all(0 <= i < 8 and 0 <= j < 8 for (i, j) in (m.children for m in bracket.rounds["QF"]))
    assert all(0 <= i < 4 and 0 <= j < 4 for (i, j) in (m.children for m in bracket.rounds["SF"]))


def test_2022_bracket_matches_real_history_including_penalty_shootouts():
    matches = load_results()
    shootouts = load_shootouts()
    bracket = build_bracket(world_cup_matches(matches, 2022), shootouts)

    assert bracket.champion == "Argentina"
    # 2022 final (Argentina 3-3 France) was decided on penalties -- this
    # only resolves correctly if the shootout lookup, not the raw score, is
    # what determines the winner.
    assert bracket.winners["F"][0] == "Argentina"

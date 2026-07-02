from src.ingestion.odds_api import devig


def test_devig_normalizes_overround_to_one():
    # Two teams, two bookmakers each pricing in a ~5% overround.
    team_implied_prices = {
        "France": [1 / 2.0, 1 / 2.1],
        "Argentina": [1 / 2.0, 1 / 2.05],
    }
    probs = devig(team_implied_prices)

    assert abs(sum(probs.values()) - 1.0) < 1e-9
    # Argentina priced slightly shorter on average -> should end up ahead.
    assert probs["Argentina"] > probs["France"]

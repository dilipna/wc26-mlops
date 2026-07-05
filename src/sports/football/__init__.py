"""Football (FIFA World Cup) sport plugin -- the first implementation of
`src.core.sport.Sport`.

Everything genuinely football-specific (tournament identity, the 3-outcome
win/draw/loss label set, Odds API sport keys, and the knockout bracket
builders) is collected here. The engineering it plugs into --
`src.ingestion`, `src.features`, `src.models.layer1_ensemble`,
`src.serving`, `src.orchestration` -- stays generic and either takes these
values as parameters or (for `src.ingestion.odds_api`, which has no
per-call config today) imports this module directly.

`src.features.data_loading` and `src.ingestion.live_results_store` do
*not* import this module even though they need `tournament_name`: both are
imported by `src.models.layer2_simulation.{bracket,live_bracket}`, which
this module itself imports, so the reverse import would cycle. Those two
modules instead take `tournament_name` as an optional parameter defaulting
to today's literal -- the seam a second sport would thread through, not
built out further until one exists.
"""

from src.core.sport import SportConfig, register
from src.models.layer2_simulation import bracket, live_bracket

FOOTBALL = SportConfig(
    sport_id="football",
    display_name="Football",
    tournament_name="FIFA World Cup",
    outcome_labels=("home_win", "draw", "away_win"),
    odds_api_match_sport_key="soccer_fifa_world_cup",
    odds_api_outright_sport_key="soccer_fifa_world_cup_winner",
    checkpoint_labels=("post_group", "post_r16", "post_qf", "post_sf"),
)


class FootballSport:
    config = FOOTBALL
    build_bracket = staticmethod(bracket.build_bracket)
    build_live_tree = staticmethod(live_bracket.build_2026_tree)


register(FootballSport())

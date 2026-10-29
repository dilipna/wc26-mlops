"""Explicit two-outcome sport plugins; never coerce the football stack to two classes."""

from dataclasses import dataclass
from src.core.sport import SportConfig, register


@dataclass(frozen=True)
class ReplaySport:
    config: SportConfig
    source_key: str


def register_replay_sports():
    plugins = (
        ReplaySport(
            SportConfig(
                "basketball",
                "Basketball",
                "NBA historical archive",
                ("side_a_win", "side_b_win"),
            ),
            "basketball",
        ),
        ReplaySport(
            SportConfig(
                "nfl",
                "American football",
                "NFL historical archive",
                ("side_a_win", "side_b_win"),
            ),
            "nfl",
        ),
        ReplaySport(
            SportConfig(
                "cricket",
                "Cricket",
                "IPL historical archive",
                ("side_a_win", "side_b_win"),
            ),
            "cricket",
        ),
    )
    for plugin in plugins:
        register(plugin)
    return {p.config.sport_id: p for p in plugins}

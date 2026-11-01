"""The `Sport` interface: what a sport plugin must provide.

This platform's engineering (ingestion, feature timelines, the stacked
ensemble, MLflow tracking, FastAPI serving, drift monitoring, most
dashboard components) is already generic -- it operates on plain team
names, match results, and probability dicts, never on anything
football-specific. The things that genuinely vary per sport are collected
here: what the competition is called, what labels a fixture's outcome can
take, which external data-source keys to use, and which bracket/format
builders apply.

A second sport is added by writing `src/sports/<name>/` implementing this
Protocol and calling `register()` -- not by touching the generic modules
above. Basketball, NFL and cricket now register explicit two-outcome historical
replay plugins in src.sports.replays. The existing football training and
serving path remains three-outcome; adding configuration does not make
those football-specific models interchangeable.

Deliberately a `Protocol`, not an ABC: nothing else in this codebase uses
class-based interfaces (see the `Callable`-alias convention in
`src.models.layer2_simulation.live_bracket.AdvanceProbFn`), and a
structural Protocol lets a plugin satisfy this contract without
inheriting from anything.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class SportConfig:
    sport_id: str
    display_name: str
    tournament_name: str
    outcome_labels: tuple[str, ...]
    odds_api_match_sport_key: str | None = None
    odds_api_outright_sport_key: str | None = None
    checkpoint_labels: tuple[str, ...] = ()


@runtime_checkable
class Sport(Protocol):
    config: SportConfig


_REGISTRY: dict[str, Sport] = {}


def register(sport: Sport) -> None:
    _REGISTRY[sport.config.sport_id] = sport


def get_sport(sport_id: str) -> Sport:
    try:
        return _REGISTRY[sport_id]
    except KeyError:
        raise KeyError(f"No sport registered as {sport_id!r}. Registered: {list(_REGISTRY)}") from None


def list_sports() -> list[str]:
    return list(_REGISTRY)

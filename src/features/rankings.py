"""As-of lookups against the FIFA World Ranking history.

Team names differ slightly between the match-results dataset and the
rankings dataset for a handful of teams; ALIASES maps the former to the
latter. Extend this if a name mismatch shows up for a new tournament.
"""

import bisect
from datetime import date

ALIASES = {
    "Iran": "IR Iran",
    "South Korea": "Korea Republic",
    "United States": "USA",
}


def rank_points_as_of(
    rankings: dict[str, list], team: str, as_of: date
) -> float | None:
    """Most recent FIFA ranking points for `team` strictly before `as_of`.

    Returns None if the team has no ranking snapshot before that date.
    """
    name = ALIASES.get(team, team)
    snapshots = rankings.get(name)
    if not snapshots:
        return None
    dates = [s[0] for s in snapshots]
    idx = bisect.bisect_left(dates, as_of) - 1
    if idx < 0:
        return None
    return snapshots[idx][1]

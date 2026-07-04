"""Canonical team naming across data sources.

The historical results dataset (data/historical/results.csv) is the naming
authority, because Elo/form timelines key on its names. The Odds API uses
a few different spellings -- without this mapping, e.g. "USA" starts a
brand-new Elo timeline at the default rating instead of continuing
"United States"'s real one (found 2026-07-04: this was a real cause of
model-vs-bookmaker gaps on USA matches). Apply `canonical()` to every
team name at the ingestion boundary, before anything is stored or looked
up. The dashboard's flags.ts already aliases both spellings, so canonical
names flow through to the UI safely.
"""

ODDS_API_TO_CANONICAL = {
    "USA": "United States",
    "Bosnia & Herzegovina": "Bosnia and Herzegovina",
    "Trinidad & Tobago": "Trinidad and Tobago",
}


def canonical(team: str) -> str:
    return ODDS_API_TO_CANONICAL.get(team, team)

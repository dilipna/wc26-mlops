"""The Odds API client: live bookmaker odds for World Cup 2026 matches, and
the outright "who wins the tournament" market -- a genuinely strong
calibration benchmark (CLAUDE.md), stronger than a FIFA-rank baseline.

Rate limits (verified against the free tier on 2026-07-02, see
DECISIONS.md): credit cost scales with the number of `regions` requested,
not `markets`; ~500 credits/month. Default to a single region to keep
cost at 1 credit/call -- at most a few calls/day this comfortably covers
the remaining tournament.
"""

import os
from datetime import datetime, timezone

import requests

BASE_URL = "https://api.the-odds-api.com/v4"
MATCH_ODDS_SPORT_KEY = "soccer_fifa_world_cup"
OUTRIGHT_SPORT_KEY = "soccer_fifa_world_cup_winner"
DEFAULT_REGION = "uk"


def _api_key() -> str:
    key = os.environ.get("ODDS_API_KEY")
    if not key:
        raise RuntimeError("ODDS_API_KEY not set -- see .env.example")
    return key


def get_quota_status() -> dict:
    """Cheap call (doesn't consume a paid credit) to check remaining quota."""
    r = requests.get(f"{BASE_URL}/sports", params={"apiKey": _api_key()}, timeout=20)
    r.raise_for_status()
    return {
        "remaining": r.headers.get("x-requests-remaining"),
        "used": r.headers.get("x-requests-used"),
    }


def fetch_match_odds(region: str = DEFAULT_REGION) -> list[dict]:
    """Raw h2h odds for upcoming/live World Cup matches."""
    r = requests.get(
        f"{BASE_URL}/sports/{MATCH_ODDS_SPORT_KEY}/odds",
        params={"apiKey": _api_key(), "regions": region, "markets": "h2h"},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def fetch_scores(days_from: int = 3) -> list[dict]:
    """Completed (and in-progress) World Cup match results from the last
    `days_from` days -- the free tier caps this at 3 (verified: requesting
    more returns a 422 INVALID_SCORES_DAYS_FROM error), so this only ever
    covers a rolling recent window, not full tournament history."""
    r = requests.get(
        f"{BASE_URL}/sports/{MATCH_ODDS_SPORT_KEY}/scores",
        params={"apiKey": _api_key(), "daysFrom": days_from},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def fetch_outright_probabilities(region: str = DEFAULT_REGION) -> dict[str, float]:
    """Bookmaker-implied P(wins World Cup) per team: average the implied
    probability (1/decimal price) across bookmakers, then de-vig (normalize
    to sum to 1) -- raw bookmaker odds always overround."""
    r = requests.get(
        f"{BASE_URL}/sports/{OUTRIGHT_SPORT_KEY}/odds",
        params={"apiKey": _api_key(), "regions": region, "markets": "outrights"},
        timeout=20,
    )
    r.raise_for_status()
    events = r.json()
    if not events:
        return {}

    team_implied_prices: dict[str, list[float]] = {}
    for event in events:
        for bookmaker in event.get("bookmakers", []):
            for market in bookmaker.get("markets", []):
                if market["key"] != "outrights":
                    continue
                for outcome in market["outcomes"]:
                    team_implied_prices.setdefault(outcome["name"], []).append(1.0 / outcome["price"])

    return devig(team_implied_prices)


def devig(team_implied_prices: dict[str, list[float]]) -> dict[str, float]:
    """Average each team's implied probability (1/decimal price) across
    bookmakers, then normalize to sum to 1 -- raw bookmaker odds always
    overround (sum to > 1) because of the house edge."""
    avg_implied = {team: sum(p) / len(p) for team, p in team_implied_prices.items()}
    total = sum(avg_implied.values())
    return {team: p / total for team, p in avg_implied.items()}


def fetch_snapshot() -> dict:
    """One timestamped pull of both markets -- the unit the daily ingestion
    job will append to the live predictions log."""
    return {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "match_odds": fetch_match_odds(),
        "outright_win_probabilities": fetch_outright_probabilities(),
    }

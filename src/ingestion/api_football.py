"""API-Football client for World Cup 2026 fixtures and live scores, via a
direct api-football.com account (api-sports.io host) rather than RapidAPI
-- see DECISIONS.md: the RapidAPI key hit a "not subscribed" wall, and a
direct signup avoids that friction with a genuinely free tier (100
requests/day, no card).

UNVERIFIED as of 2026-07-02: no real key has been tested against this host
yet, so the `x-apisports-key` header name and WORLD_CUP_LEAGUE_ID (API-
Football's commonly documented static ID for the FIFA World Cup) both need
confirming against a live response once a key is available.
"""

import os

import requests

BASE_URL = "https://v3.football.api-sports.io"
WORLD_CUP_LEAGUE_ID = 1
SEASON = 2026


def _headers() -> dict:
    key = os.environ.get("API_FOOTBALL_KEY")
    if not key:
        raise RuntimeError("API_FOOTBALL_KEY not set -- see .env.example")
    return {"x-apisports-key": key}


def fetch_fixtures(league_id: int = WORLD_CUP_LEAGUE_ID, season: int = SEASON) -> list[dict]:
    r = requests.get(
        f"{BASE_URL}/fixtures",
        headers=_headers(),
        params={"league": league_id, "season": season},
        timeout=20,
    )
    r.raise_for_status()
    return r.json().get("response", [])


def fetch_live_scores() -> list[dict]:
    r = requests.get(
        f"{BASE_URL}/fixtures", headers=_headers(), params={"live": "all"}, timeout=20
    )
    r.raise_for_status()
    return r.json().get("response", [])

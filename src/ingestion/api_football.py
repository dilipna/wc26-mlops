"""API-Football (RapidAPI) client for World Cup 2026 fixtures and live
scores.

BLOCKED as of 2026-07-02 (see DECISIONS.md): the configured RapidAPI key
returns 403 "You are not subscribed to this API" -- the free Basic plan
needs to be activated on the API-FOOTBALL listing in the RapidAPI
dashboard before any of this can be verified against a live response.
WORLD_CUP_LEAGUE_ID is API-Football's well-documented static ID for the
FIFA World Cup; double check it against the docs once subscribed, since
it hasn't been possible to confirm against a real response yet.
"""

import os

import requests

BASE_URL = "https://api-football-v1.p.rapidapi.com/v3"
WORLD_CUP_LEAGUE_ID = 1
SEASON = 2026


def _headers() -> dict:
    key = os.environ.get("API_FOOTBALL_KEY")
    if not key:
        raise RuntimeError("API_FOOTBALL_KEY not set -- see .env.example")
    return {"x-rapidapi-host": "api-football-v1.p.rapidapi.com", "x-rapidapi-key": key}


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

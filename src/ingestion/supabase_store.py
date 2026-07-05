"""Durable mirror of the CSV/JSON logs in Supabase (Postgres) -- see
supabase/schema.sql for the tables and DECISIONS.md for why. The CSV/JSON
files remain the source of truth (kept as fallback, per CLAUDE.md); every
function here is best-effort so a missing/misconfigured/unreachable
Supabase project never blocks the daily pipeline -- same fast-fail
philosophy as src/models/layer1_ensemble/tracking.py's MLflow preflight.

Configure via .env: SUPABASE_URL, SUPABASE_KEY (the project's
service_role key -- this only ever runs server-side, never in a browser).
"""

import os
from functools import lru_cache

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")


@lru_cache(maxsize=1)
def _client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase import create_client

        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as exc:
        print(f"[supabase_store] client init failed, disabling: {exc}")
        return None


def is_reachable() -> bool:
    """Cheap real check for the admin dashboard's System Health section: can
    a client be constructed AND does a trivial query succeed. Best-effort,
    like everything else in this module -- returns False, never raises, if
    Supabase is unconfigured/unreachable."""
    client = _client()
    if client is None:
        return False
    try:
        client.table("match_results").select("match_date").limit(1).execute()
        return True
    except Exception as exc:
        print(f"[supabase_store] reachability check failed (non-fatal): {exc}")
        return False


def _insert(table: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    client = _client()
    if client is None:
        return 0
    try:
        client.table(table).insert(rows).execute()
        return len(rows)
    except Exception as exc:
        print(f"[supabase_store] insert into {table} failed (non-fatal): {exc}")
        return 0


def _upsert(table: str, rows: list[dict], on_conflict: str) -> int:
    if not rows:
        return 0
    client = _client()
    if client is None:
        return 0
    try:
        client.table(table).upsert(rows, on_conflict=on_conflict).execute()
        return len(rows)
    except Exception as exc:
        print(f"[supabase_store] upsert into {table} failed (non-fatal): {exc}")
        return 0


def upsert_match_results(rows: list[dict]) -> int:
    """rows: dicts with date, home_team, away_team, home_score, away_score
    (the same shape appended to data/live/results_log.csv)."""
    payload = [
        {
            "match_date": r["date"],
            "home_team": r["home_team"],
            "away_team": r["away_team"],
            "home_score": int(r["home_score"]),
            "away_score": int(r["away_score"]),
        }
        for r in rows
    ]
    return _upsert("match_results", payload, "match_date,home_team,away_team")


def insert_match_predictions(rows: list[dict]) -> int:
    """rows: the same list written to data/live/match_predictions_<ts>.json
    -- {commence_time, home_team, away_team, model: {...}, bookmaker: {...}}.
    bookmaker is keyed by team name (+ "Draw"), so it's flattened here by
    resolving home/away team names against it."""
    payload = []
    for r in rows:
        bookmaker = r.get("bookmaker") or {}
        payload.append(
            {
                "commence_time": r["commence_time"],
                "home_team": r["home_team"],
                "away_team": r["away_team"],
                "model_home_win": r["model"]["home_win"],
                "model_draw": r["model"]["draw"],
                "model_away_win": r["model"]["away_win"],
                "bookmaker_home_win": bookmaker.get(r["home_team"]),
                "bookmaker_draw": bookmaker.get("Draw"),
                "bookmaker_away_win": bookmaker.get(r["away_team"]),
            }
        )
    return _insert("match_predictions", payload)


def fetch_match_predictions() -> list[dict]:
    """All rows ever logged to match_predictions (append-only -- see
    schema.sql), oldest first. Used by scripts/verify_predictions.py to
    find each fixture's last pre-kickoff snapshot. Empty list (not an
    error) if Supabase isn't configured/reachable."""
    client = _client()
    if client is None:
        return []
    try:
        resp = client.table("match_predictions").select("*").order("logged_at").execute()
        return resp.data
    except Exception as exc:
        print(f"[supabase_store] fetch match_predictions failed (non-fatal): {exc}")
        return []


def upsert_tournament_predictions(prediction_date, team_probs: dict[str, float], model_version: str) -> int:
    """team_probs: {team: win_probability}, the same data appended to
    data/predictions/predictions_log.csv for this run."""
    payload = [
        {
            "prediction_date": prediction_date.isoformat(),
            "team": team,
            "win_probability": prob,
            "model_version": model_version,
        }
        for team, prob in team_probs.items()
    ]
    return _upsert("tournament_predictions", payload, "prediction_date,team,model_version")

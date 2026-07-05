"""Persistent, append-only log of completed 2026 World Cup match results,
built from The Odds API's `/scores` snapshots (rolling 3-day window --
see odds_api.fetch_scores). Feeds src.features.team_timeline alongside
the historical CSV so live Elo/form reflect real 2026 results as they
happen.
"""

import csv
from datetime import datetime
from pathlib import Path

from src.features.data_loading import Match, load_results
from src.ingestion import supabase_store
from src.ingestion.team_names import canonical

LOG_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "live" / "results_log.csv"
FIELDNAMES = ["date", "home_team", "away_team", "home_score", "away_score"]


def _existing_keys() -> set[tuple]:
    if not LOG_PATH.exists():
        return set()
    with open(LOG_PATH, encoding="utf-8") as f:
        return {(row["date"], row["home_team"], row["away_team"]) for row in csv.DictReader(f)}


def append_new_results(score_events: list[dict]) -> int:
    """Appends any newly-completed matches from a /scores response that
    aren't already logged. Returns how many rows were added."""
    existing = _existing_keys()
    new_rows = []
    for event in score_events:
        if not event.get("completed") or not event.get("scores"):
            continue
        match_date = event["commence_time"][:10]
        scores = {canonical(s["name"]): s["score"] for s in event["scores"]}
        home, away = canonical(event["home_team"]), canonical(event["away_team"])
        key = (match_date, home, away)
        if key in existing:
            continue
        if home not in scores or away not in scores:
            continue
        new_rows.append(
            {
                "date": match_date,
                "home_team": home,
                "away_team": away,
                "home_score": scores[home],
                "away_score": scores[away],
            }
        )
        existing.add(key)

    if not new_rows:
        return 0

    write_header = not LOG_PATH.exists()
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if write_header:
            writer.writeheader()
        writer.writerows(new_rows)

    supabase_store.upsert_match_results(new_rows)
    return len(new_rows)


def load_live_matches(tournament_name: str = "FIFA World Cup") -> list[Match]:
    """All logged 2026 results as Match objects, sorted chronologically.
    `neutral=True` for all of them (a simplification -- see DECISIONS.md's
    knockout draw / neutral-venue notes; only matters for the co-host
    nations' own group matches, a minor edge case for Phase 1)."""
    if not LOG_PATH.exists():
        return []
    matches = []
    with open(LOG_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            matches.append(
                Match(
                    date=datetime.strptime(row["date"], "%Y-%m-%d").date(),
                    home_team=row["home_team"],
                    away_team=row["away_team"],
                    home_score=int(row["home_score"]),
                    away_score=int(row["away_score"]),
                    tournament=tournament_name,
                    neutral=True,
                )
            )
    matches.sort(key=lambda m: m.date)
    return matches


def load_combined_matches() -> list[Match]:
    """Historical CSV + live-ingested 2026 results, deduplicated and
    chronologically sorted.

    `data/historical/results.csv` is refreshed periodically from its
    upstream source and can end up containing the same real 2026 fixtures
    this module separately logs from the Odds API -- without dedup, every
    such match's Elo delta and training row gets counted twice. On a
    collision the historical row wins (it carries a real neutral/venue
    flag; this module always hardcodes `neutral=True`, see
    `load_live_matches`)."""
    seen = set()
    combined = []
    for m in sorted(load_results() + load_live_matches(), key=lambda m: m.date):
        key = (m.date, m.home_team, m.away_team)
        if key in seen:
            continue
        seen.add(key)
        combined.append(m)
    return combined

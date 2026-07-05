"""Load the Phase 0 historical CSVs (see scripts/fetch_historical_data.py)
into plain Python structures, sorted chronologically."""

import csv
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "historical"


def _parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


@dataclass
class Match:
    date: date
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    tournament: str
    neutral: bool


def load_results(path: Path = DATA_DIR / "results.csv") -> list[Match]:
    matches = []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # A handful of matches (abandoned/unplayed) have no recorded
            # score -- not usable for Elo/form updates or as labeled
            # training examples, so skip them.
            if row["home_score"] == "NA" or row["away_score"] == "NA":
                continue
            matches.append(
                Match(
                    date=_parse_date(row["date"]),
                    home_team=row["home_team"],
                    away_team=row["away_team"],
                    home_score=int(row["home_score"]),
                    away_score=int(row["away_score"]),
                    tournament=row["tournament"],
                    neutral=row["neutral"].strip().upper() == "TRUE",
                )
            )
    matches.sort(key=lambda m: m.date)
    return matches


def load_shootouts(path: Path = DATA_DIR / "shootouts.csv") -> dict:
    """(date, home_team, away_team) -> winner, for matches decided on penalties."""
    shootouts = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = (_parse_date(row["date"]), row["home_team"], row["away_team"])
            shootouts[key] = row["winner"]
    return shootouts


def load_fifa_rankings(path: Path = DATA_DIR / "fifa_ranking.csv") -> dict[str, list]:
    """team -> sorted list of (rank_date, total_points) snapshots."""
    by_team: dict[str, list] = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            points = row["total_points"]
            if points in ("", "NA"):
                continue
            by_team.setdefault(row["team"], []).append(
                (_parse_date(row["date"]), float(points))
            )
    for snapshots in by_team.values():
        snapshots.sort(key=lambda s: s[0])
    return by_team


def world_cup_matches(
    matches: list[Match], year: int, tournament_name: str = "FIFA World Cup"
) -> list[Match]:
    return [
        m
        for m in matches
        if m.tournament == tournament_name and m.date.year == year
    ]

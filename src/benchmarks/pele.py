"""Nate Silver's PELE (Silver Bulletin, "Predictive Elo with Lineup
Equilibria") as an external benchmark for Layer 1.

Source: Silver Bulletin publishes PELE's per-match forecasts and team
ratings as Datawrapper charts. Datawrapper keeps every published version
of a chart immutable at `datawrapper.dwcdn.net/<chart>/<version>/dataset.csv`
and serves each with a `Last-Modified` header -- so the full revision
history of PELE's forecasts is recoverable, with a publish timestamp per
revision. That timestamp is what lets us compare PELE's *pre-kickoff*
numbers against ours, rather than numbers it may have revised after the
fact (see DECISIONS.md 2026-09-14).

This module is pure parsing/selection; network I/O lives in
scripts/fetch_pele_forecasts.py and results land, normalized, in
data/external/pele/ so the benchmark re-runs offline.
"""

import csv
import io
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from src.ingestion.team_names import FIFA_CODES

MATCH_CHART = "3bTOr"    # "Upcoming match forecasts" table
RATINGS_CHART = "pS7DN"  # World Cup team ratings table (base, roster adj, current)
DATASET_URL = "https://datawrapper.dwcdn.net/{chart}/{version}/dataset.csv"

_MONTHS = {"may": 5, "june": 6, "july": 7, "aug": 8, "sept": 9, "oct": 10, "nov": 11}
_TRIGRAM = re.compile(r"\b([A-Z]{3})\b")

STAGES = {
    "Group Stage": "group",
    "Round of 32": "R32",
    "Round of 16": "R16",
    "Quarter-finals": "QF",
    "Semi-finals": "SF",
    "Final": "F",
}


@dataclass(frozen=True)
class PeleForecast:
    version: int
    published_at: datetime  # Datawrapper Last-Modified of this version (UTC)
    local_date: date        # the date label PELE shows (US Eastern)
    stage: str
    team_a: str
    team_b: str
    fmt: str                # "three_way" (90-min W/D/L) or "advance" (who goes through)
    p_a: float
    p_draw: float | None
    p_b: float
    xg_a: float
    xg_b: float


def read_rows(text: str) -> list[dict]:
    """Early chart versions are tab-separated, later ones comma-separated."""
    text = text.lstrip("﻿")
    delimiter = "\t" if "\t" in text.split("\n", 1)[0] else ","
    return list(csv.DictReader(io.StringIO(text), delimiter=delimiter))


def team_from_cell(cell: str) -> str | None:
    """':mx: MEX 🏡' -> 'Mexico' (canonical results.csv name)."""
    for code in _TRIGRAM.findall(cell):
        if code in FIFA_CODES:
            return FIFA_CODES[code]
    return None


def stage_from_notes(notes: str) -> str | None:
    if "World Cup" not in notes:
        return None
    for label, stage in STAGES.items():
        if label in notes:
            return stage
    return None


def date_from_label(label: str, year: int = 2026) -> date:
    """'June 11 🏆@@24268' / 'Sept. 3@@24400' -> date."""
    month_word, day = label.split("@@")[0].replace("🏆", "").split()[:2]
    return date(year, _MONTHS[month_word.rstrip(".").lower()], int(day))


def parse_match_rows(rows: list[dict], version: int, published_at: datetime) -> list[PeleForecast]:
    """World Cup rows only; other competitions in the same table are dropped."""
    out = []
    for row in rows:
        stage = stage_from_notes(row.get("notes", ""))
        if stage is None:
            continue
        team_a, team_b = team_from_cell(row["fifa_code"]), team_from_cell(row["fifa_code_opp"])
        if team_a is None or team_b is None:
            # Fail loudly: a silently dropped World Cup match would bias the
            # benchmark toward whichever matches happen to parse.
            raise ValueError(f"Unmapped team code in PELE row: {row['fifa_code']!r} vs {row['fifa_code_opp']!r}")
        draw_cell = (row.get("prob_draw") or "").strip()
        out.append(
            PeleForecast(
                version=version,
                published_at=published_at,
                local_date=date_from_label(row["date"]),
                stage=stage,
                team_a=team_a,
                team_b=team_b,
                fmt="three_way" if draw_cell else "advance",
                p_a=float(row["prob_win"]) / 100.0,
                p_draw=float(draw_cell) / 100.0 if draw_cell else None,
                p_b=float(row["prob_loss"]) / 100.0,
                xg_a=float(row["proj_gf"]),
                xg_b=float(row["proj_gf_opp"]),
            )
        )
    return out


def conservative_deadline(local_date: date) -> datetime:
    """When the exact kickoff isn't known: 15:00 UTC on the match's
    venue-local date. Every 2026 World Cup kickoff was at or after 16:00 UTC
    on its local date, so a version published before this is unambiguously
    pre-kickoff.

    Callers must pass the EARLIER of PELE's label and the venue-local result
    date: PELE labels by US Eastern date, so a 21:00 Pacific kickoff (04:00
    UTC) carries the NEXT day's label -- anchoring on the label alone let a
    version published ~10h after Australia-Turkey through (caught in audit,
    2026-09-14)."""
    return datetime(local_date.year, local_date.month, local_date.day, 15, tzinfo=timezone.utc)


def latest_pre_kickoff(
    forecasts: list[PeleForecast],
    team_a: str,
    team_b: str,
    around: date,
    deadline: datetime | None,
    fmt: str = "three_way",
) -> PeleForecast | None:
    """PELE's last published forecast of this fixture before kickoff.

    Matched by unordered team pair within +/-1 day of `around` (PELE labels
    by US Eastern date; our logs use venue-local or UTC dates). Returned
    orientation is PELE's own -- use `oriented()` to align to ours."""
    pair = {team_a, team_b}
    candidates = [
        f for f in forecasts
        if f.fmt == fmt
        and {f.team_a, f.team_b} == pair
        and abs((f.local_date - around).days) <= 1
    ]
    if not candidates:
        return None
    cutoff = deadline or conservative_deadline(min(min(f.local_date for f in candidates), around))
    before = [f for f in candidates if f.published_at < cutoff]
    return max(before, key=lambda f: f.version) if before else None


def oriented(f: PeleForecast, home: str) -> tuple[float, float, float]:
    """(p_home_win, p_draw, p_away_win) with `home` as the first team.
    Advance-format forecasts return p_draw = 0 and advance probabilities."""
    draw = f.p_draw or 0.0
    if f.team_a == home:
        return f.p_a, draw, f.p_b
    return f.p_b, draw, f.p_a


def parse_http_date(value: str) -> datetime:
    return datetime.strptime(value, "%a, %d %b %Y %H:%M:%S GMT").replace(tzinfo=timezone.utc)


def within_tournament(d: date) -> bool:
    return date(2026, 6, 11) - timedelta(days=1) <= d <= date(2026, 7, 19) + timedelta(days=1)

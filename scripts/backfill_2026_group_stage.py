"""One-time backfill of 2026 World Cup results that predate the live
Odds API ingestion window (the /scores endpoint only reaches back 3 days,
and daily polling started 2026-07-02): all 72 group-stage matches plus
the June 28 Round-of-32 opener, parsed from the raw wikitext of the
twelve Wikipedia group pages. Without these, Elo/form timelines jump
straight from ~2024 into the knockout rounds and miss the entire 2026
tournament so far -- see DECISIONS.md 2026-07-04.

Appends to data/live/results_log.csv (dedup by date+teams, same rule as
live ingestion), then full-syncs the whole log to Supabase.

Run: python scripts/backfill_2026_group_stage.py
"""

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import requests  # noqa: E402

from src.ingestion import live_results_store, supabase_store  # noqa: E402

GROUPS = "ABCDEFGHIJKL"
RAW_URL = "https://en.wikipedia.org/w/index.php?title=2026_FIFA_World_Cup_Group_{g}&action=raw"

# FIFA trigram -> name as used in data/historical/results.csv (the naming
# authority, see src/ingestion/team_names.py). Every code the parser meets
# must be here AND the name must exist in the historical dataset -- the
# script fails loudly on unknowns rather than silently dropping matches.
FIFA_CODES = {
    "ALG": "Algeria", "ARG": "Argentina", "AUS": "Australia", "AUT": "Austria",
    "BEL": "Belgium", "BIH": "Bosnia and Herzegovina", "BOL": "Bolivia", "BRA": "Brazil",
    "CAN": "Canada", "CHI": "Chile", "CIV": "Ivory Coast", "CMR": "Cameroon",
    "COD": "DR Congo", "COL": "Colombia", "CPV": "Cape Verde", "CRC": "Costa Rica",
    "CRO": "Croatia", "CUW": "Curaçao", "CZE": "Czech Republic", "DEN": "Denmark",
    "ECU": "Ecuador", "EGY": "Egypt", "ENG": "England", "ESP": "Spain",
    "FRA": "France", "GER": "Germany", "GHA": "Ghana", "GRE": "Greece",
    "HAI": "Haiti", "HON": "Honduras", "HUN": "Hungary", "IRN": "Iran",
    "IRQ": "Iraq", "ITA": "Italy", "JAM": "Jamaica", "JOR": "Jordan",
    "JPN": "Japan", "KOR": "South Korea", "KSA": "Saudi Arabia", "MAR": "Morocco",
    "MEX": "Mexico", "NED": "Netherlands", "NGA": "Nigeria", "NOR": "Norway",
    "NZL": "New Zealand", "PAN": "Panama", "PAR": "Paraguay", "PER": "Peru",
    "POL": "Poland", "POR": "Portugal", "QAT": "Qatar", "ROU": "Romania",
    "RSA": "South Africa", "SCO": "Scotland", "SEN": "Senegal", "SRB": "Serbia",
    "SUI": "Switzerland", "SVK": "Slovakia", "SVN": "Slovenia", "SWE": "Sweden",
    "TUN": "Tunisia", "TUR": "Turkey", "UKR": "Ukraine", "URU": "Uruguay", "USA": "United States",
    "UZB": "Uzbekistan", "VEN": "Venezuela", "WAL": "Wales",
}

# One knockout match also predates the polling window (Odds API /scores
# 3-day cap): Round-of-32 Match 73, June 28, Inglewood.
EXTRA_MATCHES = [
    {"date": "2026-06-28", "home_team": "South Africa", "away_team": "Canada",
     "home_score": "0", "away_score": "1"},
]

BOX_RE = re.compile(
    r"\{\{Start date\|(\d{4})\|(\d{1,2})\|(\d{1,2})\}\}"  # |date=
    r".*?\|team1=\{\{#invoke:flag\|fb-rt\|([A-Z]{3})\}\}"
    r".*?\|score=(.*?)\n"
    r".*?\|team2=\{\{#invoke:flag\|fb\|([A-Z]{3})\}\}",
    re.DOTALL,
)
SCORE_RE = re.compile(r"(\d+)\s*–\s*(\d+)")  # en-dash, as Wikipedia uses


def parse_group(wikitext: str, group: str) -> list[dict]:
    matches = []
    for m in BOX_RE.finditer(wikitext):
        year, month, day, code1, score_field, code2 = m.groups()
        score = SCORE_RE.search(score_field)
        if not score:
            raise ValueError(f"Group {group}: unparsable score field {score_field!r} "
                             f"for {code1} vs {code2} -- match not finished?")
        for code in (code1, code2):
            if code not in FIFA_CODES:
                raise ValueError(f"Group {group}: unknown FIFA code {code!r} -- add it to FIFA_CODES")
        matches.append({
            "date": f"{year}-{int(month):02d}-{int(day):02d}",
            "home_team": FIFA_CODES[code1],
            "away_team": FIFA_CODES[code2],
            "home_score": score.group(1),
            "away_score": score.group(2),
        })
    if len(matches) != 6:
        raise ValueError(f"Group {group}: expected 6 matches, parsed {len(matches)}")
    return matches


def historical_team_names() -> set[str]:
    path = Path(__file__).resolve().parent.parent / "data" / "historical" / "results.csv"
    teams = set()
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            teams.add(row["home_team"])
            teams.add(row["away_team"])
    return teams


def main():
    known_teams = historical_team_names()
    all_rows = []
    headers = {"User-Agent": "wc26-mlops-backfill/1.0 (portfolio project; one-time fetch)"}
    for g in GROUPS:
        r = requests.get(RAW_URL.format(g=g), timeout=30, headers=headers)
        r.raise_for_status()
        rows = parse_group(r.text, g)
        all_rows.extend(rows)
        print(f"Group {g}: {len(rows)} matches")
    all_rows.extend(EXTRA_MATCHES)

    unseen = {t for row in all_rows for t in (row["home_team"], row["away_team"])} - known_teams
    if unseen:
        raise ValueError(f"Names not in historical dataset (fix FIFA_CODES): {unseen}")

    existing = {
        (r["date"], r["home_team"], r["away_team"])
        for r in csv.DictReader(open(live_results_store.LOG_PATH, encoding="utf-8"))
    }
    new_rows = [r for r in all_rows
                if (r["date"], r["home_team"], r["away_team"]) not in existing]

    with open(live_results_store.LOG_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=live_results_store.FIELDNAMES)
        writer.writerows(new_rows)
    print(f"Appended {len(new_rows)} backfilled match(es) to {live_results_store.LOG_PATH} "
          f"({len(all_rows) - len(new_rows)} already present)")

    full_log = list(csv.DictReader(open(live_results_store.LOG_PATH, encoding="utf-8")))
    synced = supabase_store.upsert_match_results(full_log)
    print(f"Supabase full sync: {synced} row(s) upserted to match_results")


if __name__ == "__main__":
    main()

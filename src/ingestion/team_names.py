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

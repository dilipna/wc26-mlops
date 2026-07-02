"""Phase 0: pull historical international match results, FIFA rankings, and
penalty-shootout winners from open, no-auth-required GitHub mirrors.

Sources (see DECISIONS.md for why these over Kaggle's authenticated API):
- martj42/international_results: full international match history + shootout winners
- Dato-Futbol/fifa-ranking: FIFA World Ranking snapshots, 1992-2024

Run: python scripts/fetch_historical_data.py
"""

import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "historical"

SOURCES = {
    "results.csv": (
        "https://raw.githubusercontent.com/martj42/international_results/"
        "master/results.csv"
    ),
    "shootouts.csv": (
        "https://raw.githubusercontent.com/martj42/international_results/"
        "master/shootouts.csv"
    ),
    "fifa_ranking.csv": (
        "https://raw.githubusercontent.com/Dato-Futbol/fifa-ranking/"
        "master/ranking_fifa_historical.csv"
    ),
}


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for filename, url in SOURCES.items():
        dest = DATA_DIR / filename
        print(f"Fetching {url} -> {dest}")
        urllib.request.urlretrieve(url, dest)
        print(f"  {dest.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()

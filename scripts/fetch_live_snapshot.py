"""One timestamped pull of live World Cup 2026 data: bookmaker odds (Odds
API, working) and fixtures (API-Football, blocked pending RapidAPI
subscription -- see DECISIONS.md). Saved to data/live/ as the raw
ingestion layer the daily Airflow job will eventually wrap.

Run: python scripts/fetch_live_snapshot.py
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from src.ingestion import api_football, odds_api  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "live"


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    print("Odds API quota:", odds_api.get_quota_status())
    odds_snapshot = odds_api.fetch_snapshot()
    odds_path = OUT_DIR / f"odds_{timestamp}.json"
    odds_path.write_text(json.dumps(odds_snapshot, indent=2))
    print(
        f"Wrote {odds_path} "
        f"({len(odds_snapshot['match_odds'])} matches, "
        f"{len(odds_snapshot['outright_win_probabilities'])} teams in outright market)"
    )

    try:
        fixtures = api_football.fetch_fixtures()
        fixtures_path = OUT_DIR / f"fixtures_{timestamp}.json"
        fixtures_path.write_text(json.dumps(fixtures, indent=2))
        print(f"Wrote {fixtures_path} ({len(fixtures)} fixtures)")
    except Exception as e:
        print(f"API-Football fetch failed (expected until the RapidAPI subscription is active): {e}")


if __name__ == "__main__":
    main()

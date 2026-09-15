"""Download the full revision history of Silver Bulletin's PELE World Cup
charts from Datawrapper and store it normalized under data/external/pele/,
so scripts/compare_vs_pele.py runs offline and reproducibly.

Writes:
  data/external/pele/match_forecasts.csv  every World Cup match row in every
                                          published version, with that
                                          version's publish timestamp
  data/external/pele/ratings.csv          every version of the team ratings
  data/external/pele/manifest.json        source URLs, version counts, fetch time

Run: python scripts/fetch_pele_forecasts.py
"""

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import requests  # noqa: E402

from src.benchmarks import pele  # noqa: E402
from src.ingestion.team_names import FIFA_CODES  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "external" / "pele"
MAX_CONSECUTIVE_MISSES = 5  # version numbers can skip; stop after a clear gap


def fetch_versions(chart: str):
    """Yield (version, published_at, csv_text) for every published version."""
    session = requests.Session()
    version, misses = 1, 0
    while misses < MAX_CONSECUTIVE_MISSES:
        url = pele.DATASET_URL.format(chart=chart, version=version)
        resp = session.get(url, timeout=30)
        if resp.status_code == 200:
            misses = 0
            resp.encoding = "utf-8"
            yield version, pele.parse_http_date(resp.headers["Last-Modified"]), resp.text
        else:
            misses += 1
        version += 1


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    match_rows, n_match_versions = [], 0
    for version, published_at, text in fetch_versions(pele.MATCH_CHART):
        n_match_versions += 1
        for f in pele.parse_match_rows(pele.read_rows(text), version, published_at):
            match_rows.append(
                {
                    "version": f.version,
                    "published_at": f.published_at.isoformat(),
                    "local_date": f.local_date.isoformat(),
                    "stage": f.stage,
                    "team_a": f.team_a,
                    "team_b": f.team_b,
                    "format": f.fmt,
                    "p_a": f.p_a,
                    "p_draw": "" if f.p_draw is None else f.p_draw,
                    "p_b": f.p_b,
                    "xg_a": f.xg_a,
                    "xg_b": f.xg_b,
                }
            )
    with open(OUT_DIR / "match_forecasts.csv", "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(match_rows[0]))
        writer.writeheader()
        writer.writerows(match_rows)

    rating_rows, n_rating_versions = [], 0
    for version, published_at, text in fetch_versions(pele.RATINGS_CHART):
        n_rating_versions += 1
        for row in pele.read_rows(text):
            code = row["fifa_code"].strip()
            if code not in FIFA_CODES:
                continue
            rating_rows.append(
                {
                    "version": version,
                    "published_at": published_at.isoformat(),
                    "team": FIFA_CODES[code],
                    "pele_base": row.get("pele_base", ""),
                    "roster_adj": (row.get("roster_adj") or "").replace("⛑️", "").strip(),
                    "performance_adj": (row.get("performance_adj") or "").strip(),
                    "current_pele": row.get("current_pele", ""),
                }
            )
    with open(OUT_DIR / "ratings.csv", "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rating_rows[0]))
        writer.writeheader()
        writer.writerows(rating_rows)

    manifest = {
        "source": "Silver Bulletin (natesilver.net) PELE charts, via Datawrapper's public version CDN",
        "methodology": "https://www.natesilver.net/p/pele-methodology",
        "charts": {
            pele.MATCH_CHART: {"versions": n_match_versions, "world_cup_rows": len(match_rows)},
            pele.RATINGS_CHART: {"versions": n_rating_versions, "rows": len(rating_rows)},
        },
        "url_pattern": pele.DATASET_URL,
        "timestamp_source": "HTTP Last-Modified of each immutable version",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()

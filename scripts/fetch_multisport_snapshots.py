from pathlib import Path
import csv
import io
import json
import hashlib
import urllib.request
import zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/multisport"
RAW = ROOT / "validation/sources"
OUT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)
SOURCES = {
    "basketball": {
        "url": "https://raw.githubusercontent.com/fivethirtyeight/data/6d880e939ad3d11d94c137c911681b3cf718fd74/nba-elo/nbaallelo.csv",
        "license": "CC-BY-4.0",
        "license_url": "https://github.com/fivethirtyeight/data/blob/master/LICENSE",
        "credit": "FiveThirtyEight, Historical NBA Elo; game information from Basketball-Reference.com",
        "start": "2010-07-01",
        "end": "2015-07-01",
    },
    "nfl": {
        "url": "https://raw.githubusercontent.com/fivethirtyeight/nfl-elo-game/fbec1afa38ece5befe24fb21be8ddba8eb160fe6/data/nfl_games.csv",
        "license": "MIT (source repository)",
        "license_url": "https://github.com/fivethirtyeight/nfl-elo-game/blob/fbec1afa38ece5befe24fb21be8ddba8eb160fe6/LICENSE",
        "credit": "FiveThirtyEight, nfl-elo-game",
        "start": "2010-01-01",
        "end": "2016-01-01",
    },
    "cricket": {
        "url": "https://cricsheet.org/downloads/ipl_male_json.zip",
        "license": "ODC-By-1.0",
        "license_url": "https://cricsheet.org/licensing/",
        "credit": "Cricsheet, Indian Premier League JSON match data",
        "start": "2008-01-01",
        "end": "2024-01-01",
    },
}


def fetch(url, limit=64 * 1024 * 1024):
    req = urllib.request.Request(
        url, headers={"User-Agent": "SpOps-portfolio-reproduction/1.0"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Source exceeds download bound")
        return data


def normalize(sport, raw):
    rows = []
    excluded = {}
    seen = set()

    def skip(reason):
        excluded[reason] = excluded.get(reason, 0) + 1

    def add(id, day, a, b, winner, neutral):
        if not SOURCES[sport]["start"] <= day < SOURCES[sport]["end"]:
            skip("outside_frozen_interval")
            return
        if winner not in (0, 1):
            skip("non_decisive_or_missing_result")
            return
        if id in seen:
            raise ValueError("Duplicate source match ID: " + id)
        seen.add(id)
        rows.append(
            {
                "match_id": id,
                "date": day,
                "side_a": a,
                "side_b": b,
                "side_a_won": winner,
                "neutral": int(neutral),
            }
        )

    if sport == "cricket":
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            infos = z.infolist()
            if (
                len(infos) > 10000
                or sum(x.file_size for x in infos) > 512 * 1024 * 1024
            ):
                raise ValueError("Archive bounds exceeded")
            notices = []
            for entry in infos:
                if (
                    "README" in entry.filename.upper()
                    or "LICENSE" in entry.filename.upper()
                ):
                    notices.append(z.read(entry).decode("utf-8", errors="replace"))
                if not entry.filename.endswith(".json"):
                    continue
                if entry.file_size > 5 * 1024 * 1024:
                    raise ValueError("Match JSON exceeds bound")
                record = json.loads(z.read(entry))
                info = record["info"]
                teams = info["teams"]
                day = min(info["dates"])
                winner = info.get("outcome", {}).get("winner")
                if len(teams) != 2:
                    raise ValueError("Expected exactly two sides")
                add(
                    "cricsheet-" + Path(entry.filename).stem,
                    day,
                    teams[0],
                    teams[1],
                    None if winner not in teams else int(winner == teams[0]),
                    True,
                )
            (OUT / "cricket-SOURCE-NOTICE.txt").write_text(
                "\n\n".join(notices), encoding="utf-8"
            )
    else:
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
        for record in reader:
            if sport == "basketball":
                if record["_iscopy"] != "0" or record["lg_id"] != "NBA":
                    skip("opposite_orientation_or_other_league")
                    continue
                day = (
                    datetime.strptime(record["date_game"], "%m/%d/%Y")
                    .date()
                    .isoformat()
                )
                a, b = record["team_id"], record["opp_id"]
                sa, sb = float(record["pts"]), float(record["opp_pts"])
                neutral = record["game_location"] == "N"
                if record["game_location"] == "A":
                    a, b = b, a
                    sa, sb = sb, sa
                id = record["game_id"]
            else:
                day = record["date"]
                a, b = record["team1"], record["team2"]
                neutral = record.get("neutral", "0") == "1"
                id = "nfl-" + day + "-" + a + "-" + b
                if not record.get("score1") or not record.get("score2"):
                    skip("missing_score")
                    continue
                sa, sb = float(record["score1"]), float(record["score2"])
            add(id, day, a, b, None if sa == sb else int(sa > sb), neutral)
    rows.sort(key=lambda r: (r["date"], r["match_id"]))
    return rows, excluded


def main():
    manifest = {
        "schema": 1,
        "acquired_at": datetime.now(timezone.utc).isoformat(),
        "transform": "Retain dated decisive match outcomes only. Remove source Elo/forecasts, player-level information and ball-by-ball records. Two outcomes conditional on a decisive winner.",
        "sources": {},
    }
    for sport, source in SOURCES.items():
        ext = ".zip" if sport == "cricket" else ".csv"
        dest = RAW / (sport + ext)
        raw = dest.read_bytes() if dest.exists() else fetch(source["url"])
        if not dest.exists():
            dest.write_bytes(raw)
        rows, excluded = normalize(sport, raw)
        if not rows:
            raise ValueError("Empty normalized sport: " + sport)
        target = OUT / (sport + ".csv")
        with target.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(
                f,
                fieldnames=[
                    "match_id",
                    "date",
                    "side_a",
                    "side_b",
                    "side_a_won",
                    "neutral",
                ],
                lineterminator="\n",
            )
            w.writeheader()
            w.writerows(rows)
        item = {
            **source,
            "raw_bytes": len(raw),
            "raw_sha256": hashlib.sha256(raw).hexdigest(),
            "normalized_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "matches": len(rows),
            "first_date": rows[0]["date"],
            "last_date": rows[-1]["date"],
            "excluded": excluded,
        }
        manifest["sources"][sport] = item
        print(
            json.dumps(
                {
                    "sport": sport,
                    "matches": len(rows),
                    "raw_bytes": len(raw),
                    "date_range": [item["first_date"], item["last_date"]],
                }
            ),
            flush=True,
        )
    # Preserve complete upstream repository license notices, not just labels.
    for sport, url in [
        (
            "basketball",
            "https://raw.githubusercontent.com/fivethirtyeight/data/6d880e939ad3d11d94c137c911681b3cf718fd74/LICENSE",
        ),
        (
            "nfl",
            "https://raw.githubusercontent.com/fivethirtyeight/nfl-elo-game/fbec1afa38ece5befe24fb21be8ddba8eb160fe6/LICENSE",
        ),
    ]:
        (OUT / (sport + "-LICENSE.txt")).write_bytes(fetch(url, 100000))
    (OUT / "sources.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()

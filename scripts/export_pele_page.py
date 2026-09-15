"""Build dashboard/data/pele_page.json -- everything the /pele page renders,
derived from committed benchmark outputs. Nothing here is estimated or
invented: every value is copied or deterministically derived from

  data/benchmarks/pele_comparison.json  (scripts/compare_vs_pele.py)
  data/external/pele/match_forecasts.csv (scripts/fetch_pele_forecasts.py)
  data/external/pele/ratings.csv
  data/historical/results.csv + data/live/results_log.csv (our Elo)

Kept separate from scripts/export_dashboard_data.py on purpose: the /pele
page is an addition, and the existing export (and the pages it feeds) is
left exactly as it was.

Run: python scripts/export_pele_page.py
"""

import csv
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.benchmarks import pele  # noqa: E402
from src.features.team_timeline import build_timelines, snapshot_as_of  # noqa: E402
from src.ingestion import live_results_store  # noqa: E402

COMPARISON = ROOT / "data" / "benchmarks" / "pele_comparison.json"
PELE_DIR = ROOT / "data" / "external" / "pele"
OUT = ROOT / "dashboard" / "data" / "pele_page.json"

TOURNAMENT_START = date(2026, 6, 11)
FINAL_DATE = date(2026, 7, 19)
OPENING_KICKOFF = datetime(2026, 6, 11, 19, tzinfo=timezone.utc)
STAGE_ORDER = ["group", "R32", "R16", "QF", "SF", "F", "Champion"]


def r4(x: float) -> float:
    return round(float(x), 4)


def triple(t) -> list[float] | None:
    """Full precision on purpose: the page recomputes every score from these,
    and must reproduce the Python benchmark exactly (4-dp rounding shifted
    the power estimate by one match in the parity check)."""
    return [float(v) for v in t] if t else None


def label_only_deadline(label: date) -> datetime:
    """The ORIGINAL (buggy) rule, reproduced only to show which matches it
    affected: 15:00 UTC on PELE's US-Eastern date label."""
    return datetime(label.year, label.month, label.day, 15, tzinfo=timezone.utc)


def pele_history(forecast_rows, match: dict) -> dict:
    """Every three-way PELE version that listed this fixture, oriented to our
    home team, plus the deadline actually used and what the buggy rule
    would have picked."""
    pair = {match["home"], match["away"]}
    rows = [r for r in forecast_rows if r["format"] == "three_way" and r["stage"] == match["stage"]
            and {r["team_a"], r["team_b"]} == pair]
    labels = sorted({date.fromisoformat(r["local_date"]) for r in rows})
    local = date.fromisoformat(match["date"])
    # Same ±1 day window the comparison uses.
    rows = [r for r in rows if abs((date.fromisoformat(r["local_date"]) - local).days) <= 1]
    versions = []
    for r in sorted(rows, key=lambda r: int(r["version"])):
        home_first = r["team_a"] == match["home"]
        pa, pd, pb = float(r["p_a"]), float(r["p_draw"]), float(r["p_b"])
        ph, paw = (pa, pb) if home_first else (pb, pa)
        versions.append({"v": int(r["version"]), "t": r["published_at"], "p": [r4(ph), r4(pd), r4(paw)]})

    kickoff = match.get("live", {}).get("kickoff") if match.get("live") else None
    if kickoff:
        deadline = datetime.fromisoformat(kickoff)
        rule = "kickoff"
    else:
        deadline = pele.conservative_deadline(min(min(labels), local))
        rule = "local_date_15utc"
    old = label_only_deadline(min(labels))
    old_pick = max((v for v in versions if datetime.fromisoformat(v["t"]) < old), key=lambda v: v["v"], default=None)
    leak = bool(old_pick and not kickoff and datetime.fromisoformat(old_pick["t"]) >= deadline)
    return {
        "versions": versions,
        "deadline": deadline.isoformat(),
        "deadline_rule": rule,
        "label_date": min(labels).isoformat(),
        "selected_version": match["pele_version"],
        "label_rule_version": old_pick["v"] if old_pick else None,
        "label_rule_leak": leak,
    }


def finishes(forecast_rows, matches: list[dict]) -> dict[str, str]:
    """Furthest stage each team reached. Stages come from PELE's full fixture
    list (all 103 fixtures, including Canada-South Africa, which is excluded
    from scoring), so no team's run is cut short by a scoring exclusion."""
    reached: dict[str, str] = {}
    for r in forecast_rows:
        for t in (r["team_a"], r["team_b"]):
            if STAGE_ORDER.index(r["stage"]) > STAGE_ORDER.index(reached.get(t, "group")):
                reached[t] = r["stage"]
    final = next(m for m in matches if m["stage"] == "F")
    hs, as_ = (int(x) for x in final["score"].split("-"))
    reached[final["home"] if hs > as_ else final["away"]] = "Champion"
    return reached


def main():
    comp = json.loads(COMPARISON.read_text())
    with open(PELE_DIR / "match_forecasts.csv", encoding="utf-8") as fh:
        forecast_rows = list(csv.DictReader(fh))
    with open(PELE_DIR / "ratings.csv", encoding="utf-8") as fh:
        rating_rows = [r for r in csv.DictReader(fh) if r["current_pele"]]

    # --- matches (compact) + PELE version history per fixture
    matches = []
    for m in comp["matches"]:
        live = m.get("live")
        matches.append({
            "date": m["date"],
            "stage": m["stage"],
            "home": m["home"],
            "away": m["away"],
            "score": m["score"],
            "outcome": m["outcome"],
            "host": m["host_match"],
            "ours": triple(m["replay"]),
            "pele": triple(m["pele"]),
            "live": {
                "ours": triple(live["ours"]),
                "pele": triple(live["pele"]),
                "market": triple(live["market"]),
                "kickoff": live["kickoff"],
                "commit": live["ours_commit"],
                "committed_at": live["ours_committed_at"],
            } if live and live["pele"] and live["market"] else None,
            "history": pele_history(forecast_rows, m),
        })

    # --- ratings: PELE (last version before the opening kickoff) vs our Elo
    all_matches = live_results_store.load_combined_matches()
    timelines = build_timelines(all_matches)
    pre = [r for r in rating_rows if datetime.fromisoformat(r["published_at"]) < OPENING_KICKOFF]
    base_version = max(int(r["version"]) for r in pre)
    teams = sorted({r["team"] for r in pre if int(r["version"]) == base_version})
    reached = finishes(forecast_rows, matches)

    def elo_path(team: str) -> list[dict]:
        start = snapshot_as_of(timelines, team, TOURNAMENT_START).elo
        pts = [{"t": TOURNAMENT_START.isoformat(), "d": 0.0}]
        for s in timelines.get(team, []):
            if TOURNAMENT_START <= s.date <= FINAL_DATE:
                pts.append({"t": s.date.isoformat(), "d": round(s.elo - start, 1)})
        return pts

    def pele_path(team: str, start: float) -> list[dict]:
        pts, last = [], None
        cutoff = datetime.combine(FINAL_DATE + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        for r in sorted((r for r in rating_rows if r["team"] == team), key=lambda r: int(r["version"])):
            t = datetime.fromisoformat(r["published_at"])
            if int(r["version"]) < base_version or t > cutoff:
                continue
            v = round(float(r["current_pele"]) - start, 1)
            if v != last:
                pts.append({"t": r["published_at"][:10], "d": v})
                last = v
        return pts

    ratings = []
    for team in teams:
        row = next(r for r in pre if int(r["version"]) == base_version and r["team"] == team)
        pele_now = float(row["current_pele"])
        ratings.append({
            "team": team,
            "pele": pele_now,
            "pele_base": float(row["pele_base"]) if row["pele_base"] else None,
            "roster_adj": float(row["roster_adj"]) if row["roster_adj"] else None,
            "elo": round(snapshot_as_of(timelines, team, TOURNAMENT_START).elo, 1),
            "finish": reached.get(team, "group"),
            "elo_path": elo_path(team),
            "pele_path": pele_path(team, pele_now),
        })

    # Consistency guard: our Elo here must match what the comparison reported.
    reported = {d["team"]: d["our_elo"] for d in comp["ratings"]["largest_disagreements"]}
    for r in ratings:
        if r["team"] in reported and abs(r["elo"] - reported[r["team"]]) > 0.11:
            raise SystemExit(f"Elo mismatch for {r['team']}: {r['elo']} vs {reported[r['team']]}")

    rep = comp["replay"]
    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_generated_at": comp["generated_at"],
        "sources": comp["sources"],
        "protocol": comp["protocol"],
        "accounting": comp["accounting"],
        "fixtures_without_pre_kickoff_pele": comp["fixtures_without_pre_kickoff_pele"],
        "headline": {
            "live": {"n": comp["live"]["n"], "metrics": comp["live"]["metrics"],
                     "ours_vs_pele": comp["live"]["ours_vs_pele"],
                     "ours_vs_market": comp["live"]["ours_vs_market"],
                     "pele_vs_market": comp["live"]["pele_vs_market"],
                     "replay_fidelity_mean_abs_diff": comp["live"]["replay_fidelity_mean_abs_diff"]},
            "replay": {k: {"n": rep[k]["n"], "metrics": rep[k]["metrics"], "ours_vs_pele": rep[k]["ours_vs_pele"]}
                       for k in ("all", "group", "knockout")},
            "combo_vs_ours": rep["all"]["combo_vs_ours"],
            "combo_vs_pele": rep["all"]["combo_vs_pele"],
            "calibration": rep["calibration"],
            "diagnostics": rep["diagnostics"],
            "ablation_host_advantage": comp["ablation_host_advantage"],
        },
        "ratings_summary": {k: v for k, v in comp["ratings"].items() if k != "largest_disagreements"},
        "method_differences": comp["method_differences"],
        "leak_cases": sum(1 for m in matches if m["history"]["label_rule_leak"]),
        "matches": matches,
        "ratings": ratings,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB): {len(matches)} matches, "
          f"{len(ratings)} teams, label-rule leak cases = {out['leak_cases']}")


if __name__ == "__main__":
    main()

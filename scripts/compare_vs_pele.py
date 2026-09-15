"""Head-to-head: our Layer 1 stacked ensemble vs Nate Silver's PELE on the
2026 World Cup, match by match, using only pre-kickoff forecasts from both.

Two tracks, never mixed (DECISIONS.md 2026-09-14):

  live    Knockout matches where BOTH sides published before kickoff: our
          git-committed daily-pipeline snapshot vs PELE's Datawrapper
          version published before kickoff. Bookmakers (de-vigged, same
          snapshot as ours) as a third reference. Small n, zero hindsight.

  replay  All 103 matches PELE forecast (72 group + 31 knockout). Our side
          is Layer 1 re-run exactly as deployed, trained ONLY on matches
          before the tournament opened (2026-06-11) and fed Elo/form
          as-of the day before each match -- no result from that match or
          later is visible. PELE's side is still its real published
          pre-kickoff number. Larger n; our numbers are a faithful replay,
          not a live record, and are labeled that way everywhere.

Also: forecast combination (50/50 average of ours and PELE), calibration,
a ratings-level comparison (PELE rating vs our Elo at kickoff of the
tournament), and one PELE idea ablated on our model (host home advantage).

Prereq: python scripts/fetch_pele_forecasts.py (or the committed
data/external/pele/ snapshot).
Run:    python scripts/compare_vs_pele.py
Writes: data/benchmarks/pele_comparison.json
"""

import csv
import json
import random
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.benchmarks import pele  # noqa: E402
from src.benchmarks.scoring import (  # noqa: E402
    METRICS,
    normalize,
    outcome_index,
    paired_comparison,
    reliability,
    rps,
)
from src.features.data_loading import load_fifa_rankings  # noqa: E402
from src.features.team_timeline import build_timelines, snapshot_as_of  # noqa: E402
from src.ingestion import live_results_store  # noqa: E402
from src.ingestion.team_names import canonical  # noqa: E402
from src.models.layer1_ensemble.ensemble import Layer1Ensemble, load_tuned_xgb_params  # noqa: E402

PELE_DIR = ROOT / "data" / "external" / "pele"
OUT_PATH = ROOT / "data" / "benchmarks" / "pele_comparison.json"

TRAIN_START = date(1992, 1, 1)
TOURNAMENT_START = date(2026, 6, 11)
FINAL_DATE = date(2026, 7, 19)
HOSTS = {"Mexico", "United States", "Canada"}

# What PELE models that Layer 1 does not (from the published methodology,
# https://www.natesilver.net/p/pele-methodology). Kept as data so the
# dashboard and interview notes read from one source.
METHOD_DIFFERENCES = [
    {"aspect": "Rating core", "pele": "Zero-sum Elo over ~50k matches since 1872; harmonic goal margin (2nd goal worth 1/2, 3rd 1/3...)", "ours": "Zero-sum Elo since 1872 with an eloratings-style goal-difference multiplier; fed to a stacked ensemble alongside rolling form and FIFA points"},
    {"aspect": "Player information", "pele": "Transfermarkt squad values (top-23, position-weighted, ~30% UEFA-club discount), official WC rosters, injuries/suspensions", "ours": "None -- results-only features"},
    {"aspect": "Priors / mean reversion", "pele": "Slow reversion toward a prior built from log GDP (PPP), footballing legacy year and region", "ours": "None -- new teams start at 1500"},
    {"aspect": "Home advantage", "pele": "Era-, distance-, altitude- and team-specific; venue-level for co-hosts", "ours": "Learned 'neutral' flag; every World Cup match scored as neutral in production"},
    {"aspect": "Match model", "pele": "Negative-binomial score matrix with a correlation term + team 'tilt' (attacking/defensive style) -> W/D/L", "ours": "Direct 3-class probabilities from an XGBoost + Elo-logistic + FIFA-heuristic stack with a logistic meta-learner"},
    {"aspect": "Knockout resolution", "pele": "Extra time modeled (~40% of draws resolved) then skill-weighted penalties; knockout rating gap x1.1", "ours": "P(advance) = P(win) + 0.5 x P(draw)"},
    {"aspect": "Tournament simulation", "pele": "100,000 sims incl. group tiebreakers, cards (fair play), 'hot' in-sim rating updates", "ours": "10,000 sims of the actual remaining bracket from the knockout stage"},
]


# ---------------------------------------------------------------- inputs

def load_pele_forecasts() -> list[pele.PeleForecast]:
    with open(PELE_DIR / "match_forecasts.csv", encoding="utf-8") as fh:
        return [
            pele.PeleForecast(
                version=int(r["version"]),
                published_at=datetime.fromisoformat(r["published_at"]),
                local_date=date.fromisoformat(r["local_date"]),
                stage=r["stage"],
                team_a=r["team_a"],
                team_b=r["team_b"],
                fmt=r["format"],
                p_a=float(r["p_a"]),
                p_draw=float(r["p_draw"]) if r["p_draw"] else None,
                p_b=float(r["p_b"]),
                xg_a=float(r["xg_a"]),
                xg_b=float(r["xg_b"]),
            )
            for r in csv.DictReader(fh)
        ]


def world_cup_results(all_matches):
    return [
        m for m in all_matches
        if m.tournament == "FIFA World Cup" and TOURNAMENT_START <= m.date <= FINAL_DATE
    ]


PUBLISHED_PREDICTIONS = "dashboard/data/upcoming_matches.json"


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                          check=True, encoding="utf-8").stdout


def live_snapshots():
    """[(committed_at, commit_sha, [prediction dicts])], oldest first --
    every public version of the dashboard's upcoming-match predictions.

    Deliberately NOT data/live/match_predictions_*.json: those are
    gitignored local files, so their timestamps prove nothing to an outside
    reader. A git commit on the public repo does (same provenance rule as
    the proof ledger, scripts/build_proof_ledger.py)."""
    snaps = []
    for line in _git("log", "--format=%H %cI", "--", PUBLISHED_PREDICTIONS).splitlines():
        sha, committed = line.split(" ", 1)
        try:
            preds = json.loads(_git("show", f"{sha}:{PUBLISHED_PREDICTIONS}"))
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            continue
        for p in preds:
            p["home_team"], p["away_team"] = canonical(p["home_team"]), canonical(p["away_team"])
            p["bookmaker"] = {canonical(k): v for k, v in (p.get("bookmaker") or {}).items()}
        snaps.append((datetime.fromisoformat(committed.replace("Z", "+00:00")), sha, preds))
    return sorted(snaps, key=lambda s: s[0])


def latest_live_prediction(snaps, home: str, away: str, around: date):
    """Our newest publicly committed prediction for this fixture whose
    commit predates kickoff."""
    best = None
    for committed_at, sha, preds in snaps:
        for p in preds:
            if {p["home_team"], p["away_team"]} != {home, away}:
                continue
            kickoff = datetime.fromisoformat(p["commence_time"].replace("Z", "+00:00"))
            if abs((kickoff.date() - around).days) > 1 or committed_at >= kickoff:
                continue
            if best is None or committed_at > best[0]:
                best = (committed_at, sha, kickoff, p)
    return best


def orient_live(p: dict, home: str) -> tuple[tuple, tuple | None]:
    m, bk = p["model"], p.get("bookmaker") or {}
    ours = (m["home_win"], m["draw"], m["away_win"])
    if p["home_team"] != home:
        ours = ours[::-1]
    away = p["away_team"] if p["home_team"] == home else p["home_team"]
    market = None
    if home in bk and away in bk and "Draw" in bk:
        market = normalize((bk[home], bk["Draw"], bk[away]))
    return normalize(ours), market


def kickoff_times_from_live(snaps) -> dict[frozenset, datetime]:
    out = {}
    for _, _, preds in snaps:
        for p in preds:
            out[frozenset((p["home_team"], p["away_team"]))] = datetime.fromisoformat(
                p["commence_time"].replace("Z", "+00:00")
            )
    return out


# ------------------------------------------------------------- analysis

def score_rows(rows, key: str) -> dict:
    return {
        name: sum(fn(r[key], r["outcome"]) for r in rows) / len(rows)
        for name, fn in METRICS.items()
    }


def head_to_head(rows, a: str, b: str) -> dict:
    return {
        name: paired_comparison(
            [fn(r[a], r["outcome"]) for r in rows],
            [fn(r[b], r["outcome"]) for r in rows],
        )
        for name, fn in METRICS.items()
        if name != "accuracy"
    }


LOW_CONFIDENCE_BIN = 10


def calibration(rows, key: str, n_bins: int = 10) -> dict:
    """Decile reliability over every (probability, happened?) pair -- 3 per
    match, so bin n counts outcome probabilities, not matches."""
    pairs = [(r[key][i], 1 if r["outcome"] == i else 0) for r in rows for i in range(3)]
    rel = reliability(pairs, n_bins=n_bins)
    for b in rel["bins"]:
        b["low_confidence"] = b["n"] < LOW_CONFIDENCE_BIN
    return rel


def bootstrap_ci(stat, rows, n_boot: int = 2000, seed: int = 11) -> dict:
    rng = random.Random(seed)
    n = len(rows)
    draws = sorted(stat([rows[rng.randrange(n)] for _ in range(n)]) for _ in range(n_boot))
    return {"point": stat(rows), "ci95": [draws[int(0.025 * n_boot)], draws[int(0.975 * n_boot) - 1]]}


def favorite_gap(key: str):
    """Observed favorite win rate minus mean predicted favorite probability."""
    def stat(rows):
        gaps = []
        for r in rows:
            fav = 0 if r[key][0] >= r[key][2] else 2
            gaps.append((1 if r["outcome"] == fav else 0) - r[key][fav])
        return sum(gaps) / len(gaps)
    return stat


def diagnostics(rows) -> dict:
    """Every number the dashboard/README interpretation text cites."""
    n = len(rows)
    ours_rps = [rps(r["replay"], r["outcome"]) for r in rows]
    pele_rps = [rps(r["pele"], r["outcome"]) for r in rows]
    mo, mp = sum(ours_rps) / n, sum(pele_rps) / n
    cov = sum((a - mo) * (b - mp) for a, b in zip(ours_rps, pele_rps))
    corr = cov / (sum((a - mo) ** 2 for a in ours_rps) * sum((b - mp) ** 2 for b in pele_rps)) ** 0.5

    def fav_rates(key):
        pred = won = 0.0
        for r in rows:
            fav = 0 if r[key][0] >= r[key][2] else 2
            pred += r[key][fav]
            won += 1 if r["outcome"] == fav else 0
        return {"mean_predicted": pred / n, "observed": won / n,
                "gap": bootstrap_ci(favorite_gap(key), rows)}

    ece = lambda key: (lambda rs: calibration(rs, key)["ece"])  # noqa: E731
    host = [r for r in rows if r["host_match"]]
    return {
        "draw_rate": {
            "observed": sum(1 for r in rows if r["outcome"] == 1) / n,
            "mean_predicted_ours": sum(r["replay"][1] for r in rows) / n,
            "mean_predicted_pele": sum(r["pele"][1] for r in rows) / n,
        },
        "favorites": {"ours": fav_rates("replay"), "pele": fav_rates("pele")},
        "ece_decile_diff_ours_minus_pele": bootstrap_ci(lambda rs: ece("replay")(rs) - ece("pele")(rs), rows),
        "per_match_rps_correlation": corr,
        "mean_abs_prob_diff_ours_vs_pele": sum(abs(a - b) for r in rows for a, b in zip(r["replay"], r["pele"])) / (3 * n),
        "host_matches_ours_vs_pele": head_to_head(host, "replay", "pele") if host else {},
    }


def stage_reached(ko_results) -> dict[str, str]:
    order = ["R32", "R16", "QF", "SF", "F"]
    reached = {}
    for stage, (h, a) in ko_results:
        for t in (h, a):
            if order.index(stage) >= order.index(reached.get(t, "R32")):
                reached[t] = stage
    return reached


def main():
    forecasts = load_pele_forecasts()
    all_matches = live_results_store.load_combined_matches()
    results = world_cup_results(all_matches)
    rankings = load_fifa_rankings()
    timelines = build_timelines(all_matches)
    snaps = live_snapshots()
    kickoffs = kickoff_times_from_live(snaps)

    print("Fitting Layer 1 on pre-tournament data only (train_end = 2026-06-11)...")
    ensemble = Layer1Ensemble(
        all_matches, timelines, rankings, TRAIN_START, TOURNAMENT_START, xgb_params=load_tuned_xgb_params()
    )

    pele_fixtures = {}
    for f in forecasts:
        pele_fixtures.setdefault((f.stage, frozenset((f.team_a, f.team_b))), f.local_date)

    rows, unmatched, no_pre_kickoff = [], [], []
    for (stage, pair), local_date in sorted(pele_fixtures.items(), key=lambda kv: kv[1]):
        result = next(
            (m for m in results if frozenset((m.home_team, m.away_team)) == pair
             and abs((m.date - local_date).days) <= 1),
            None,
        )
        if result is None:
            unmatched.append(sorted(pair))
            continue
        home, away = result.home_team, result.away_team
        kickoff = kickoffs.get(pair) if stage != "group" else None
        pf = pele.latest_pre_kickoff(forecasts, home, away, result.date, kickoff)
        if pf is None:
            no_pre_kickoff.append(sorted(pair))
            continue

        p_loss, p_draw, p_win = ensemble.match_probs(home, away, result.date, neutral=True)
        host_neutral = not (home in HOSTS or away in HOSTS)
        # Ablation: PELE's host home advantage. Orientation matters here: the
        # host must be the "home" side for neutral=False to mean anything.
        if home in HOSTS or away in HOSTS:
            host, guest = (home, away) if home in HOSTS else (away, home)
            h_loss, h_draw, h_win = ensemble.match_probs(host, guest, result.date, neutral=False)
            replay_hfa = (h_win, h_draw, h_loss) if host == home else (h_loss, h_draw, h_win)
        else:
            replay_hfa = (p_win, p_draw, p_loss)

        row = {
            "date": result.date.isoformat(),
            "stage": stage,
            "home": home,
            "away": away,
            "score": f"{result.home_score}-{result.away_score}",
            "outcome": outcome_index(result.home_score, result.away_score),
            "host_match": not host_neutral,
            "pele": normalize(pele.oriented(pf, home)),
            "pele_version": pf.version,
            "pele_published_at": pf.published_at.isoformat(),
            "replay": normalize((p_win, p_draw, p_loss)),
            "replay_host_hfa": normalize(replay_hfa),
            "elo_home": snapshot_as_of(timelines, home, result.date).elo,
            "elo_away": snapshot_as_of(timelines, away, result.date).elo,
        }
        row["combo"] = normalize(tuple((x + y) / 2 for x, y in zip(row["replay"], row["pele"])))

        live = latest_live_prediction(snaps, home, away, result.date) if stage != "group" else None
        if live:
            committed_at, sha, live_kickoff, p = live
            ours, market = orient_live(p, home)
            pf_live = pele.latest_pre_kickoff(forecasts, home, away, result.date, live_kickoff)
            row["live"] = {
                "ours": ours,
                "market": market,
                "pele": normalize(pele.oriented(pf_live, home)) if pf_live else None,
                "kickoff": live_kickoff.isoformat(),
                "ours_commit": sha,
                "ours_committed_at": committed_at.isoformat(),
                "pele_published_at": pf_live.published_at.isoformat() if pf_live else None,
            }
        rows.append(row)

    print(f"Matched {len(rows)} matches; unmatched={unmatched}; no pre-kickoff PELE={no_pre_kickoff}")

    # ---- replay track
    def track(sub):
        return {
            "n": len(sub),
            "metrics": {k: score_rows(sub, k) for k in ("replay", "pele", "combo")},
            "ours_vs_pele": head_to_head(sub, "replay", "pele"),
            "combo_vs_pele": head_to_head(sub, "combo", "pele"),
            "combo_vs_ours": head_to_head(sub, "combo", "replay"),
        }

    replay = {
        "all": track(rows),
        "group": track([r for r in rows if r["stage"] == "group"]),
        "knockout": track([r for r in rows if r["stage"] != "group"]),
        "calibration": {k: calibration(rows, k) for k in ("replay", "pele")},
        "diagnostics": diagnostics(rows),
    }

    # ---- live track (only matches where all of ours, PELE and market exist pre-kickoff)
    live_rows = [
        {"outcome": r["outcome"], "ours": r["live"]["ours"], "pele": r["live"]["pele"],
         "market": r["live"]["market"], "replay": r["replay"]}
        for r in rows if r.get("live") and r["live"]["pele"] and r["live"]["market"]
    ]
    if not live_rows:
        raise SystemExit("No live-track matches: check git history of " + PUBLISHED_PREDICTIONS)
    live_track = {
        "n": len(live_rows),
        "metrics": {k: score_rows(live_rows, k) for k in ("ours", "pele", "market")},
        "ours_vs_pele": head_to_head(live_rows, "ours", "pele"),
        "pele_vs_market": head_to_head(live_rows, "pele", "market"),
        "ours_vs_market": head_to_head(live_rows, "ours", "market"),
        # Replay-fidelity check: does the replay reproduce what the live
        # pipeline actually said? Mean absolute gap in probability points.
        "replay_fidelity_mean_abs_diff": (
            sum(abs(x - y) for r in live_rows for x, y in zip(r["ours"], r["replay"])) / (3 * len(live_rows))
            if live_rows else None
        ),
    }

    # ---- ablation: PELE-style host advantage on our model, host matches only
    host_rows = [r for r in rows if r["host_match"]]
    ablation = {
        "idea": "Score co-host matches as home games (PELE's venue-level home advantage) instead of neutral",
        "n_host_matches": len(host_rows),
        "metrics": {k: score_rows(host_rows, k) for k in ("replay", "replay_host_hfa", "pele")} if host_rows else {},
        "hfa_vs_neutral": head_to_head(host_rows, "replay_host_hfa", "replay") if host_rows else {},
    }

    # ---- ratings: PELE (last version before kickoff of the tournament) vs our Elo
    with open(PELE_DIR / "ratings.csv", encoding="utf-8") as fh:
        rating_rows = [r for r in csv.DictReader(fh) if r["current_pele"]]
    opening = datetime(2026, 6, 11, 19, tzinfo=timezone.utc)
    pre = [r for r in rating_rows if datetime.fromisoformat(r["published_at"]) < opening]
    last_version = max(int(r["version"]) for r in pre)
    pele_ratings = {r["team"]: float(r["current_pele"]) for r in pre if int(r["version"]) == last_version}
    our_elo = {t: snapshot_as_of(timelines, t, TOURNAMENT_START).elo for t in pele_ratings}

    def ranks(d):
        return {t: i + 1 for i, (t, _) in enumerate(sorted(d.items(), key=lambda kv: -kv[1]))}

    rp, ro = ranks(pele_ratings), ranks(our_elo)
    n = len(rp)
    spearman = 1 - 6 * sum((rp[t] - ro[t]) ** 2 for t in rp) / (n * (n * n - 1))
    ko = [(r["stage"], (r["home"], r["away"])) for r in rows if r["stage"] != "group"]
    reached = stage_reached(ko)
    finish = {t: reached.get(t, "group") for t in rp}
    finish["Spain"] = "Champion"
    disagreements = sorted(
        ({"team": t, "pele_rank": rp[t], "our_rank": ro[t], "pele_rating": round(pele_ratings[t], 1),
          "our_elo": round(our_elo[t], 1), "finish": finish[t]} for t in rp),
        key=lambda d: -abs(d["pele_rank"] - d["our_rank"]),
    )
    ratings = {
        "pele_version": last_version,
        "n_teams": n,
        "spearman_rank_correlation": spearman,
        "top10_pele": sorted(rp, key=rp.get)[:10],
        "top10_ours": sorted(ro, key=ro.get)[:10],
        "largest_disagreements": disagreements[:8],
    }

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "question": "Have you compared yours against Nate Silver's PELE model?",
        "sources": {
            "pele_methodology": "https://www.natesilver.net/p/pele-methodology",
            "pele_data": json.loads((PELE_DIR / "manifest.json").read_text()),
        },
        "protocol": {
            "outcome": "Proper 3-outcome scoring: home win / draw / away win from the recorded score. Draws are their own outcome (not dropped, not split). Knockout scores include extra time where played and a shootout counts as a draw; both models are graded on the identical label.",
            "pele_side": "Last PELE Datawrapper version published (HTTP Last-Modified) before a deadline: the exact kickoff where our fixture feed has it (21 knockout matches); otherwise 15:00 UTC on the earlier of PELE's date label and the venue-local match date (every 2026 kickoff was >= 16:00 UTC local-date). So group-stage PELE numbers can be up to a day older than PELE's true last pre-kickoff version -- conservative, never later.",
            "replay_side": f"Layer 1 trained on {TRAIN_START} to {TOURNAMENT_START} only; Elo/form strictly before each match date; all matches scored neutral=True, as in production.",
            "live_side": "Newest version of dashboard/data/upcoming_matches.json committed to the public repo before kickoff (git commit time).",
            "tests": "Paired percentile bootstrap (10k) 95% CI of the mean per-match score difference; two-sided paired sign-flip randomization p-value.",
            "primary_metric": "rps",
        },
        "accounting": {
            "pele_fixtures": len(pele_fixtures),
            "world_cup_results": len(results),
            "results_without_pele_fixture": sorted(
                f"{m.date} {m.home_team} v {m.away_team}" for m in results
                if not any(frozenset((m.home_team, m.away_team)) == pair for _, pair in pele_fixtures)
            ),
            "scored_replay": len(rows),
            "scored_live": len(live_rows),
            "knockout_excluded_from_live": sorted(
                f"{r['date']} {r['home']} v {r['away']}: " + (
                    "no public commit of ours before kickoff" if not r.get("live")
                    else "no PELE 3-way before kickoff" if not r["live"]["pele"]
                    else "no bookmaker odds in our snapshot")
                for r in rows if r["stage"] != "group" and not (r.get("live") and r["live"]["pele"] and r["live"]["market"])
            ),
        },
        "unmatched_fixtures": unmatched,
        "fixtures_without_pre_kickoff_pele": no_pre_kickoff,
        "replay": replay,
        "live": live_track,
        "ablation_host_advantage": ablation,
        "ratings": ratings,
        "method_differences": METHOD_DIFFERENCES,
        "matches": rows,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f"Wrote {OUT_PATH}")

    def fmt(t, a, b):
        c = t[f"{a}_vs_{b}" if f"{a}_vs_{b}" in t else "ours_vs_pele"]["rps"]
        return f"dRPS={c['mean_diff']:+.4f} CI[{c['ci95'][0]:+.4f},{c['ci95'][1]:+.4f}] p={c['p_value']:.3f}"

    for name in ("all", "group", "knockout"):
        t = replay[name]
        m = t["metrics"]
        print(f"replay/{name:8s} n={t['n']:3d}  RPS ours={m['replay']['rps']:.4f} pele={m['pele']['rps']:.4f} "
              f"combo={m['combo']['rps']:.4f}  {fmt(t, 'ours', 'pele')}")
    if live_rows:
        m = live_track["metrics"]
        print(f"live n={live_track['n']}  RPS ours={m['ours']['rps']:.4f} pele={m['pele']['rps']:.4f} "
              f"market={m['market']['rps']:.4f}  fidelity={live_track['replay_fidelity_mean_abs_diff']:.3f}")
    print(f"ratings spearman={spearman:.3f}")


if __name__ == "__main__":
    main()

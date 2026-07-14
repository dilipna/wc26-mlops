"""Builds the tamper-evident prediction ledger (src/verification/ledger.py)
from the project's real artifacts:

- graded fixtures: dashboard/data/proof_tracker.json (written by
  verify_predictions.py from the Supabase append-only snapshot table +
  results_log.csv)
- pending fixtures: dashboard/data/upcoming_matches.json (the latest
  pre-kickoff snapshot, committed daily)
- git provenance: for every fixture, the EARLIEST public commit whose
  committed upcoming_matches.json already contained a prediction for it,
  plus that commit's timestamp and a GitHub URL a skeptic can open.

Writes data/proof/prediction_ledger.json (git-committed by the daily
GitHub Actions workflow -- the commit itself extends the public proof
trail) and mirrors it to dashboard/data/proof_ledger.json for the site.

Run:    python scripts/build_proof_ledger.py
Verify: python scripts/build_proof_ledger.py --verify
        (recomputes the hash chain of the committed ledger; exits 1 on
        any mismatch)

NOTE ON RECONSTRUCTED ENTRIES: fixtures predicted before the daily
GitHub Actions workflow existed (added 2026-07-05) have no pre-kickoff
commit to point at; their evidence is the Supabase append-only snapshot
alone, and the entry says so in an explicit "note" field instead of
pretending git evidence exists.
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.verification import ledger  # noqa: E402

SNAPSHOT_FILE = "dashboard/data/upcoming_matches.json"
PROOF_TRACKER = ROOT / "dashboard" / "data" / "proof_tracker.json"
UPCOMING = ROOT / "dashboard" / "data" / "upcoming_matches.json"
OUT_PATH = ROOT / "data" / "proof" / "prediction_ledger.json"
DASHBOARD_OUT = ROOT / "dashboard" / "data" / "proof_ledger.json"
REPO_URL = "https://github.com/dilipna/wc26-mlops"

RECONSTRUCTION_NOTE = (
    "Reconstructed entry: this fixture was predicted before the daily "
    "GitHub Actions commit trail existed (2026-07-05), so there is no "
    "pre-kickoff commit to cite. Evidence is the Supabase append-only "
    "match_predictions snapshot (logged_at above) only."
)


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout


def snapshot_history() -> list[dict]:
    """Every commit that touched the committed pre-kickoff snapshot file,
    oldest first, with the fixtures each version contained. ~1 commit/day,
    so parsing each version is cheap."""
    lines = _git("log", "--reverse", "--format=%H|%cI", "--", SNAPSHOT_FILE).strip().splitlines()
    history = []
    for line in lines:
        sha, committed_at = line.split("|", 1)
        try:
            content = _git("show", f"{sha}:{SNAPSHOT_FILE}")
            fixtures = json.loads(content)
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            continue
        history.append({"sha": sha, "committed_at": committed_at, "fixtures": fixtures})
    return history


def _norm_ts(iso: str) -> str:
    """Supabase returns timestamps as ...+00:00 while the Odds API
    snapshots use a trailing Z -- normalize so the same fixture matches
    across both sources (and Python 3.10's fromisoformat can parse it)."""
    return iso.replace("Z", "+00:00")


def provenance_for(history: list[dict], home: str, away: str, commence_time: str) -> dict | None:
    """Earliest commit that already contained a prediction for this
    fixture AND was committed before kickoff -- the strongest 'this was
    public before the match' evidence git can give."""
    kickoff = datetime.fromisoformat(_norm_ts(commence_time))
    for snap in history:
        committed = datetime.fromisoformat(_norm_ts(snap["committed_at"]))
        if committed.astimezone(timezone.utc) >= kickoff:
            continue
        for fx in snap["fixtures"]:
            if (
                fx["home_team"] == home
                and fx["away_team"] == away
                and _norm_ts(fx["commence_time"]) == _norm_ts(commence_time)
            ):
                return {
                    "recorded_pre_match": True,
                    "first_public_commit": snap["sha"],
                    "committed_at": snap["committed_at"],
                    "file": SNAPSHOT_FILE,
                    "committed_model_probs": {k: round(v, 4) for k, v in fx["model"].items()},
                    "github_url": f"{REPO_URL}/blob/{snap['sha']}/{SNAPSHOT_FILE}",
                    "github_commit_url": f"{REPO_URL}/commit/{snap['sha']}",
                }
    return None


def build() -> dict:
    proof = json.loads(PROOF_TRACKER.read_text(encoding="utf-8"))
    upcoming = json.loads(UPCOMING.read_text(encoding="utf-8")) if UPCOMING.exists() else []
    history = snapshot_history()

    entries = []
    graded_keys = set()
    for g in proof["graded_matches"]:
        key = (g["home_team"], g["away_team"], g["commence_time"])
        graded_keys.add(key)
        prov = provenance_for(history, *key)
        entries.append(
            ledger.build_entry(
                home=g["home_team"],
                away=g["away_team"],
                commence_time=g["commence_time"],
                model=g["model"],
                market=g["bookmaker"],
                logged_at=g["logged_at"],
                result={
                    "home_score": g["home_score"],
                    "away_score": g["away_score"],
                    "actual_outcome": g["actual_outcome"],
                },
                provenance=prov,
                note=None if prov else RECONSTRUCTION_NOTE,
            )
        )

    for fx in upcoming:
        key = (fx["home_team"], fx["away_team"], fx["commence_time"])
        if key in graded_keys:
            continue
        market = ledger.outcome_probs_from_named(fx.get("bookmaker"), fx["home_team"], fx["away_team"])
        prov = provenance_for(history, *key)
        entries.append(
            ledger.build_entry(
                home=fx["home_team"],
                away=fx["away_team"],
                commence_time=fx["commence_time"],
                model=fx["model"],
                market=market,
                logged_at=None,
                result=None,
                provenance=prov,
                note=None if prov else RECONSTRUCTION_NOTE,
            )
        )

    # Deterministic order: kickoff time, then home team -- required for a
    # stable hash chain across rebuilds of the same underlying data.
    entries.sort(key=lambda e: (e["match"]["commence_time"], e["match"]["home_team"]))
    ledger.chain_entries(entries)

    return {
        "version": ledger.GENESIS,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo": REPO_URL,
        "how_to_verify": [
            f"1. Every entry's provenance.github_url shows the prediction inside {SNAPSHOT_FILE} "
            "at a commit GitHub timestamped BEFORE kickoff -- open it, compare the probabilities.",
            "2. The commit history of this ledger file and data/predictions/predictions_log.csv is an "
            "append-only daily trail written by the public GitHub Actions runs (Actions tab) -- "
            "rewriting it would break every fork, clone, and the Actions log.",
            "3. Recompute the hash chain locally: python scripts/build_proof_ledger.py --verify "
            "(each entry_hash = sha256(prev_hash + canonical entry JSON); genesis = "
            f"sha256('{ledger.GENESIS}')).",
        ],
        "summary": ledger.summarize(entries),
        "entries": entries,
    }


def verify(path: Path) -> bool:
    doc = json.loads(path.read_text(encoding="utf-8"))
    ok = ledger.verify_chain(doc["entries"])
    print(f"[proof_ledger] chain {'VALID' if ok else 'BROKEN'} "
          f"({len(doc['entries'])} entries, generated_at={doc['generated_at']})")
    return ok


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true", help="verify the committed ledger's hash chain")
    args = parser.parse_args()

    if args.verify:
        sys.exit(0 if verify(OUT_PATH) else 1)

    doc = build()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(doc, indent=2, ensure_ascii=False)
    OUT_PATH.write_text(payload, encoding="utf-8")
    DASHBOARD_OUT.write_text(payload, encoding="utf-8")

    s = doc["summary"]
    print(f"[proof_ledger] {s['n_entries']} entries ({s['n_graded']} graded, {s['n_pending']} pending) "
          f"-> {OUT_PATH}")
    print(f"  model accuracy {s['model_accuracy']} vs market {s['market_accuracy']} | "
          f"disagreements won {s['model_won_disagreements']}/{s['n_disagreements']} | "
          f"best call: {s['best_call']}")
    print(f"  git provenance on {s['n_with_git_provenance']}/{s['n_entries']} entries; "
          f"chain valid: {ledger.verify_chain(doc['entries'])}")


if __name__ == "__main__":
    main()

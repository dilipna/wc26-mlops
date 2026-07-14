"""Tamper-evident prediction ledger (the "proof system").

Turns the project's existing evidence trail -- pre-kickoff prediction
snapshots (Supabase append-only table + the daily-committed
dashboard/data/upcoming_matches.json), graded results
(proof_tracker.json), and the public GitHub commit history -- into one
canonical, hash-chained ledger covering every WC26 match prediction.

Three independent layers make an entry hard to quietly fake or backdate:

1. **Git provenance**: for every fixture, the earliest public commit
   whose committed upcoming_matches.json already contained the
   prediction, with its commit timestamp. GitHub's SHA history cannot be
   rewritten without breaking every fork/clone and the Actions run log.
2. **Hash chain**: every ledger entry embeds the previous entry's
   SHA-256, so editing any historical entry invalidates every hash after
   it. `verify_chain()` recomputes the whole chain from scratch.
3. **Append-only external mirror**: the Supabase `match_predictions`
   table (insert-only by design, see supabase/schema.sql) holds the raw
   timestamped snapshots the graded numbers come from.

Pure logic only -- no file/network I/O here (that lives in
scripts/build_proof_ledger.py), matching this repo's src/ = logic,
scripts/ = entry-point convention so the chain/grading rules are unit
testable.
"""

import hashlib
import json

GENESIS = "wc26-proof-ledger-v1"

OUTCOME_KEYS = ("home_win", "draw", "away_win")


def canonical_json(obj) -> str:
    """Deterministic serialization -- the hash input must not depend on
    dict insertion order or whitespace."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _entry_body(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k not in ("prev_hash", "entry_hash")}


def chain_entries(entries: list[dict], genesis: str = GENESIS) -> list[dict]:
    """Adds prev_hash/entry_hash to each entry, in order. Entries must
    already be deterministically sorted by the caller."""
    prev = hashlib.sha256(genesis.encode("utf-8")).hexdigest()
    for entry in entries:
        entry["prev_hash"] = prev
        payload = prev + canonical_json(_entry_body(entry))
        entry["entry_hash"] = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        prev = entry["entry_hash"]
    return entries


def verify_chain(entries: list[dict], genesis: str = GENESIS) -> bool:
    """Recomputes every hash from scratch; any edited/reordered/removed
    entry breaks every hash from that point on."""
    prev = hashlib.sha256(genesis.encode("utf-8")).hexdigest()
    for entry in entries:
        if entry.get("prev_hash") != prev:
            return False
        payload = prev + canonical_json(_entry_body(entry))
        if hashlib.sha256(payload.encode("utf-8")).hexdigest() != entry.get("entry_hash"):
            return False
        prev = entry["entry_hash"]
    return True


def outcome_probs_from_named(named: dict, home_team: str, away_team: str) -> dict | None:
    """upcoming_matches.json keys bookmaker probabilities by team name
    ("France": 0.4, "Draw": ...); the graded cards use outcome keys.
    Normalize to outcome keys so every ledger entry has one shape."""
    if not named:
        return None
    probs = {
        "home_win": named.get(home_team),
        "draw": named.get("Draw"),
        "away_win": named.get(away_team),
    }
    if any(v is None for v in probs.values()):
        return None
    return probs


def _pick(probs: dict) -> str:
    return max(OUTCOME_KEYS, key=lambda k: probs[k])


def divergence(model: dict, market: dict) -> float:
    """L1 distance between the two probability vectors -- the plain,
    explainable 'how much did we disagree with the market' measure used
    to rank the ledger's best calls."""
    return sum(abs(model[k] - market[k]) for k in OUTCOME_KEYS)


def entry_id(home: str, away: str, commence_time: str) -> str:
    slug = f"{home}-vs-{away}".lower().replace(" ", "-")
    return f"{commence_time[:10]}-{slug}"


def build_entry(
    home: str,
    away: str,
    commence_time: str,
    model: dict,
    market: dict | None,
    logged_at: str | None,
    result: dict | None,
    provenance: dict | None,
    note: str | None = None,
) -> dict:
    """One ledger entry. result: {home_score, away_score, actual_outcome}
    or None while the fixture is pending. provenance: output of the git
    history walk (see scripts/build_proof_ledger.py) or None."""
    model_pick = _pick(model)
    market_pick = _pick(market) if market else None

    entry = {
        "id": entry_id(home, away, commence_time),
        "match": {"home_team": home, "away_team": away, "commence_time": commence_time},
        "prediction": {
            "logged_at": logged_at,
            "model": model,
            "market": market,
            "model_pick": model_pick,
            "market_pick": market_pick,
            "disagreement": (market_pick is not None and model_pick != market_pick),
            "divergence": round(divergence(model, market), 4) if market else None,
        },
        "result": result,
        "grading": None,
        "provenance": provenance,
    }
    if note:
        entry["note"] = note

    if result is not None:
        actual = result["actual_outcome"]
        entry["grading"] = {
            "model_correct": model_pick == actual,
            "market_correct": (market_pick == actual) if market_pick else None,
            "model_brier": round(sum((model[k] - (1.0 if k == actual else 0.0)) ** 2 for k in OUTCOME_KEYS), 4),
            "market_brier": (
                round(sum((market[k] - (1.0 if k == actual else 0.0)) ** 2 for k in OUTCOME_KEYS), 4)
                if market
                else None
            ),
        }
    return entry


def summarize(entries: list[dict]) -> dict:
    graded = [e for e in entries if e["grading"] is not None]
    market_graded = [e for e in graded if e["grading"]["market_correct"] is not None]
    disagreements = [e for e in market_graded if e["prediction"]["disagreement"]]
    model_won_disagreements = [e for e in disagreements if e["grading"]["model_correct"]]

    best_call = None
    correct_upsets = [
        e for e in disagreements if e["grading"]["model_correct"] and not e["grading"]["market_correct"]
    ]
    if correct_upsets:
        best_call = max(correct_upsets, key=lambda e: e["prediction"]["divergence"])["id"]

    n = len(graded)
    n_market = len(market_graded)
    return {
        "n_entries": len(entries),
        "n_graded": n,
        "n_pending": len(entries) - n,
        "model_accuracy": round(sum(e["grading"]["model_correct"] for e in graded) / n, 4) if n else None,
        "market_accuracy": (
            round(sum(e["grading"]["market_correct"] for e in market_graded) / n_market, 4) if n_market else None
        ),
        "model_avg_brier": round(sum(e["grading"]["model_brier"] for e in graded) / n, 4) if n else None,
        "market_avg_brier": (
            round(sum(e["grading"]["market_brier"] for e in market_graded) / n_market, 4) if n_market else None
        ),
        "n_disagreements": len(disagreements),
        "model_won_disagreements": len(model_won_disagreements),
        "best_call": best_call,
        "n_with_git_provenance": sum(1 for e in entries if e.get("provenance")),
    }

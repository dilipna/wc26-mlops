"""Tests for the tamper-evident prediction ledger's pure logic
(src/verification/ledger.py) -- chain integrity, tamper detection,
entry grading, and summary stats."""

import copy

from src.verification import ledger

MODEL = {"home_win": 0.296, "draw": 0.306, "away_win": 0.398}
MARKET = {"home_win": 0.400, "draw": 0.295, "away_win": 0.304}


def _entry(result=None, market=MARKET, home="France", away="Spain", kickoff="2026-07-14T19:00:00Z"):
    return ledger.build_entry(
        home=home,
        away=away,
        commence_time=kickoff,
        model=MODEL,
        market=market,
        logged_at="2026-07-14T00:33:14+00:00",
        result=result,
        provenance={"recorded_pre_match": True, "first_public_commit": "abc123"},
    )


def test_entry_picks_and_disagreement():
    e = _entry()
    assert e["prediction"]["model_pick"] == "away_win"
    assert e["prediction"]["market_pick"] == "home_win"
    assert e["prediction"]["disagreement"] is True
    assert e["grading"] is None  # pending fixture


def test_entry_grading():
    e = _entry(result={"home_score": 0, "away_score": 2, "actual_outcome": "away_win"})
    assert e["grading"]["model_correct"] is True
    assert e["grading"]["market_correct"] is False
    # Brier identity: sum((p_k - 1[k=actual])^2)
    expected = (0.296 - 0) ** 2 + (0.306 - 0) ** 2 + (0.398 - 1) ** 2
    assert e["grading"]["model_brier"] == round(expected, 4)


def test_chain_verifies_and_detects_tampering():
    entries = [
        _entry(result={"home_score": 0, "away_score": 2, "actual_outcome": "away_win"}),
        _entry(home="England", away="Argentina", kickoff="2026-07-15T19:00:00Z"),
    ]
    ledger.chain_entries(entries)
    assert ledger.verify_chain(entries)

    tampered = copy.deepcopy(entries)
    tampered[0]["prediction"]["model"]["away_win"] = 0.9  # quiet backdated edit
    assert not ledger.verify_chain(tampered)

    reordered = [entries[1], entries[0]]
    assert not ledger.verify_chain(reordered)

    truncated = entries[1:]  # dropping the first entry breaks the genesis link
    assert not ledger.verify_chain(truncated)


def test_chain_rejects_recomputed_but_disconnected_hashes():
    entries = [_entry()]
    ledger.chain_entries(entries)
    entries[0]["prev_hash"] = "0" * 64  # forged link
    assert not ledger.verify_chain(entries)


def test_outcome_probs_from_named():
    named = {"France": 0.4, "Spain": 0.304, "Draw": 0.295}
    probs = ledger.outcome_probs_from_named(named, "France", "Spain")
    assert probs == {"home_win": 0.4, "draw": 0.295, "away_win": 0.304}
    assert ledger.outcome_probs_from_named({}, "France", "Spain") is None
    assert ledger.outcome_probs_from_named({"France": 0.4}, "France", "Spain") is None


def test_summarize_best_call_and_disagreements():
    upset = _entry(result={"home_score": 0, "away_score": 2, "actual_outcome": "away_win"})
    agreed = ledger.build_entry(
        home="Spain",
        away="Belgium",
        commence_time="2026-07-10T19:00:00Z",
        model={"home_win": 0.6, "draw": 0.25, "away_win": 0.15},
        market={"home_win": 0.55, "draw": 0.25, "away_win": 0.20},
        logged_at="2026-07-10T06:00:00+00:00",
        result={"home_score": 2, "away_score": 1, "actual_outcome": "home_win"},
        provenance=None,
    )
    pending = _entry(home="England", away="Argentina", kickoff="2026-07-15T19:00:00Z")
    entries = ledger.chain_entries([agreed, upset, pending])

    s = ledger.summarize(entries)
    assert s["n_entries"] == 3
    assert s["n_graded"] == 2
    assert s["n_pending"] == 1
    assert s["model_accuracy"] == 1.0
    assert s["market_accuracy"] == 0.5
    assert s["n_disagreements"] == 1
    assert s["model_won_disagreements"] == 1
    assert s["best_call"] == upset["id"]
    assert s["n_with_git_provenance"] == 2  # agreed has provenance=None

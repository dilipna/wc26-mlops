"""Independently rebuild committed receipts from scores; never trust summary labels."""

import hashlib
import json
from pathlib import Path
import pytest
from src.core.match_replay import load_games, replay

ROOT = Path(__file__).resolve().parents[1]


def assert_reconstruction(saved, actual):
    # Windows/libm and Linux/libm can differ below the reported precision.
    # Structural fields remain exact; this tolerance is not a model-score gate.
    if isinstance(saved, dict):
        assert set(saved) == set(actual)
        for key in saved:
            if key != "pre_date_state_sha256":
                assert_reconstruction(saved[key], actual[key])
    elif isinstance(saved, list):
        assert len(saved) == len(actual)
        for a, b in zip(saved, actual):
            assert_reconstruction(a, b)
    elif isinstance(saved, float) or isinstance(actual, float):
        assert saved == pytest.approx(actual, rel=0, abs=1e-10)
    else:
        assert saved == actual


@pytest.mark.parametrize("sport", ["basketball", "nfl", "cricket"])
def test_committed_replay_recomputes_from_source_scores(sport):
    protocol = json.loads((ROOT / "docs/multisport-replay-protocol.json").read_text())
    sources = json.loads((ROOT / "data/multisport/sources.json").read_text())
    cards = json.loads((ROOT / "dashboard/data/sport_replays.json").read_text())
    artifact = ROOT / f"dashboard/public/replays/{sport}.json"
    saved = json.loads(artifact.read_text())
    card = next(c for c in cards if c["sport"] == sport)
    assert hashlib.sha256(artifact.read_bytes()).hexdigest() == card["artifact_sha256"]
    source = ROOT / f"data/multisport/{sport}.csv"
    assert (
        hashlib.sha256(source.read_bytes()).hexdigest()
        == sources["sources"][sport]["normalized_sha256"]
    )
    spec = protocol["sports"][sport]
    model = protocol["model"]
    actual = replay(
        load_games(source),
        evaluation_start=spec["evaluation_start"],
        evaluation_end=spec["evaluation_end_exclusive"],
        k=model["k"],
        initial=model["initial_rating"],
        scale=model["scale"],
        home_advantage=model["home_advantage"][sport],
    )
    for key in (
        "predictions",
        "history",
        "ratings",
        "model_metrics",
        "baseline_metrics",
        "baseline_probability_a",
        "training_matches",
        "parameters",
        "as_of",
    ):
        assert_reconstruction(saved[key], actual[key])
    assert (
        saved["identity"]["implementation_sha256"]
        == hashlib.sha256(
            (ROOT / "src/core/match_replay.py").read_text().encode()
        ).hexdigest()
    )
    assert_reconstruction(card["model_metrics"], actual["model_metrics"])
    assert_reconstruction(card["baseline_metrics"], actual["baseline_metrics"])
    assert (
        saved["identity"]["protocol_sha256"]
        == hashlib.sha256(
            json.dumps(protocol, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
    )

    previous = {}
    expected_states = {}
    for frame in saved["history"]:
        expected_states[frame["date"]] = hashlib.sha256(
            json.dumps(previous, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        previous = frame["ratings"]
    for prediction in saved["predictions"]:
        assert (
            prediction["pre_date_state_sha256"] == expected_states[prediction["date"]]
        )

"""Independently rebuild committed receipts from scores; never trust summary labels."""

import hashlib
import json
from pathlib import Path
import pytest
from src.core.match_replay import load_games, replay

ROOT = Path(__file__).resolve().parents[1]


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
        assert saved[key] == actual[key], key
    assert (
        saved["identity"]["implementation_sha256"]
        == hashlib.sha256(
            (ROOT / "src/core/match_replay.py").read_text().encode()
        ).hexdigest()
    )
    assert card["model_metrics"] == actual["model_metrics"]
    assert card["baseline_metrics"] == actual["baseline_metrics"]
    assert (
        saved["identity"]["protocol_sha256"]
        == hashlib.sha256(
            json.dumps(protocol, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
    )

"""Rebuild historical sport artifacts offline from attributed match snapshots."""

from __future__ import annotations
import hashlib
import json
import platform
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    from src.core.match_replay import load_games, replay
    from src.sports.replays import register_replay_sports

    protocol_path = ROOT / "docs/multisport-replay-protocol.json"
    protocol = json.loads(protocol_path.read_text())
    sources = json.loads((ROOT / "data/multisport/sources.json").read_text())
    output = ROOT / "dashboard/public/replays"
    output.mkdir(parents=True, exist_ok=True)
    model = protocol["model"]
    cards = []
    plugins = register_replay_sports()
    source_sha = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    dirty_source = bool(
        subprocess.check_output(
            ["git", "status", "--porcelain", "--untracked-files=no"], cwd=ROOT
        ).strip()
    )
    for sport, spec in protocol["sports"].items():
        plugin = plugins[sport]
        if len(plugin.config.outcome_labels) != 2 or plugin.source_key != sport:
            raise ValueError("Sport outcome/source contract mismatch")
        source = sources["sources"][plugin.source_key]
        path = ROOT / f"data/multisport/{sport}.csv"
        if hashlib.sha256(path.read_bytes()).hexdigest() != source["normalized_sha256"]:
            raise ValueError("Source snapshot hash mismatch: " + sport)
        games = load_games(path)
        if any(
            not spec["train_start"] <= g.date < spec["evaluation_end_exclusive"]
            for g in games
        ):
            raise ValueError("Match outside frozen protocol")
        result = replay(
            games,
            evaluation_start=spec["evaluation_start"],
            evaluation_end=spec["evaluation_end_exclusive"],
            k=model["k"],
            initial=model["initial_rating"],
            scale=model["scale"],
            home_advantage=model["home_advantage"][sport],
        )
        identity = {
            "source_sha": source_sha,
            "dirty_source": dirty_source,
            "python": platform.python_version(),
            "protocol_sha256": hashlib.sha256(
                json.dumps(protocol, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest(),
            "implementation_sha256": hashlib.sha256(
                (ROOT / "src/core/match_replay.py").read_text().encode()
            ).hexdigest(),
            "data_sha256": source["normalized_sha256"],
        }
        result.update(schema=1, sport=sport, source=source, identity=identity)
        encoded = json.dumps(result, sort_keys=True, separators=(",", ":")) + "\n"
        (output / f"{sport}.json").write_bytes(encoded.encode("utf-8"))
        card = {
            key: result[key]
            for key in (
                "sport",
                "training_matches",
                "evaluation_start",
                "evaluation_end_exclusive",
                "model_metrics",
                "baseline_metrics",
                "as_of",
                "scope",
            )
        }
        card["artifact_sha256"] = hashlib.sha256(encoded.encode()).hexdigest()
        cards.append(card)
        print(
            json.dumps(
                {
                    "sport": sport,
                    "matches": result["model_metrics"]["n"],
                    "model_log_loss": result["model_metrics"]["log_loss"],
                    "baseline_log_loss": result["baseline_metrics"]["log_loss"],
                }
            ),
            flush=True,
        )
    (ROOT / "dashboard/data/sport_replays.json").write_text(
        json.dumps(cards, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()

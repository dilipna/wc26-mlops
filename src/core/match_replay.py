"""Deterministic decisive-match Elo replay; no network or model unpickling.

Every date is an information boundary: score the whole date before updates.
This is a retrospective baseline, not the existing three-outcome football stack.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from itertools import groupby
from pathlib import Path


@dataclass(frozen=True)
class Game:
    match_id: str
    date: str
    side_a: str
    side_b: str
    side_a_won: int
    neutral: bool

    def __post_init__(self):
        if date.fromisoformat(self.date).isoformat() != self.date:
            raise ValueError("Noncanonical date")
        for value in (self.match_id, self.side_a, self.side_b):
            if not isinstance(value, str) or not value.strip() or len(value) > 120:
                raise ValueError("Invalid identity")
            if any(ord(c) < 32 for c in value):
                raise ValueError("Control character in identity")
        if (
            self.side_a == self.side_b
            or type(self.side_a_won) is not int
            or self.side_a_won not in (0, 1)
        ):
            raise ValueError("Expected distinct sides and a decisive binary outcome")
        if type(self.neutral) is not bool:
            raise ValueError("Neutral must be boolean")


def load_games(path: Path) -> list[Game]:
    games = []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        expected = {"match_id", "date", "side_a", "side_b", "side_a_won", "neutral"}
        if set(reader.fieldnames or []) != expected:
            raise ValueError("Unexpected match schema")
        for r in reader:
            if r["neutral"] not in ("0", "1"):
                raise ValueError("Invalid neutral field")
            games.append(
                Game(
                    r["match_id"],
                    r["date"],
                    r["side_a"],
                    r["side_b"],
                    int(r["side_a_won"]),
                    r["neutral"] == "1",
                )
            )
    if len(games) > 100000 or len({g.match_id for g in games}) != len(games):
        raise ValueError("Too many matches or duplicate match ID")
    return sorted(games, key=lambda g: (g.date, g.match_id))


def probability(a: float, b: float, advantage: float = 0, scale: float = 400) -> float:
    if not all(math.isfinite(v) for v in (a, b, advantage, scale)) or scale <= 0:
        raise ValueError("Invalid rating parameters")
    exponent = max(-40.0, min(40.0, (b - a - advantage) / scale))
    return max(1e-12, min(1 - 1e-12, 1 / (1 + 10**exponent)))


def metrics(rows: list[dict], key: str) -> dict:
    if not rows:
        raise ValueError("No evaluation matches")
    loss = brier = 0.0
    bins = [
        {
            "lower": i / 10,
            "upper": (i + 1) / 10,
            "n": 0,
            "predicted_sum": 0.0,
            "wins": 0,
        }
        for i in range(10)
    ]
    for r in rows:
        p, y = r[key], r["side_a_won"]
        if not math.isfinite(p) or not 0 < p < 1 or y not in (0, 1):
            raise ValueError("Invalid scored prediction")
        loss -= y * math.log(p) + (1 - y) * math.log1p(-p)
        brier += 2 * (p - y) ** 2
        bucket = bins[min(9, int(p * 10))]
        bucket["n"] += 1
        bucket["predicted_sum"] += p
        bucket["wins"] += y
    calibration = [
        {
            "lower": b["lower"],
            "upper": b["upper"],
            "n": b["n"],
            "mean_predicted": b["predicted_sum"] / b["n"] if b["n"] else None,
            "observed_frequency": b["wins"] / b["n"] if b["n"] else None,
        }
        for b in bins
    ]
    return {
        "n": len(rows),
        "log_loss": loss / len(rows),
        "summed_brier": brier / len(rows),
        "calibration": calibration,
    }


def replay(
    games: list[Game],
    *,
    evaluation_start: str,
    evaluation_end: str,
    k: float = 24,
    initial: float = 1500,
    scale: float = 400,
    home_advantage: float = 0,
) -> dict:
    if not evaluation_start < evaluation_end:
        raise ValueError("Invalid evaluation interval")
    date.fromisoformat(evaluation_start)
    date.fromisoformat(evaluation_end)
    if (
        not all(math.isfinite(v) for v in (k, initial, scale, home_advantage))
        or k <= 0
        or scale <= 0
    ):
        raise ValueError("Invalid replay parameters")
    if len({g.match_id for g in games}) != len(games):
        raise ValueError("Duplicate match ID")
    games = sorted(
        (g for g in games if g.date < evaluation_end),
        key=lambda g: (g.date, g.match_id),
    )
    training = [g for g in games if g.date < evaluation_start]
    if not training:
        raise ValueError("Training-only baseline needs a warmup population")
    baseline = max(0.01, min(0.99, sum(g.side_a_won for g in training) / len(training)))
    ratings: dict[str, float] = {}
    counts: dict[str, int] = defaultdict(int)
    last_seen: dict[str, str] = {}
    predictions = []
    history = []
    for day, batch_iterator in groupby(games, key=lambda g: g.date):
        batch = list(batch_iterator)
        # Missing ratings are read as initial without altering the pre-date state.
        pre_hash = hashlib.sha256(
            json.dumps(ratings, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        updates: dict[str, float] = defaultdict(float)
        for g in batch:
            a, b = ratings.get(g.side_a, initial), ratings.get(g.side_b, initial)
            advantage = 0 if g.neutral else home_advantage
            p = probability(a, b, advantage, scale)
            if day >= evaluation_start:
                predictions.append(
                    {
                        "match_id": g.match_id,
                        "date": day,
                        "side_a": g.side_a,
                        "side_b": g.side_b,
                        "side_a_won": g.side_a_won,
                        "probability_a": p,
                        "baseline_probability_a": baseline,
                        "rating_a_before": a,
                        "rating_b_before": b,
                        "home_advantage": advantage,
                        "pre_date_state_sha256": pre_hash,
                    }
                )
            change = k * (g.side_a_won - p)
            updates[g.side_a] += change
            updates[g.side_b] -= change
            counts[g.side_a] += 1
            counts[g.side_b] += 1
            last_seen[g.side_a] = last_seen[g.side_b] = day
        for side in sorted(updates):
            ratings[side] = ratings.get(side, initial) + updates[side]
        history.append(
            {
                "date": day,
                "matches": len(batch),
                "ratings": dict(sorted(ratings.items())),
            }
        )
    return {
        "training_matches": len(training),
        "baseline_probability_a": baseline,
        "evaluation_start": evaluation_start,
        "evaluation_end_exclusive": evaluation_end,
        "model_metrics": metrics(predictions, "probability_a"),
        "baseline_metrics": metrics(predictions, "baseline_probability_a"),
        "predictions": predictions,
        "history": history,
        "as_of": games[-1].date if games else None,
        "ratings": [
            {
                "side": side,
                "rating": rating,
                "matches": counts[side],
                "last_seen": last_seen[side],
            }
            for side, rating in sorted(
                ratings.items(), key=lambda pair: (-pair[1], pair[0])
            )
        ],
        "parameters": {
            "k": k,
            "initial": initial,
            "scale": scale,
            "home_advantage": home_advantage,
        },
        "scope": "Historical decisive-match replay. Every date scored before that date updates. Final ratings are as-of scenarios, not current or tournament-champion forecasts.",
    }

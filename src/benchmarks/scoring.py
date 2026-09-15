"""Proper scoring rules + paired significance tests for comparing two
probabilistic forecasters on the same matches.

Outcome order everywhere: (home win, draw, away win). That order is
*ordinal* (a draw is "between" the two wins), which is why the headline
metric is the Ranked Probability Score -- the standard for football
3-way forecasts (Constantinou & Fenton 2012): calling a 1-0 home win a
draw is penalized less than calling it an away win. Brier and log loss
ignore that ordering and are reported alongside.
"""

import math
import random

OUTCOMES = ("home_win", "draw", "away_win")


def outcome_index(home_score: int, away_score: int) -> int:
    if home_score > away_score:
        return 0
    if home_score == away_score:
        return 1
    return 2


def rps(probs: tuple[float, float, float], outcome: int) -> float:
    """Ranked Probability Score, 3 ordered categories, in [0, 1]."""
    actual = [1.0 if i == outcome else 0.0 for i in range(3)]
    cum_p = cum_a = total = 0.0
    for i in range(2):  # K-1 cumulative terms
        cum_p += probs[i]
        cum_a += actual[i]
        total += (cum_p - cum_a) ** 2
    return total / 2.0


def brier(probs: tuple[float, float, float], outcome: int) -> float:
    """Multi-class Brier score (sum over the 3 outcomes), in [0, 2]."""
    return sum((p - (1.0 if i == outcome else 0.0)) ** 2 for i, p in enumerate(probs))


def log_loss(probs: tuple[float, float, float], outcome: int, eps: float = 1e-6) -> float:
    return -math.log(max(probs[outcome], eps))


def correct(probs: tuple[float, float, float], outcome: int) -> float:
    return 1.0 if max(range(3), key=lambda i: probs[i]) == outcome else 0.0


METRICS = {"rps": rps, "brier": brier, "log_loss": log_loss, "accuracy": correct}


def normalize(probs) -> tuple[float, float, float]:
    total = sum(probs)
    return tuple(p / total for p in probs)


def paired_comparison(a: list[float], b: list[float], n_boot: int = 10_000, seed: int = 7) -> dict:
    """Mean of (a - b) per match, a percentile bootstrap 95% CI, and a
    two-sided paired sign-flip randomization p-value.

    With ~100 matches the honest question is not "which number is smaller"
    but "is the gap distinguishable from noise" -- the randomization test
    answers it without assuming normal per-match differences (score
    differences on football matches are heavily skewed by upsets)."""
    diffs = [x - y for x, y in zip(a, b)]
    n = len(diffs)
    mean = sum(diffs) / n
    rng = random.Random(seed)

    boots = sorted(sum(diffs[rng.randrange(n)] for _ in range(n)) / n for _ in range(n_boot))
    lo, hi = boots[int(0.025 * n_boot)], boots[int(0.975 * n_boot) - 1]

    extreme = 0
    for _ in range(n_boot):
        flipped = sum(d if rng.random() < 0.5 else -d for d in diffs) / n
        if abs(flipped) >= abs(mean) - 1e-12:
            extreme += 1

    sd = (sum((d - mean) ** 2 for d in diffs) / (n - 1)) ** 0.5 if n > 1 else 0.0
    # Matches needed to detect a gap this size (two-sided alpha=.05, 80%
    # power, normal approximation) -- "how far from conclusive is this?"
    n_for_power = math.ceil(((1.959964 + 0.841621) * sd / abs(mean)) ** 2) if mean else None

    return {
        "n": n,
        "mean_diff": mean,
        "sd_diff": sd,
        "ci95": [lo, hi],
        "p_value": (extreme + 1) / (n_boot + 1),
        "matches_for_80pct_power": n_for_power,
        "a_better_count": sum(1 for d in diffs if d < 0),
        "b_better_count": sum(1 for d in diffs if d > 0),
    }


def reliability(pairs: list[tuple[float, int]], n_bins: int = 5) -> dict:
    """Pooled one-vs-rest reliability: every (probability, happened?) pair
    from every outcome of every match, binned. Returns bins + ECE."""
    bins = [{"lo": i / n_bins, "hi": (i + 1) / n_bins, "n": 0, "sum_p": 0.0, "hits": 0} for i in range(n_bins)]
    for p, hit in pairs:
        b = bins[min(int(p * n_bins), n_bins - 1)]
        b["n"] += 1
        b["sum_p"] += p
        b["hits"] += hit
    total = sum(b["n"] for b in bins)
    ece = 0.0
    out = []
    for b in bins:
        if b["n"] == 0:
            continue
        mean_p, freq = b["sum_p"] / b["n"], b["hits"] / b["n"]
        ece += b["n"] / total * abs(mean_p - freq)
        out.append({"lo": b["lo"], "hi": b["hi"], "n": b["n"], "mean_predicted": mean_p, "observed_frequency": freq})
    return {"bins": out, "ece": ece}

"""Paired retrospective comparison helpers; not model-selection automation."""

import numpy as np


def error_vectors(y, p):
    y, p = np.asarray(y), np.asarray(p, dtype=float)
    if y.ndim != 1 or not len(y) or not set(y) <= {0, 1, 2}:
        raise ValueError("Invalid evaluation labels")
    if (
        p.shape != (len(y), 3)
        or not np.isfinite(p).all()
        or (p < 0).any()
        or (p > 1).any()
        or not np.allclose(p.sum(axis=1), 1, atol=1e-7, rtol=0)
    ):
        raise ValueError("Invalid evaluation probabilities")
    return np.column_stack(
        (
            -np.log(np.clip(p[np.arange(len(y)), y], 1e-15, 1)),
            np.square(p - np.eye(3)[y]).sum(axis=1),
        )
    )


def paired_weekly_interval(
    candidate_errors, baseline_errors, dates, *, resamples, seed
):
    candidate_errors, baseline_errors = (
        np.asarray(candidate_errors),
        np.asarray(baseline_errors),
    )
    if (
        candidate_errors.shape != baseline_errors.shape
        or candidate_errors.shape != (len(dates), 2)
        or not np.isfinite(candidate_errors - baseline_errors).all()
    ):
        raise ValueError("Paired finite error rows required")
    weeks = {}
    for i, day in enumerate(dates):
        iso = day.isocalendar()
        weeks.setdefault((iso.year, iso.week), []).append(i)
    if len(weeks) < 2 or resamples < 2:
        raise ValueError("At least two calendar-week clusters and resamples required")
    difference = candidate_errors - baseline_errors
    clusters = list(weeks.values())
    sums = np.asarray([difference[ids].sum(axis=0) for ids in clusters])
    counts = np.asarray([len(ids) for ids in clusters])
    chosen = np.random.default_rng(seed).integers(
        0, len(clusters), size=(resamples, len(clusters))
    )
    means = sums[chosen].sum(axis=1) / counts[chosen].sum(axis=1)[:, None]
    low, high = np.percentile(means, [2.5, 97.5], axis=0)
    return {
        "unit": "paired ISO calendar week",
        "clusters": len(clusters),
        "resamples": resamples,
        "seed": seed,
        "log_loss_delta": float(difference[:, 0].mean()),
        "brier_delta": float(difference[:, 1].mean()),
        "log_loss_ci95": [float(low[0]), float(high[0])],
        "brier_ci95": [float(low[1]), float(high[1])],
    }


def review_eligible(metrics, paired):
    temporal = metrics["temporal_stack"]
    return bool(
        paired["log_loss_ci95"][1] < 0
        and all(
            temporal[k] < metrics[baseline][k]
            for baseline in ("equal_weight_blend", "legacy_stratified_stack")
            for k in ("log_loss", "brier")
        )
    )

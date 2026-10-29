"""Execute the frozen CPU comparison, retaining all model/data evidence.

No serving promotion or external service calls. Use a new output directory for
every run; selection is saved before confirmation metrics are computed.
"""

import argparse
import hashlib
import importlib.metadata
import json
import pickle
import platform
import subprocess
import sys
import time
import traceback
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.features.data_loading import load_fifa_rankings, load_results
from src.features.team_timeline import build_timelines
from src.models.layer1_ensemble.ensemble import Layer1Ensemble
from src.models.layer1_ensemble.features import build_feature_row, build_training_set
from src.models.layer1_ensemble.lifecycle import governance_history
from src.models.layer1_ensemble.temporal import (
    FixedBlendClassifier,
    TemporalStackClassifier,
    make_members,
)
from src.models.layer1_ensemble.temporal_eval import (
    error_vectors,
    paired_weekly_interval,
    review_eligible,
)

PROTOCOL_COMMIT = "5c4d586dbd1bd2e2d658bb5b3e54bb39967d16bf"
PROTOCOL_PATH = "docs/temporal-stack-protocol.json"


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


def prediction_hash(value):
    return sha_bytes(np.asarray(value, dtype="<f8").tobytes())


def write_json(path, value):
    path.write_text(
        json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--outdir", type=Path, required=True)
    args = parser.parse_args()
    out = args.outdir.resolve()
    out.mkdir(parents=True, exist_ok=False)
    try:
        if subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT).strip():
            raise ValueError(
                "Commit the experiment source first; dirty source is not an evidence identity"
            )
        frozen = subprocess.check_output(
            ["git", "show", f"{PROTOCOL_COMMIT}:{PROTOCOL_PATH}"], cwd=ROOT
        )
        protocol = json.loads((ROOT / PROTOCOL_PATH).read_text())
        if protocol != json.loads(frozen):
            raise ValueError("Protocol differs from committed preregistration")
        source_sha = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip()
        manifest = {
            "source_sha": source_sha,
            "protocol_commit": PROTOCOL_COMMIT,
            "protocol_sha256_canonical": sha_bytes(
                json.dumps(protocol, sort_keys=True).encode()
            ),
            "python": platform.python_version(),
            "runtime": {
                p: importlib.metadata.version(p)
                for p in ("numpy", "scikit-learn", "xgboost")
            },
            "source_files": {
                str(p.relative_to(ROOT)): sha_bytes(p.read_bytes())
                for p in (ROOT / "src/models/layer1_ensemble").glob("*.py")
            },
            "data_files": {
                f: sha_bytes((ROOT / f).read_bytes())
                for f in (
                    "data/historical/results.csv",
                    "data/historical/fifa_ranking.csv",
                )
            },
        }
        write_json(out / "manifest.json", manifest)
        write_json(out / "protocol.json", protocol)
        start = date.fromisoformat(protocol["train_start"])
        cutoff = date.fromisoformat(protocol["train_end_exclusive"])
        final_end = date.fromisoformat(protocol["confirmation_end_exclusive"])
        matches = governance_history([m for m in load_results() if m.date < final_end])
        rankings = {
            t: [(d, p) for d, p in rows if d < final_end]
            for t, rows in load_fifa_rankings().items()
        }
        timelines = build_timelines(matches)
        X, y = build_training_set(matches, timelines, rankings, start, cutoff)
        X, y = np.asarray(X, dtype=float), np.asarray(y)
        training = [m for m in matches if start <= m.date < cutoff]
        dates = np.repeat([m.date for m in training], 2)
        groups = np.repeat(
            [f"{m.date.isoformat()}|{m.home_team}|{m.away_team}" for m in training], 2
        )
        np.savez_compressed(
            out / "training.npz",
            X=X,
            y=y,
            dates=np.asarray([d.isoformat() for d in dates]),
            groups=groups,
        )
        blocks = [
            tuple(date.fromisoformat(d) for d in block)
            for block in protocol["meta_validation_blocks"]
        ]
        params = protocol["xgb_params"]
        models, fit_seconds = {}, {}
        began = time.perf_counter()
        legacy = Layer1Ensemble(
            matches, timelines, rankings, start, cutoff, xgb_params=params
        )
        np.testing.assert_array_equal(legacy.X_train_, X)
        models["legacy_stratified_stack"] = legacy.stack
        fit_seconds["legacy_stratified_stack"] = time.perf_counter() - began
        began = time.perf_counter()
        models["equal_weight_blend"] = FixedBlendClassifier(make_members(params)).fit(
            X, y
        )
        fit_seconds["equal_weight_blend"] = time.perf_counter() - began
        began = time.perf_counter()
        temporal = TemporalStackClassifier(make_members(params), blocks).fit(
            X, y, dates=dates, groups=groups
        )
        models["temporal_stack"] = temporal
        fit_seconds["temporal_stack"] = time.perf_counter() - began
        write_json(out / "folds.json", temporal.folds_)
        np.savez_compressed(
            out / "out_of_fold.npz",
            predictions=temporal.oof_predictions_,
            mask=temporal.oof_mask_,
        )
        model_path = out / "models.pkl"
        model_path.write_bytes(pickle.dumps(models, protocol=5))
        bootstrap = protocol["bootstrap"]
        evaluation_X = {}

        def evaluate(label, begin, end):
            selected = [m for m in matches if begin <= m.date < end]
            eval_X = np.asarray(
                [
                    build_feature_row(
                        m.home_team, m.away_team, m.date, timelines, rankings, m.neutral
                    )
                    for m in selected
                ]
            )
            labels = np.asarray(
                [
                    2
                    if m.home_score > m.away_score
                    else 0
                    if m.home_score < m.away_score
                    else 1
                    for m in selected
                ]
            )
            evaluation_X[label] = eval_X
            predictions = {
                name: model.predict_proba(eval_X) for name, model in models.items()
            }
            errors = {name: error_vectors(labels, p) for name, p in predictions.items()}
            metrics = {
                name: {
                    "log_loss": float(e[:, 0].mean()),
                    "brier": float(e[:, 1].mean()),
                    "predictions_sha256_float64_le": prediction_hash(predictions[name]),
                }
                for name, e in errors.items()
            }
            paired = paired_weekly_interval(
                errors["temporal_stack"],
                errors["equal_weight_blend"],
                [m.date for m in selected],
                resamples=bootstrap["resamples"],
                seed=bootstrap["seed"],
            )
            # With fixed random seeds and the same full training, the two arms
            # must have identical final base members. Only their combination differs.
            for a, b in zip(
                temporal.estimators_, models["equal_weight_blend"].estimators_
            ):
                np.testing.assert_array_equal(
                    a.predict_proba(eval_X), b.predict_proba(eval_X)
                )
            rows = [
                {
                    "source_match": f"{m.date.isoformat()}|{m.home_team}|{m.away_team}",
                    "date": m.date.isoformat(),
                    "label": int(labels[i]),
                    "probabilities": {
                        name: p[i].tolist() for name, p in predictions.items()
                    },
                }
                for i, m in enumerate(selected)
            ]
            write_json(out / f"{label}-predictions.json", rows)
            result = {
                "start": begin.isoformat(),
                "end_exclusive": end.isoformat(),
                "n_matches": len(selected),
                "metrics": metrics,
                "temporal_minus_fixed": paired,
                "review_eligible": review_eligible(metrics, paired),
            }
            write_json(out / f"{label}.json", result)
            return result

        selection = evaluate(
            "selection",
            date.fromisoformat(protocol["selection_start"]),
            date.fromisoformat(protocol["selection_end_exclusive"]),
        )
        # Explicit persisted decision before reading/computing confirmation scores.
        write_json(
            out / "selection-decision.json",
            {
                "source_sha": source_sha,
                "eligible": selection["review_eligible"],
                "rule": protocol["review_eligibility"],
                "action": "Evaluate fixed confirmation once; no tuning, refitting or promotion",
            },
        )
        confirmation = evaluate(
            "confirmation",
            date.fromisoformat(protocol["confirmation_start"]),
            final_end,
        )
        np.savez_compressed(out / "evaluation_features.npz", **evaluation_X)
        child = "import sys,pickle,numpy as np,hashlib,json; models=pickle.load(open(sys.argv[1],'rb')); X=np.load(sys.argv[2])['selection']; print(json.dumps({n:hashlib.sha256(np.asarray(m.predict_proba(X),dtype='<f8').tobytes()).hexdigest() for n,m in models.items()}))"
        reloaded = json.loads(
            subprocess.check_output(
                [
                    sys.executable,
                    "-c",
                    child,
                    str(model_path),
                    str(out / "evaluation_features.npz"),
                ],
                cwd=ROOT,
                text=True,
            )
        )
        for name, value in reloaded.items():
            assert value == selection["metrics"][name]["predictions_sha256_float64_le"]
        summary = {
            "source_sha": source_sha,
            "protocol_commit": PROTOCOL_COMMIT,
            "training_matches": len(training),
            "training_rows": len(y),
            "meta_rows": int(temporal.oof_mask_.sum()),
            "burn_in_rows": temporal.burn_in_rows_,
            "fit_seconds_observed_not_benchmarked": fit_seconds,
            "selection": selection,
            "confirmation": confirmation,
            "eligible_for_human_review": bool(
                selection["review_eligible"] and confirmation["review_eligible"]
            ),
            "serving_changed": False,
            "separate_process_prediction_hashes": reloaded,
            "limits": protocol["limits"],
            "artifact_sha256": {
                p.name: sha_bytes(p.read_bytes()) for p in out.iterdir() if p.is_file()
            },
        }
        write_json(out / "summary.json", summary)
        print(json.dumps(summary, indent=2, allow_nan=False))
    except Exception as exc:
        write_json(
            out / "failure.json",
            {"error": str(exc), "traceback": traceback.format_exc()},
        )
        raise


if __name__ == "__main__":
    main()

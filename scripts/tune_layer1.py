"""One-time (periodic) Optuna hyperparameter tuning pass for Layer 1's
XGBoost member -- added after Dilip asked for the "best possible" model
performance and an honest MLOps-gap audit found there was no tuning step
anywhere in the pipeline (fit-and-ship only).

Tunes only the XGBoost member: the elo/logreg baseline has 2 features and
the FIFA heuristic isn't fit to data at all, so neither has meaningful
hyperparameters to search. Builds the training set ONCE, then runs many
stratified-CV trials over just the XGBoost fit -- cheap per trial since
the (much more expensive) feature-engineering pass isn't repeated.

Every trial is logged to MLflow as its own run (best-effort -- skipped if
the tracking server's unreachable, same as elsewhere in this project).
The winning params are written to data/tuning/best_xgb_params.json, which
ensemble.load_tuned_xgb_params() picks up automatically in daily_update.py,
backtest_2018_2022.py, and src/serving/app.py's fallback-training path --
falling back to the hardcoded defaults if this file doesn't exist, so
tuning is supplementary, never required to produce a prediction.

Run: python scripts/tune_layer1.py [--trials 30] [--cv-folds 3]
"""

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import numpy as np  # noqa: E402
import optuna  # noqa: E402
import xgboost as xgb  # noqa: E402
from sklearn.metrics import log_loss  # noqa: E402
from sklearn.model_selection import StratifiedKFold  # noqa: E402

from src.features.data_loading import load_fifa_rankings  # noqa: E402
from src.features.team_timeline import build_timelines  # noqa: E402
from src.ingestion import live_results_store  # noqa: E402
from src.models.layer1_ensemble import tracking  # noqa: E402
from src.models.layer1_ensemble.ensemble import TUNED_PARAMS_PATH  # noqa: E402
from src.models.layer1_ensemble.features import build_training_set  # noqa: E402

TRAIN_START = date(1992, 1, 1)
optuna.logging.set_verbosity(optuna.logging.WARNING)


def cv_log_loss(params: dict, X: np.ndarray, y: np.ndarray, cv_folds: int) -> float:
    skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
    losses = []
    for train_idx, val_idx in skf.split(X, y):
        model = xgb.XGBClassifier(objective="multi:softprob", num_class=3, eval_metric="mlogloss", **params)
        model.fit(X[train_idx], y[train_idx])
        proba = model.predict_proba(X[val_idx])
        losses.append(log_loss(y[val_idx], proba, labels=[0, 1, 2]))
    return float(np.mean(losses))


def make_objective(X, y, cv_folds: int, mlflow_reachable: bool):
    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 400),
            "max_depth": trial.suggest_int("max_depth", 2, 6),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
        }
        loss = cv_log_loss(params, X, y, cv_folds)

        if mlflow_reachable:
            import mlflow

            with mlflow.start_run(run_name=f"optuna_trial_{trial.number:03d}"):
                mlflow.log_params(params)
                mlflow.log_metric("cv_log_loss", loss)

        return loss

    return objective


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=30)
    parser.add_argument("--cv-folds", type=int, default=3)
    args = parser.parse_args()

    today = datetime.now(timezone.utc).date()
    print(f"=== Optuna tuning: Layer 1 XGBoost member ({args.trials} trials, {args.cv_folds}-fold CV) ===")

    matches = live_results_store.load_combined_matches()
    rankings = load_fifa_rankings()
    timelines = build_timelines(matches)

    X, y = build_training_set(matches, timelines, rankings, TRAIN_START, today)
    X, y = np.array(X), np.array(y)
    print(f"Training set: {len(X)} rows, {X.shape[1]} features")

    uri = tracking._tracking_uri()
    mlflow_reachable = tracking._is_reachable(uri)
    if mlflow_reachable:
        import mlflow

        mlflow.set_tracking_uri(uri)
        mlflow.set_experiment(tracking.EXPERIMENT_NAME)
        print(f"Logging each trial to MLflow at {uri} (experiment={tracking.EXPERIMENT_NAME})")
    else:
        print(f"[mlflow] unreachable at {uri}, trials will not be logged (tuning still proceeds)")

    study = optuna.create_study(direction="minimize", study_name="wc26-layer1-xgb-tuning")
    study.optimize(make_objective(X, y, args.cv_folds, mlflow_reachable), n_trials=args.trials)

    print(f"\nBest CV log loss: {study.best_value:.5f}")
    print(f"Best params: {study.best_params}")

    TUNED_PARAMS_PATH.parent.mkdir(parents=True, exist_ok=True)
    TUNED_PARAMS_PATH.write_text(
        json.dumps(
            {
                "params": study.best_params,
                "cv_log_loss": study.best_value,
                "n_trials": args.trials,
                "cv_folds": args.cv_folds,
                "tuned_at": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        )
    )
    print(f"Wrote {TUNED_PARAMS_PATH}")


if __name__ == "__main__":
    main()

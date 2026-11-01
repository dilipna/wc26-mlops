"""Experimental date-block stacking; not the serving/training default.

Burn-in rows train base members but never receive in-sample meta features.
All metadata is validated before any estimator is fitted.
"""

from datetime import date

import numpy as np
import xgboost as xgb
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer
from sklearn.utils.validation import check_is_fitted

from src.models.layer1_ensemble.ensemble import (
    DEFAULT_XGB_PARAMS,
    _FifaHeuristicEstimator,
    _select_columns,
)
from src.models.layer1_ensemble.features import ELO_IDX, NEUTRAL_IDX


def make_members(xgb_params):
    """Mirror the legacy members, with explicitly shared experiment settings."""
    return [
        (
            "xgboost",
            xgb.XGBClassifier(
                objective="multi:softprob",
                num_class=3,
                eval_metric="mlogloss",
                **{**DEFAULT_XGB_PARAMS, **xgb_params},
            ),
        ),
        (
            "elo_logreg",
            Pipeline(
                [
                    (
                        "select",
                        FunctionTransformer(
                            _select_columns, kw_args={"cols": [ELO_IDX, NEUTRAL_IDX]}
                        ),
                    ),
                    ("clf", LogisticRegression(max_iter=1000)),
                ]
            ),
        ),
        ("fifa_heuristic", _FifaHeuristicEstimator()),
    ]


def validate_xy(X, y):
    X, y = np.asarray(X, dtype=float), np.asarray(y)
    if X.ndim != 2 or len(X) != len(y) or y.ndim != 1 or not np.isfinite(X).all():
        raise ValueError("Invalid feature or label shape/values")
    if set(y) != {0, 1, 2}:
        raise ValueError("Training must contain loss/draw/win classes 0/1/2")
    return X, y


def probability_blocks(estimators, X):
    blocks = []
    for estimator in estimators:
        if list(estimator.classes_) != [0, 1, 2]:
            raise ValueError("Member class order mismatch")
        p = np.asarray(estimator.predict_proba(X), dtype=float)
        if (
            p.shape != (len(X), 3)
            or not np.isfinite(p).all()
            or (p < 0).any()
            or (p > 1).any()
            or not np.allclose(p.sum(axis=1), 1, rtol=0, atol=1e-7)
        ):
            raise ValueError("Invalid member probabilities")
        blocks.append(p)
    if not blocks:
        raise ValueError("At least one member required")
    return np.hstack(blocks)


def fit_members(estimators, X, y):
    names = [name for name, _ in estimators]
    if not names or len(set(names)) != len(names):
        raise ValueError("Unique member names required")
    return [clone(model).fit(X, y) for _, model in estimators]


class FixedBlendClassifier(ClassifierMixin, BaseEstimator):
    def __init__(self, estimators):
        self.estimators = estimators

    def fit(self, X, y):
        X, y = validate_xy(X, y)
        self.estimators_ = fit_members(self.estimators, X, y)
        self.named_estimators_ = dict(
            zip((n for n, _ in self.estimators), self.estimators_)
        )
        self.classes_ = np.asarray([0, 1, 2])
        self.n_features_in_ = X.shape[1]
        probability_blocks(self.estimators_, X)
        return self

    def predict_proba(self, X):
        check_is_fitted(self, "estimators_")
        X = np.asarray(X, dtype=float)
        if X.ndim != 2 or X.shape[1] != self.n_features_in_ or not np.isfinite(X).all():
            raise ValueError("Invalid prediction features")
        blocks = probability_blocks(self.estimators_, X)
        return blocks.reshape(len(X), len(self.estimators_), 3).mean(axis=1)

    def predict(self, X):
        return self.classes_[self.predict_proba(X).argmax(axis=1)]


class TemporalStackClassifier(ClassifierMixin, BaseEstimator):
    def __init__(self, estimators, validation_blocks, final_estimator=None):
        self.estimators = estimators
        self.validation_blocks = validation_blocks
        self.final_estimator = final_estimator

    def fit(self, X, y, *, dates, groups):
        X, y = validate_xy(X, y)
        dates, groups = (
            np.asarray(dates, dtype=object),
            np.asarray(groups, dtype=object),
        )
        if (
            dates.shape != (len(y),)
            or groups.shape != (len(y),)
            or any(type(d) is not date for d in dates)
        ):
            raise ValueError("One date and source-match group per row required")
        group_dates = {}
        for group, day in zip(groups, dates):
            if group in group_dates and group_dates[group] != day:
                raise ValueError("One source match spans different dates")
            group_dates[group] = day
        partitions, covered, prior_end = [], np.zeros(len(y), dtype=bool), None
        if not self.validation_blocks:
            raise ValueError("At least one validation block required")
        for start, end in self.validation_blocks:
            if (
                type(start) is not date
                or type(end) is not date
                or not start < end
                or (prior_end is not None and start != prior_end)
            ):
                raise ValueError("Ordered, contiguous date blocks required")
            train = np.flatnonzero(dates < start)
            val = np.flatnonzero((dates >= start) & (dates < end))
            if not len(train) or not len(val) or set(y[train]) != {0, 1, 2}:
                raise ValueError(
                    "Each block needs earlier training with all classes and nonempty validation"
                )
            if set(groups[train]) & set(groups[val]) or covered[val].any():
                raise ValueError("Source-match or validation overlap")
            covered[val] = True
            partitions.append((train, val))
            prior_end = end
        if set(y[covered]) != {0, 1, 2}:
            raise ValueError("Meta-training must contain all classes")
        if any(d >= prior_end for d in dates):
            raise ValueError("Trailing training rows lack a declared validation block")

        self.oof_predictions_ = np.full((len(y), 3 * len(self.estimators)), np.nan)
        self.folds_ = []
        for train, val in partitions:
            members = fit_members(self.estimators, X[train], y[train])
            self.oof_predictions_[val] = probability_blocks(members, X[val])
            self.folds_.append(
                {
                    "train_rows": train.tolist(),
                    "validation_rows": val.tolist(),
                    "max_training_date": max(dates[train]).isoformat(),
                    "min_validation_date": min(dates[val]).isoformat(),
                    "training_groups": len(set(groups[train])),
                    "validation_groups": len(set(groups[val])),
                    "source_match_overlap": 0,
                }
            )
        self.oof_mask_ = covered
        self.burn_in_rows_ = int((~covered).sum())
        self.final_estimator_ = (
            clone(self.final_estimator)
            if self.final_estimator is not None
            else LogisticRegression(max_iter=1000)
        )
        self.final_estimator_.fit(self.oof_predictions_[covered], y[covered])
        self.estimators_ = fit_members(self.estimators, X, y)
        self.named_estimators_ = dict(
            zip((n for n, _ in self.estimators), self.estimators_)
        )
        self.classes_ = np.asarray([0, 1, 2])
        self.n_features_in_ = X.shape[1]
        if list(self.final_estimator_.classes_) != [0, 1, 2]:
            raise ValueError("Meta class order mismatch")
        return self

    def predict_proba(self, X):
        check_is_fitted(self, "estimators_")
        X = np.asarray(X, dtype=float)
        if X.ndim != 2 or X.shape[1] != self.n_features_in_ or not np.isfinite(X).all():
            raise ValueError("Invalid prediction features")
        blocks = probability_blocks(self.estimators_, X)
        # The same probability validator also checks the final estimator.
        return probability_blocks([self.final_estimator_], blocks)

    def predict(self, X):
        return self.classes_[self.predict_proba(X).argmax(axis=1)]

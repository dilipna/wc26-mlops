import pickle
from datetime import date, timedelta

import numpy as np
import pytest
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.dummy import DummyClassifier

from src.models.layer1_ensemble.temporal import (
    FixedBlendClassifier,
    TemporalStackClassifier,
)
from src.models.layer1_ensemble.temporal_eval import (
    error_vectors,
    paired_weekly_interval,
    review_eligible,
)


class RecordingClassifier(ClassifierMixin, BaseEstimator):
    def fit(self, X, y):
        self.classes_ = np.asarray([0, 1, 2])
        self.seen_X_ = np.asarray(X).copy()
        counts = np.bincount(y, minlength=3) + 1
        self.prior_ = counts / counts.sum()
        return self

    def predict_proba(self, X):
        return np.tile(self.prior_, (len(X), 1))


class BadProbabilities(RecordingClassifier):
    def predict_proba(self, X):
        return np.tile([float("nan"), 0.2, 0.8], (len(X), 1))


@pytest.fixture
def data():
    X = np.column_stack((np.arange(18), np.ones(18)))
    y = np.tile([0, 1, 2], 6)
    dates = np.repeat([date(2020, 1, 1) + timedelta(days=i) for i in range(9)], 2)
    groups = np.repeat([f"match-{i}" for i in range(9)], 2)
    return X, y, dates, groups


def model(blocks=None, member=None):
    return TemporalStackClassifier(
        [("record", member if member is not None else RecordingClassifier())],
        blocks
        if blocks is not None
        else [
            (date(2020, 1, 4), date(2020, 1, 7)),
            (date(2020, 1, 7), date(2020, 1, 10)),
        ],
        final_estimator=RecordingClassifier(),
    )


def test_burn_in_excluded_no_group_or_date_overlap_and_final_refit(data):
    X, y, dates, groups = data
    fitted = model().fit(X, y, dates=dates, groups=groups)
    assert fitted.burn_in_rows_ == 6
    assert np.isnan(fitted.oof_predictions_[:6]).all()
    assert np.isfinite(fitted.oof_predictions_[6:]).all()
    np.testing.assert_array_equal(
        fitted.final_estimator_.seen_X_, fitted.oof_predictions_[fitted.oof_mask_]
    )
    np.testing.assert_array_equal(fitted.estimators_[0].seen_X_, X)
    validation = []
    for fold in fitted.folds_:
        train, val = fold["train_rows"], fold["validation_rows"]
        assert max(dates[train]) < min(dates[val])
        assert not set(groups[train]) & set(groups[val])
        assert fold["source_match_overlap"] == 0
        validation.extend(val)
    assert sorted(validation) == list(range(6, 18))


@pytest.mark.parametrize(
    "defect",
    [
        "date-length",
        "group-length",
        "cross-date-group",
        "overlap",
        "gap",
        "trailing",
        "missing-class",
        "nonfinite",
        "no-blocks",
    ],
)
def test_metadata_and_invalid_training_fail_before_fit(data, defect):
    X, y, dates, groups = [a.copy() for a in data]
    fitted = model()
    if defect == "date-length":
        dates = dates[:-1]
    elif defect == "group-length":
        groups = groups[:-1]
    elif defect == "cross-date-group":
        groups[6] = groups[0]
    elif defect == "overlap":
        fitted.validation_blocks = [
            (date(2020, 1, 4), date(2020, 1, 8)),
            (date(2020, 1, 7), date(2020, 1, 10)),
        ]
    elif defect == "gap":
        fitted.validation_blocks = [
            (date(2020, 1, 4), date(2020, 1, 6)),
            (date(2020, 1, 7), date(2020, 1, 10)),
        ]
    elif defect == "trailing":
        fitted.validation_blocks = [(date(2020, 1, 4), date(2020, 1, 7))]
    elif defect == "missing-class":
        y[:6] = 0
    elif defect == "nonfinite":
        X[0, 0] = np.nan
    else:
        fitted.validation_blocks = []
    with pytest.raises(ValueError):
        fitted.fit(X, y, dates=dates, groups=groups)
    assert not hasattr(fitted, "estimators_")


def test_invalid_member_predictions_are_rejected(data):
    X, y, dates, groups = data
    with pytest.raises(ValueError, match="probabilities"):
        model(member=BadProbabilities()).fit(X, y, dates=dates, groups=groups)


def test_row_permutation_preserves_membership_and_prediction(data):
    X, y, dates, groups = data
    first = model().fit(X, y, dates=dates, groups=groups)
    order = np.random.default_rng(3).permutation(len(y))
    second = model().fit(X[order], y[order], dates=dates[order], groups=groups[order])
    np.testing.assert_array_equal(first.predict_proba(X), second.predict_proba(X))
    assert second.burn_in_rows_ == first.burn_in_rows_


def test_serialization_retains_predictions_and_split_evidence(data):
    X, y, dates, groups = data
    fitted = model().fit(X, y, dates=dates, groups=groups)
    restored = pickle.loads(pickle.dumps(fitted))
    np.testing.assert_array_equal(fitted.predict_proba(X), restored.predict_proba(X))
    assert restored.folds_ == fitted.folds_


def test_fixed_blend_uses_predeclared_equal_weights(data):
    X, y, _, _ = data
    blend = FixedBlendClassifier(
        [
            ("a", DummyClassifier(strategy="uniform")),
            ("b", DummyClassifier(strategy="constant", constant=2)),
        ]
    ).fit(X, y)
    np.testing.assert_allclose(
        blend.predict_proba(X), np.tile([1 / 6, 1 / 6, 2 / 3], (len(y), 1))
    )


def test_probability_metric_arithmetic():
    y = np.asarray([0, 1, 2])
    np.testing.assert_array_equal(error_vectors(y, np.eye(3)), np.zeros((3, 2)))
    np.testing.assert_allclose(
        error_vectors(y, np.ones((3, 3)) / 3), np.tile([np.log(3), 2 / 3], (3, 1))
    )
    with pytest.raises(ValueError):
        error_vectors(y, np.ones((3, 3)))


def test_paired_weekly_bootstrap_keeps_rows_together_and_is_deterministic():
    dates = [date(2020, 1, 1), date(2020, 1, 1), date(2020, 1, 10), date(2020, 1, 10)]
    base = np.ones((4, 2))
    better = base - np.asarray([0.2, 0.1])
    result = paired_weekly_interval(better, base, dates, resamples=100, seed=7)
    assert result == paired_weekly_interval(better, base, dates, resamples=100, seed=7)
    assert result["clusters"] == 2
    np.testing.assert_allclose(result["log_loss_ci95"], [-0.2, -0.2])
    np.testing.assert_allclose(result["brier_ci95"], [-0.1, -0.1])
    with pytest.raises(ValueError):
        paired_weekly_interval(better, base, [dates[0]] * 4, resamples=100, seed=7)


def test_review_requires_improvement_and_uncertainty_check():
    metrics = {
        "temporal_stack": {"log_loss": 0.8, "brier": 0.4},
        "equal_weight_blend": {"log_loss": 0.9, "brier": 0.5},
        "legacy_stratified_stack": {"log_loss": 0.85, "brier": 0.45},
    }
    assert review_eligible(metrics, {"log_loss_ci95": [-0.2, -0.01]})
    assert not review_eligible(metrics, {"log_loss_ci95": [-0.2, 0.01]})
    metrics["legacy_stratified_stack"]["brier"] = 0.39
    assert not review_eligible(metrics, {"log_loss_ci95": [-0.2, -0.01]})

from datetime import date

import numpy as np
import xgboost as xgb
from sklearn.ensemble import StackingClassifier
from sklearn.linear_model import LogisticRegression

from src.models.layer1_ensemble.ensemble import Layer1Ensemble
from src.models.layer1_ensemble.features import FEATURE_NAMES


class _FakeXgb:
    feature_importances_ = np.array([0.5, 0.2, 0.1, 0.1, 0.05, 0.05])


class _FakeEnsemble:
    xgb = _FakeXgb()


def test_xgb_feature_importance_maps_scores_to_feature_names():
    # Exercises the real mapping logic without paying for a full
    # StackingClassifier fit (cv=5 needs real data volume -- see
    # ensemble.py's __init__) -- xgb_feature_importance only reads
    # self.xgb.feature_importances_, so a stub is enough to test it.
    result = Layer1Ensemble.xgb_feature_importance(_FakeEnsemble())
    assert list(result.keys()) == FEATURE_NAMES
    assert result["elo_diff"] == 0.5
    assert abs(sum(result.values()) - 1.0) < 1e-9


def test_shap_values_for_match_sums_to_the_real_prediction(monkeypatch):
    # A small real stack (not a stub) -- shap_values_for_match calls
    # self.stack.predict_proba directly (the model-agnostic Exact
    # explainer's whole point), so it needs a genuinely fitted model, not
    # a fake with only feature_importances_ like the test above.
    rng = np.random.default_rng(0)
    X_train = rng.normal(size=(60, len(FEATURE_NAMES)))
    y_train = rng.integers(0, 3, size=60)

    stack = StackingClassifier(
        estimators=[
            ("xgboost", xgb.XGBClassifier(
                objective="multi:softprob", num_class=3, eval_metric="mlogloss", n_estimators=10, max_depth=2
            )),
            ("elo_logreg", LogisticRegression(max_iter=1000)),
            ("fifa_heuristic", LogisticRegression(max_iter=1000)),
        ],
        final_estimator=LogisticRegression(max_iter=1000),
        cv=3,
        stack_method="predict_proba",
    )
    stack.fit(X_train, y_train)

    fake = _FakeEnsemble()
    fake.stack = stack
    fake.X_train_ = X_train
    fake.timelines = object()
    fake.rankings = object()

    fixed_row = [0.3, 0.1, -0.05, 0.02, 0.4, 1.0]
    monkeypatch.setattr(
        "src.models.layer1_ensemble.ensemble.build_feature_row",
        lambda team_a, team_b, as_of, timelines, rankings, neutral: fixed_row,
    )

    result = Layer1Ensemble.shap_values_for_match(fake, "Argentina", "France", date(2026, 7, 5))

    assert result["team_a"] == "Argentina"
    assert result["team_b"] == "France"
    assert set(result["shap_values"].keys()) == set(FEATURE_NAMES)
    assert set(result["base_values"].keys()) == {"loss", "draw", "win"}
    assert result["feature_values"] == dict(zip(FEATURE_NAMES, fixed_row))

    # The core SHAP guarantee: base value + sum of per-feature contributions
    # equals the model's actual predicted probability for that outcome.
    pred = stack.predict_proba(np.array(fixed_row).reshape(1, -1))[0]
    for i, outcome in enumerate(["loss", "draw", "win"]):
        total = result["base_values"][outcome] + sum(v[outcome] for v in result["shap_values"].values())
        assert abs(total - pred[i]) < 1e-6

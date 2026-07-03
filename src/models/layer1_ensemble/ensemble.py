"""Layer 1: stacked ensemble of XGBoost + Elo/logistic-regression baseline +
FIFA-rank heuristic, blended by a trained logistic meta-learner over each
member's out-of-fold class probabilities (sklearn's StackingClassifier).
Not shipping XGBoost alone as "the ensemble" per CLAUDE.md, and not just
equal-weight averaging the three members either -- the meta-learner learns
how much to trust each one (see DECISIONS.md: "stacked meta-learner").
"""

from datetime import date

import numpy as np
import xgboost as xgb
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.ensemble import StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer

from src.models.layer1_ensemble.features import (
    ELO_IDX,
    NEUTRAL_IDX,
    RANK_IDX,
    build_feature_row,
    build_training_set,
)
from src.models.layer1_ensemble.heuristic import fifa_heuristic_probs

STACK_CV_FOLDS = 5


class _FifaHeuristicEstimator(BaseEstimator, ClassifierMixin):
    """Wraps the closed-form FIFA heuristic as an sklearn-compatible
    classifier so it can sit inside StackingClassifier alongside the two
    trained members. fit() is a no-op -- the heuristic isn't fit to data,
    see heuristic.py."""

    def fit(self, X, y):
        self.classes_ = np.array([0, 1, 2])
        return self

    def predict_proba(self, X):
        X = np.asarray(X)
        return np.array([fifa_heuristic_probs(row[RANK_IDX]) for row in X])

    def predict(self, X):
        return self.classes_[np.argmax(self.predict_proba(X), axis=1)]


def _select_columns(X, cols):
    return np.asarray(X)[:, cols]


class Layer1Ensemble:
    def __init__(
        self,
        matches,
        timelines,
        rankings,
        train_start: date,
        train_end: date,
    ):
        self.timelines = timelines
        self.rankings = rankings

        X, y = build_training_set(matches, timelines, rankings, train_start, train_end)
        X = np.array(X)
        y = np.array(y)
        # Kept for cheap in-sample sanity metrics (e.g. MLflow logging) --
        # NOT a substitute for the held-out backtest evaluation.
        self.X_train_ = X
        self.y_train_ = y

        elo_logreg = Pipeline(
            [
                ("select", FunctionTransformer(_select_columns, kw_args={"cols": [ELO_IDX, NEUTRAL_IDX]})),
                ("clf", LogisticRegression(max_iter=1000)),
            ]
        )
        xgb_member = xgb.XGBClassifier(
            objective="multi:softprob",
            num_class=3,
            n_estimators=200,
            max_depth=4,
            learning_rate=0.1,
            eval_metric="mlogloss",
        )
        heuristic_member = _FifaHeuristicEstimator()

        self.stack = StackingClassifier(
            estimators=[
                ("xgboost", xgb_member),
                ("elo_logreg", elo_logreg),
                ("fifa_heuristic", heuristic_member),
            ],
            final_estimator=LogisticRegression(max_iter=1000),
            cv=STACK_CV_FOLDS,
            stack_method="predict_proba",
            passthrough=False,
        )
        self.stack.fit(X, y)

        # Kept for direct access (e.g. the un-blended baseline path uses the
        # heuristic directly, not through the stack).
        self.xgb = self.stack.named_estimators_["xgboost"]
        self.logreg = self.stack.named_estimators_["elo_logreg"]

    def match_probs(self, team_a: str, team_b: str, as_of: date, neutral: bool = True):
        """(p_loss, p_draw, p_win) for team_a, from the stacked ensemble."""
        row = build_feature_row(team_a, team_b, as_of, self.timelines, self.rankings, neutral)
        probs = self.stack.predict_proba(np.array(row).reshape(1, -1))[0]
        return tuple(probs)

    def baseline_match_probs(self, team_a: str, team_b: str, as_of: date, neutral: bool = True):
        """(p_loss, p_draw, p_win) for team_a, from the FIFA-heuristic
        member alone -- the trivial baseline the ensemble must beat."""
        row = build_feature_row(team_a, team_b, as_of, self.timelines, self.rankings, neutral)
        return fifa_heuristic_probs(row[RANK_IDX])

    def advance_probability(self, team_a: str, team_b: str, as_of: date) -> float:
        """P(team_a advances) in a knockout match: win + half the draw mass
        (see DECISIONS.md: knockout draw resolution)."""
        p_loss, p_draw, p_win = self.match_probs(team_a, team_b, as_of, neutral=True)
        return p_win + 0.5 * p_draw

    def baseline_advance_probability(self, team_a: str, team_b: str, as_of: date) -> float:
        p_loss, p_draw, p_win = self.baseline_match_probs(team_a, team_b, as_of, neutral=True)
        return p_win + 0.5 * p_draw

    def meta_learner_weights(self) -> dict:
        """The stacking meta-learner's learned coefficients, for
        interpretability/logging (e.g. to MLflow) -- how much it ended up
        trusting each member, per class."""
        final = self.stack.final_estimator_
        return {
            "member_order": [name for name, _ in self.stack.estimators],
            "classes": final.classes_.tolist(),
            "coef": final.coef_.tolist(),
            "intercept": final.intercept_.tolist(),
        }

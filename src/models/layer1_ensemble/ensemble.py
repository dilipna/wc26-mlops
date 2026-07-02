"""Layer 1: stacked ensemble of XGBoost + Elo/logistic-regression baseline +
FIFA-rank heuristic, blended by equal-weighted average (see DECISIONS.md).
Not shipping XGBoost alone as "the ensemble" per CLAUDE.md.
"""

from datetime import date

import numpy as np
import xgboost as xgb
from sklearn.linear_model import LogisticRegression

from src.models.layer1_ensemble.features import (
    ELO_IDX,
    NEUTRAL_IDX,
    RANK_IDX,
    build_feature_row,
    build_training_set,
)
from src.models.layer1_ensemble.heuristic import fifa_heuristic_probs


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

        self.logreg = LogisticRegression(max_iter=1000)
        self.logreg.fit(X[:, [ELO_IDX, NEUTRAL_IDX]], y)

        self.xgb = xgb.XGBClassifier(
            objective="multi:softprob",
            num_class=3,
            n_estimators=200,
            max_depth=4,
            learning_rate=0.1,
            eval_metric="mlogloss",
        )
        self.xgb.fit(X, y)

    def _member_probs(self, row: list[float]) -> dict[str, np.ndarray]:
        row_arr = np.array(row).reshape(1, -1)
        logreg_probs = self.logreg.predict_proba(row_arr[:, [ELO_IDX, NEUTRAL_IDX]])[0]
        xgb_probs = self.xgb.predict_proba(row_arr)[0]
        heuristic_probs = np.array(fifa_heuristic_probs(row[RANK_IDX]))
        return {"elo_logreg": logreg_probs, "xgboost": xgb_probs, "fifa_heuristic": heuristic_probs}

    def match_probs(self, team_a: str, team_b: str, as_of: date, neutral: bool = True):
        """(p_loss, p_draw, p_win) for team_a, from the blended ensemble."""
        row = build_feature_row(team_a, team_b, as_of, self.timelines, self.rankings, neutral)
        members = self._member_probs(row)
        blended = sum(members.values()) / len(members)
        blended = blended / blended.sum()
        return tuple(blended)

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

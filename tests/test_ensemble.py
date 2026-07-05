import numpy as np

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

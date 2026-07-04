import json

from src.models.layer1_ensemble import ensemble


def test_load_tuned_xgb_params_missing_file_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(ensemble, "TUNED_PARAMS_PATH", tmp_path / "best_xgb_params.json")
    assert ensemble.load_tuned_xgb_params() is None


def test_load_tuned_xgb_params_reads_params(tmp_path, monkeypatch):
    path = tmp_path / "best_xgb_params.json"
    path.write_text(json.dumps({"params": {"max_depth": 3, "n_estimators": 250}, "cv_log_loss": 0.9}))
    monkeypatch.setattr(ensemble, "TUNED_PARAMS_PATH", path)

    assert ensemble.load_tuned_xgb_params() == {"max_depth": 3, "n_estimators": 250}


def test_load_tuned_xgb_params_malformed_json_returns_none(tmp_path, monkeypatch):
    path = tmp_path / "best_xgb_params.json"
    path.write_text("not valid json")
    monkeypatch.setattr(ensemble, "TUNED_PARAMS_PATH", path)

    assert ensemble.load_tuned_xgb_params() is None


def test_load_tuned_xgb_params_missing_params_key_returns_none(tmp_path, monkeypatch):
    path = tmp_path / "best_xgb_params.json"
    path.write_text(json.dumps({"cv_log_loss": 0.9}))
    monkeypatch.setattr(ensemble, "TUNED_PARAMS_PATH", path)

    assert ensemble.load_tuned_xgb_params() is None

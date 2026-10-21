"""Governance correctness tests; synthetic probabilities are not forecast results."""

import json
import os
import sqlite3
import subprocess
import sys
from dataclasses import replace
from datetime import date, timedelta
from types import SimpleNamespace

import numpy as np
import pytest
from sklearn.dummy import DummyClassifier

from src.features.data_loading import Match
from src.models.layer1_ensemble.lifecycle import GovernanceError, ModelStore

SHA = "a" * 40
START, END = date(2021, 1, 1), date(2022, 1, 1)
TRAIN_START, TRAIN_END = date(2019, 1, 1), date(2020, 1, 1)


@pytest.fixture
def matches():
    return [
        Match(date(2019, 1, 1) + timedelta(days=i), "A", "B", 2, 0, "synthetic", True)
        for i in range(30)
    ] + [
        Match(START + timedelta(days=i), "A", "B", 2, 0, "synthetic", True)
        for i in range(30)
    ]


def register(store, matches, strength=8, train_end=TRAIN_END):
    y = np.asarray([0, 1] + [2] * strength)
    stack = DummyClassifier(strategy="prior").fit(np.zeros((len(y), 6)), y)
    return store.register(
        SimpleNamespace(stack=stack),
        train_start=TRAIN_START,
        train_end=train_end,
        matches=matches,
        source_sha=SHA,
    )


def evaluate(store, model_id, matches, **kwargs):
    return store.evaluate(
        model_id,
        matches=matches,
        rankings={},
        start=START,
        end=END,
        actor="test-operator",
        reason="synthetic acceptance fixture",
        **kwargs,
    )


def bootstrap(store, matches):
    first = register(store, matches, 1)
    assert evaluate(store, first, matches, approve=True, bootstrap=True)["approved"]
    return first


def test_registration_and_dry_run_do_not_approve(tmp_path, matches):
    store = ModelStore(tmp_path)
    candidate = register(store, matches)
    report = evaluate(store, candidate, matches, bootstrap=True)
    assert report["eligible"] and not report["approved"]
    assert store.active()["model_id"] is None
    assert not evaluate(store, candidate, matches, approve=True)["eligible"]
    with pytest.raises(GovernanceError, match="No approved"):
        store.load_approved()


def test_worse_and_equal_candidates_cannot_replace_incumbent(tmp_path, matches):
    store = ModelStore(tmp_path)
    with pytest.raises(GovernanceError, match="class order"):
        register(store, matches, 0)


def test_pairwise_promotion_and_exact_rollback_persist_across_restart(
    tmp_path, matches
):
    store = ModelStore(tmp_path)
    first = bootstrap(store, matches)
    second = register(store, matches, 8)
    report = evaluate(store, second, matches, approve=True)
    assert report["approved"]
    assert all(
        report["candidate"][k] < report["incumbent_metrics"][k]
        for k in ("log_loss", "brier")
    )
    restarted = ModelStore(tmp_path)
    assert restarted.load_approved()[1]["model_id"] == second
    restarted.rollback(
        first, actor="operator", reason="rehearsal", expected_generation=2
    )
    loaded, identity = ModelStore(tmp_path).load_approved()
    assert identity["model_id"] == first and identity["generation"] == 3
    original, _ = store.load(first)
    np.testing.assert_array_equal(
        loaded.stack.predict_proba([[0] * 6]), original.stack.predict_proba([[0] * 6])
    )
    with sqlite3.connect(tmp_path / "governance.sqlite") as db:
        events = db.execute(
            "SELECT action, report FROM events ORDER BY generation"
        ).fetchall()
    assert [r[0] for r in events] == ["bootstrap", "promote", "rollback"]
    assert json.loads(events[1][1])["selection_sha256"] == report["selection_sha256"]


def test_inferior_candidate_and_tie_leave_approval_unchanged(tmp_path, matches):
    store = ModelStore(tmp_path)
    incumbent = register(store, matches, 8)
    evaluate(store, incumbent, matches, bootstrap=True, approve=True)
    before = store.active()
    for candidate in (register(store, matches, 1), incumbent):
        assert not evaluate(store, candidate, matches, approve=True)["approved"]
        assert store.active() == before


def test_stale_approval_and_unapproved_rollback_rejected(tmp_path, matches):
    store = ModelStore(tmp_path)
    first = bootstrap(store, matches)
    second = register(store, matches, 8)
    with pytest.raises(GovernanceError, match="previously approved"):
        store.rollback(
            second, actor="operator", reason="not approved", expected_generation=1
        )
    evaluate(store, second, matches, approve=True)
    with pytest.raises(GovernanceError, match="Stale incumbent"):
        store.rollback(first, actor="operator", reason="stale", expected_generation=1)
    assert store.active()["model_id"] == second


def test_stale_incumbent_during_evaluation_cannot_be_overwritten(
    tmp_path, matches, monkeypatch
):
    store = ModelStore(tmp_path)
    first = bootstrap(store, matches)
    second = register(store, matches, 8)
    commit = store._commit

    def intervening_approval(*args, **kwargs):
        ModelStore(tmp_path).rollback(
            first, actor="other", reason="concurrent update", expected_generation=1
        )
        return commit(*args, **kwargs)

    monkeypatch.setattr(store, "_commit", intervening_approval)
    with pytest.raises(GovernanceError, match="Stale incumbent"):
        evaluate(store, second, matches, approve=True)
    assert store.active() == {"generation": 2, "model_id": first}


def test_training_overlap_rejected(tmp_path, matches):
    store = ModelStore(tmp_path)
    candidate = register(store, matches, train_end=START + timedelta(days=1))
    with pytest.raises(GovernanceError, match="overlaps"):
        evaluate(store, candidate, matches, bootstrap=True, approve=True)
    assert store.active()["model_id"] is None


@pytest.mark.parametrize("change", ["conflict", "revised-training", "too-small"])
def test_invalid_data_rejected(tmp_path, matches, change):
    store = ModelStore(tmp_path)
    candidate = register(store, matches)
    altered = list(matches)
    if change == "conflict":
        altered.append(replace(matches[-1], home_score=0))
    elif change == "revised-training":
        altered[0] = replace(matches[0], home_score=3)
    else:
        altered = matches[:-1]
    with pytest.raises(GovernanceError):
        evaluate(store, candidate, altered, bootstrap=True, approve=True)
    assert store.active()["model_id"] is None


def test_exact_duplicates_do_not_inflate_sample_floor(tmp_path, matches):
    store = ModelStore(tmp_path)
    candidate = register(store, matches)
    report = evaluate(store, candidate, matches + [matches[-1]])
    assert report["n_matches"] == 30 and report["input_duplicates_removed"] == 1
    with pytest.raises(GovernanceError, match="30 distinct"):
        evaluate(store, candidate, matches[:-1] + [matches[-2]] * 10)


@pytest.mark.parametrize("corruption", ["bytes", "missing", "manifest"])
def test_approved_corruption_fails_closed(tmp_path, matches, corruption):
    store = ModelStore(tmp_path)
    first = bootstrap(store, matches)
    _, manifest = store.load(first)
    artifact = tmp_path / f"{manifest['artifact_sha256']}.pkl"
    if corruption == "bytes":
        artifact.write_bytes(b"corrupt")
    elif corruption == "missing":
        artifact.unlink()
    else:
        with store.connect() as db:
            db.execute("UPDATE candidates SET manifest=? WHERE id=?", ("{}", first))
    with pytest.raises((GovernanceError, FileNotFoundError)):
        ModelStore(tmp_path).load_approved()


def test_separate_process_load_without_mlflow_or_training(tmp_path, matches):
    first = bootstrap(ModelStore(tmp_path), matches)
    script = "from src.models.layer1_ensemble.lifecycle import ModelStore; import json; m,i=ModelStore().load_approved(); print(json.dumps({'id':i['model_id'],'p':m.stack.predict_proba([[0]*6]).tolist()}))"
    env = {
        **os.environ,
        "WC26_MODEL_STORE": str(tmp_path),
        "MLFLOW_TRACKING_URI": "http://127.0.0.1:1",
    }
    result = json.loads(
        subprocess.check_output([sys.executable, "-c", script], env=env, text=True)
    )
    assert result["id"] == first
    np.testing.assert_allclose(result["p"], [[1 / 3] * 3])


def test_serving_state_never_calls_latest_or_trains(tmp_path, matches, monkeypatch):
    import src.serving.app as serving

    first = bootstrap(ModelStore(tmp_path), matches)
    monkeypatch.setenv("WC26_MODEL_STORE", str(tmp_path))
    monkeypatch.setattr(
        serving.live_results_store, "load_combined_matches", lambda: matches
    )
    monkeypatch.setattr(serving, "load_fifa_rankings", dict)

    def forbidden(*args, **kwargs):
        raise AssertionError("Serving must not resolve latest or train")

    monkeypatch.setattr(serving.tracking, "load_latest_stack", forbidden)
    monkeypatch.setattr(serving, "Layer1Ensemble", forbidden)
    state = serving.ModelState()
    assert (
        state.model_version == first and state.model_source == "approved_local_artifact"
    )


def test_selection_is_order_independent_and_uses_one_row_per_match(tmp_path, matches):
    store = ModelStore(tmp_path)
    candidate = register(store, matches)
    a = evaluate(store, candidate, matches)
    b = evaluate(store, candidate, list(reversed(matches)))
    assert a == b and a["n_matches"] == 30


@pytest.mark.parametrize(
    "probabilities",
    [[float("nan"), 0.2, 0.8], [-0.1, 0.2, 0.9], [0.1, 0.2, 1.1], [0, 0, 0]],
)
def test_invalid_model_output_cannot_be_approved(tmp_path, matches, probabilities):
    store = ModelStore(tmp_path)
    y = np.asarray([0, 1, 2])
    stack = DummyClassifier(strategy="prior").fit(np.zeros((3, 6)), y)
    stack.class_prior_ = np.asarray(probabilities)
    candidate = store.register(
        SimpleNamespace(stack=stack),
        train_start=TRAIN_START,
        train_end=TRAIN_END,
        matches=matches,
        source_sha=SHA,
    )
    with pytest.raises(GovernanceError, match="Invalid prediction"):
        evaluate(store, candidate, matches, bootstrap=True, approve=True)
    assert store.active()["generation"] == 0


def test_future_results_do_not_change_past_selection_predictions(tmp_path, matches):
    store = ModelStore(tmp_path)
    candidate = register(store, matches)
    future = Match(date(2025, 1, 1), "A", "B", 999, 0, "synthetic", True)
    a = evaluate(store, candidate, matches)
    b = evaluate(store, candidate, matches + [future])
    assert a["candidate"] == b["candidate"]
    assert a["history_sha256"] != b["history_sha256"]


def test_runtime_and_feature_code_changes_fail_closed(tmp_path, matches, monkeypatch):
    from src.models.layer1_ensemble import lifecycle

    store = ModelStore(tmp_path)
    bootstrap(store, matches)
    monkeypatch.setattr(lifecycle, "code_identity", lambda: {"changed": "code"})
    with pytest.raises(GovernanceError, match="implementation changed"):
        store.load_approved()


def test_bad_bootstrap_actor_does_not_write_partial_approval(tmp_path, matches):
    store = ModelStore(tmp_path)
    candidate = register(store, matches)
    with pytest.raises(GovernanceError, match="Operator"):
        store.evaluate(
            candidate,
            matches=matches,
            rankings={},
            start=START,
            end=END,
            actor="",
            reason="reason",
            bootstrap=True,
            approve=True,
        )
    assert store.active()["generation"] == 0


def test_history_policy_preserves_raw_data_and_stops_current_conflicts(matches):
    from src.models.layer1_ensemble.lifecycle import governance_history

    old = replace(matches[0], date=date(1974, 2, 17))
    raw = [old, replace(old, home_score=0)] + matches + [matches[-1]]
    assert len(governance_history(raw)) == len(matches)
    assert len(raw) == len(matches) + 3
    with pytest.raises(GovernanceError, match="Conflicting"):
        governance_history(matches + [replace(matches[-1], home_score=0)])


def test_prediction_before_training_cutoff_is_rejected():
    from fastapi import HTTPException

    import src.serving.app as serving

    state = SimpleNamespace(
        timelines={"A": [], "B": []}, today=START, training_cutoff=TRAIN_END
    )
    with pytest.raises(HTTPException) as error:
        serving.predict(
            serving.PredictRequest(home_team="A", away_team="B", as_of=TRAIN_START),
            state,
        )
    assert error.value.status_code == 422


class DailyFixture:
    def __init__(self, **kwargs):
        self.stack = DummyClassifier(strategy="prior").fit(np.zeros((3, 6)), [0, 1, 2])
        self.stack.cv = 5
        self.X_train_ = np.zeros((3, 6))
        self.y_train_ = np.asarray([0, 1, 2])


def test_daily_training_never_approves_or_writes_predictions_without_approval(
    tmp_path, matches, monkeypatch
):
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "wc26_daily_governance_test", Path("scripts/daily_update.py")
    )
    daily = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(daily)
    monkeypatch.setenv("ODDS_API_KEY", "test-no-network")
    monkeypatch.setenv("WC26_MODEL_STORE", str(tmp_path / "store"))
    monkeypatch.setattr(daily.odds_api, "get_quota_status", dict)
    monkeypatch.setattr(daily.odds_api, "fetch_scores", lambda **kw: [])
    monkeypatch.setattr(
        daily.live_results_store, "append_new_results", lambda events: 0
    )
    monkeypatch.setattr(
        daily.live_results_store, "load_combined_matches", lambda: matches
    )
    monkeypatch.setattr(daily.live_results_store, "load_live_matches", list)
    monkeypatch.setattr(daily, "load_fifa_rankings", dict)
    monkeypatch.setattr(daily, "Layer1Ensemble", lambda *a, **kw: DailyFixture())
    monkeypatch.setattr(daily, "log_run", lambda *a, **kw: None)

    def forbidden():
        raise AssertionError("Cannot publish candidate predictions without approval")

    monkeypatch.setattr(daily.odds_api, "fetch_match_odds", forbidden)
    with pytest.raises(GovernanceError, match="No approved"):
        daily.main()
    assert ModelStore(tmp_path / "store").active()["model_id"] is None
    with ModelStore(tmp_path / "store").connect() as db:
        assert db.execute("SELECT count(*) FROM candidates").fetchone()[0] == 1

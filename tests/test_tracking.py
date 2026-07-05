from src.models.layer1_ensemble import tracking


def test_get_registry_info_returns_none_when_mlflow_unreachable(monkeypatch):
    monkeypatch.setenv("MLFLOW_TRACKING_URI", "http://localhost:59999")
    assert tracking.get_registry_info() is None


def test_get_registry_info_returns_none_when_no_versions(monkeypatch):
    monkeypatch.setattr(tracking, "_is_reachable", lambda uri: True)

    class FakeClient:
        def search_model_versions(self, query):
            return []

    monkeypatch.setattr(tracking, "MlflowClient", lambda: FakeClient())
    assert tracking.get_registry_info() is None


def test_get_registry_info_picks_highest_version(monkeypatch):
    monkeypatch.setattr(tracking, "_is_reachable", lambda uri: True)

    class FakeVersion:
        def __init__(self, version, run_id, creation_timestamp):
            self.version = version
            self.run_id = run_id
            self.creation_timestamp = creation_timestamp

    versions = [
        FakeVersion("2", "run-2", 1_700_000_000_000),
        FakeVersion("10", "run-10", 1_800_000_000_000),
        FakeVersion("1", "run-1", 1_600_000_000_000),
    ]

    class FakeRunData:
        params = {"train_start": "1992-01-01"}
        metrics = {"train_set_insample_log_loss": 0.55}

    class FakeRun:
        data = FakeRunData()

    class FakeClient:
        def search_model_versions(self, query):
            return versions

        def get_run(self, run_id):
            assert run_id == "run-10"
            return FakeRun()

    monkeypatch.setattr(tracking, "MlflowClient", lambda: FakeClient())
    monkeypatch.setattr(
        tracking.mlflow.artifacts, "load_dict", lambda uri: {"xgboost": 0.5, "elo_logreg": 0.3, "fifa_heuristic": 0.2}
    )
    info = tracking.get_registry_info()
    assert info["version"] == "10"
    assert info["run_id"] == "run-10"
    assert info["created_at"].startswith("2027-01-15")  # sanity check, real epoch conversion
    assert info["params"] == {"train_start": "1992-01-01"}
    assert info["metrics"] == {"train_set_insample_log_loss": 0.55}
    assert info["ensemble_weights"] == {"xgboost": 0.5, "elo_logreg": 0.3, "fifa_heuristic": 0.2}


def test_get_registry_info_degrades_gracefully_when_artifact_missing(monkeypatch):
    monkeypatch.setattr(tracking, "_is_reachable", lambda uri: True)

    class FakeVersion:
        version = "1"
        run_id = "run-1"
        creation_timestamp = 1_700_000_000_000

    class FakeRunData:
        params = {}
        metrics = {}

    class FakeRun:
        data = FakeRunData()

    class FakeClient:
        def search_model_versions(self, query):
            return [FakeVersion()]

        def get_run(self, run_id):
            return FakeRun()

    def _raise(uri):
        raise FileNotFoundError("no such artifact")

    monkeypatch.setattr(tracking, "MlflowClient", lambda: FakeClient())
    monkeypatch.setattr(tracking.mlflow.artifacts, "load_dict", _raise)
    info = tracking.get_registry_info()
    assert info["ensemble_weights"] == {}


def test_relative_member_influence_empty_for_missing_shape():
    assert tracking.relative_member_influence({}) == {}


def test_is_reachable_false_when_mlflow_unreachable(monkeypatch):
    monkeypatch.setenv("MLFLOW_TRACKING_URI", "http://localhost:59999")
    assert tracking.is_reachable() is False


def test_list_recent_runs_empty_when_mlflow_unreachable(monkeypatch):
    monkeypatch.setenv("MLFLOW_TRACKING_URI", "http://localhost:59999")
    assert tracking.list_recent_runs() == []


def test_list_recent_runs_empty_when_experiment_missing(monkeypatch):
    monkeypatch.setattr(tracking, "_is_reachable", lambda uri: True)

    class FakeClient:
        def get_experiment_by_name(self, name):
            return None

    monkeypatch.setattr(tracking, "MlflowClient", lambda: FakeClient())
    assert tracking.list_recent_runs() == []


def test_list_recent_runs_returns_newest_first_shape(monkeypatch):
    monkeypatch.setattr(tracking, "_is_reachable", lambda uri: True)

    class FakeExperiment:
        experiment_id = "0"

    class FakeRunInfo:
        def __init__(self, run_id, run_name, start_time):
            self.run_id = run_id
            self.run_name = run_name
            self.status = "FINISHED"
            self.start_time = start_time

    class FakeRunData:
        params = {"train_start": "1992-01-01"}
        metrics = {"log_loss": 0.55}

    class FakeRun:
        def __init__(self, run_id, run_name, start_time):
            self.info = FakeRunInfo(run_id, run_name, start_time)
            self.data = FakeRunData()

    runs = [FakeRun("run-2", "second", 1_800_000_000_000), FakeRun("run-1", "first", 1_700_000_000_000)]

    class FakeClient:
        def get_experiment_by_name(self, name):
            return FakeExperiment()

        def search_runs(self, experiment_ids, order_by, max_results):
            return runs

    monkeypatch.setattr(tracking, "MlflowClient", lambda: FakeClient())
    result = tracking.list_recent_runs(n=2)
    assert [r["run_id"] for r in result] == ["run-2", "run-1"]
    assert result[0]["metrics"] == {"log_loss": 0.55}
    assert result[0]["start_time"].startswith("2027-01-15")


def test_relative_member_influence_sums_to_one_and_favors_dominant_member():
    # 3 members x 3 classes -- xgboost's block has much larger magnitude
    # coefficients than the other two, so it should end up with the
    # largest share of relative influence.
    ensemble_weights = {
        "member_order": ["xgboost", "elo_logreg", "fifa_heuristic"],
        "coef": [
            [3.0, -1.0, 2.0, 0.5, 0.5, 0.5, 0.1, 0.1, 0.1],
            [-2.0, 1.5, -1.0, 0.5, -0.5, 0.5, -0.1, 0.1, -0.1],
            [1.0, -1.0, 3.0, -0.5, 0.5, -0.5, 0.1, -0.1, 0.1],
        ],
    }
    influence = tracking.relative_member_influence(ensemble_weights)
    assert set(influence) == {"xgboost", "elo_logreg", "fifa_heuristic"}
    assert abs(sum(influence.values()) - 1.0) < 1e-9
    assert influence["xgboost"] > influence["elo_logreg"] > influence["fifa_heuristic"]

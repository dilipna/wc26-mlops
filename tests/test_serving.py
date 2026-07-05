from datetime import date

from fastapi.testclient import TestClient

from src.serving.app import app, get_model_state


class FakeEnsemble:
    def match_probs(self, home, away, as_of, neutral=True):
        return (0.2, 0.3, 0.5)  # p_loss, p_draw, p_win

    def baseline_match_probs(self, home, away, as_of, neutral=True):
        return (0.25, 0.25, 0.5)

    def xgb_feature_importance(self):
        return {"elo_diff": 0.6, "rank_points_diff": 0.4}

    def shap_values_for_match(self, team_a, team_b, as_of, neutral=True):
        return {
            "team_a": team_a,
            "team_b": team_b,
            "base_values": {"loss": 0.3, "draw": 0.3, "win": 0.4},
            "feature_values": {"elo_diff": 120.0},
            "shap_values": {"elo_diff": {"loss": -0.1, "draw": -0.05, "win": 0.15}},
        }


class FakeState:
    def __init__(self):
        self.ensemble = FakeEnsemble()
        self.timelines = {"France": object(), "Brazil": object()}
        self.today = date(2026, 7, 4)
        self.model_source = "trained_locally (test stub)"
        self.model_version = "v42"

    def champion_probabilities(self, refresh=False):
        return {"as_of": self.today.isoformat(), "model_source": self.model_source, "probabilities": {"France": 0.4}}


app.dependency_overrides[get_model_state] = lambda: FakeState()
client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["model_version"] == "v42"


def test_predict_known_teams():
    resp = client.post("/predict", json={"home_team": "France", "away_team": "Brazil"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["model"] == {"home_win": 0.5, "draw": 0.3, "away_win": 0.2}
    assert body["baseline"] == {"home_win": 0.5, "draw": 0.25, "away_win": 0.25}
    assert body["model_version"] == "v42"


def test_predict_unknown_team_404():
    resp = client.post("/predict", json={"home_team": "Wakanda", "away_team": "Brazil"})
    assert resp.status_code == 404


def test_champions():
    resp = client.get("/champions")
    assert resp.status_code == 200
    assert resp.json()["probabilities"]["France"] == 0.4
    assert resp.json()["model_version"] == "v42"


def test_response_carries_request_id_and_latency_headers():
    resp = client.get("/health")
    assert "X-Request-ID" in resp.headers
    assert "X-Response-Time-Ms" in resp.headers
    # two requests must get distinct request IDs
    resp2 = client.get("/health")
    assert resp.headers["X-Request-ID"] != resp2.headers["X-Request-ID"]


def test_feature_importance():
    resp = client.get("/feature-importance")
    assert resp.status_code == 200
    body = resp.json()
    assert body["importances"] == {"elo_diff": 0.6, "rank_points_diff": 0.4}
    assert body["model_version"] == "v42"


def test_explain_known_teams():
    resp = client.post("/explain", json={"home_team": "France", "away_team": "Brazil"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["team_a"] == "France"
    assert body["team_b"] == "Brazil"
    assert body["shap_values"]["elo_diff"]["win"] == 0.15
    assert body["model_version"] == "v42"


def test_explain_unknown_team_404():
    resp = client.post("/explain", json={"home_team": "Wakanda", "away_team": "Brazil"})
    assert resp.status_code == 404


def test_cors_allows_configured_dashboard_origin():
    resp = client.get("/health", headers={"Origin": "https://fifa2026mlops.vercel.app"})
    assert resp.headers.get("access-control-allow-origin") == "https://fifa2026mlops.vercel.app"

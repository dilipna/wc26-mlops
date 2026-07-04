from datetime import date

from fastapi.testclient import TestClient

from src.serving.app import app, get_model_state


class FakeEnsemble:
    def match_probs(self, home, away, as_of, neutral=True):
        return (0.2, 0.3, 0.5)  # p_loss, p_draw, p_win

    def baseline_match_probs(self, home, away, as_of, neutral=True):
        return (0.25, 0.25, 0.5)


class FakeState:
    def __init__(self):
        self.ensemble = FakeEnsemble()
        self.timelines = {"France": object(), "Brazil": object()}
        self.today = date(2026, 7, 4)
        self.model_source = "trained_locally (test stub)"

    def champion_probabilities(self, refresh=False):
        return {"as_of": self.today.isoformat(), "model_source": self.model_source, "probabilities": {"France": 0.4}}


app.dependency_overrides[get_model_state] = lambda: FakeState()
client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_predict_known_teams():
    resp = client.post("/predict", json={"home_team": "France", "away_team": "Brazil"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["model"] == {"home_win": 0.5, "draw": 0.3, "away_win": 0.2}
    assert body["baseline"] == {"home_win": 0.5, "draw": 0.25, "away_win": 0.25}


def test_predict_unknown_team_404():
    resp = client.post("/predict", json={"home_team": "Wakanda", "away_team": "Brazil"})
    assert resp.status_code == 404


def test_champions():
    resp = client.get("/champions")
    assert resp.status_code == 200
    assert resp.json()["probabilities"]["France"] == 0.4

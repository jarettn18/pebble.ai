from fastapi.testclient import TestClient

from pebble.ai.models import DEFAULT_MODEL_KEY
from pebble.main import app


class TestModelsEndpoint:
    def test_models_endpoint_returns_allow_listed_models(self, authed_client):
        resp = authed_client.get("/v1/ai/models")
        assert resp.status_code == 200

        data = resp.json()
        assert len(data["models"]) > 0

        model_keys = {m["key"] for m in data["models"]}
        assert data["default"] in model_keys
        assert DEFAULT_MODEL_KEY in model_keys

    def test_models_endpoint_requires_auth(self):
        with TestClient(app) as client:
            resp = client.get("/v1/ai/models")
        assert resp.status_code in (401, 403)

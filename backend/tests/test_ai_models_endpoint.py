class TestModelsEndpoint:
    def test_models_endpoint_returns_allow_listed_models(self, authed_client):
        """GET /v1/ai/models should return all allow-listed models with defaults."""
        resp = authed_client.get("/v1/ai/models")
        assert resp.status_code == 200

        data = resp.json()
        assert "models" in data
        assert "default" in data
        assert isinstance(data["models"], list)
        assert isinstance(data["default"], str)

        # Verify default is in the set of model keys
        model_keys = {m["key"] for m in data["models"]}
        assert data["default"] in model_keys

        # Verify claude-haiku-4-5 is one of the keys
        assert "claude-haiku-4-5" in model_keys

        # Verify each model has required fields
        for model in data["models"]:
            assert "key" in model
            assert "label" in model
            assert "tier" in model

    def test_models_endpoint_requires_auth(self):
        """GET /v1/ai/models should return 401/403 without authentication."""
        from fastapi.testclient import TestClient
        from pebble.main import app

        app.dependency_overrides.clear()
        with TestClient(app) as client:
            resp = client.get("/v1/ai/models")
        assert resp.status_code in (401, 403)

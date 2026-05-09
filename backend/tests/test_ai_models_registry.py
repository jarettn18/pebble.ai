from pebble.ai.models import ALLOWED_MODELS, DEFAULT_MODEL_KEY, resolve_model


def test_default_model_key_is_in_registry():
    assert DEFAULT_MODEL_KEY in ALLOWED_MODELS


def test_registry_entries_have_required_fields():
    for key, entry in ALLOWED_MODELS.items():
        assert "litellm_id" in entry
        assert "label" in entry
        assert "tier" in entry
        assert entry["tier"] in {"fast", "balanced", "max"}


def test_resolve_model_returns_litellm_id_for_known_key():
    entry = resolve_model("claude-haiku-4-5")
    assert entry["litellm_id"].startswith("anthropic/")


def test_resolve_model_raises_for_unknown_key():
    import pytest
    with pytest.raises(ValueError, match="Unknown model"):
        resolve_model("not-a-real-model")


def test_resolve_model_uses_default_when_none():
    entry = resolve_model(None)
    assert entry["litellm_id"] == ALLOWED_MODELS[DEFAULT_MODEL_KEY]["litellm_id"]

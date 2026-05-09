"""Allow-list of chat models exposed to the in-app AI picker.

LiteLLM model ids follow the form "<provider>/<model>".
Only entries listed here can be selected by clients.
"""

from typing import TypedDict


class ModelEntry(TypedDict):
    litellm_id: str
    label: str
    tier: str  # "fast" | "balanced" | "max"


ALLOWED_MODELS: dict[str, ModelEntry] = {
    "claude-haiku-4-5": {
        "litellm_id": "anthropic/claude-haiku-4-5-20251001",
        "label": "Claude Haiku 4.5",
        "tier": "fast",
    },
    "claude-sonnet-4-6": {
        "litellm_id": "anthropic/claude-sonnet-4-6",
        "label": "Claude Sonnet 4.6",
        "tier": "balanced",
    },
    "claude-opus-4-7": {
        "litellm_id": "anthropic/claude-opus-4-7",
        "label": "Claude Opus 4.7",
        "tier": "max",
    },
    "gpt-4o-mini": {
        "litellm_id": "openai/gpt-4o-mini",
        "label": "GPT-4o mini",
        "tier": "fast",
    },
    "gpt-4o": {
        "litellm_id": "openai/gpt-4o",
        "label": "GPT-4o",
        "tier": "balanced",
    },
}

DEFAULT_MODEL_KEY = "claude-haiku-4-5"


def resolve_model(key: str | None) -> ModelEntry:
    """Resolve a user-supplied model key against the allow-list.

    Returns the registry entry. Raises ValueError on unknown keys.
    None resolves to the default.
    """
    if key is None:
        return ALLOWED_MODELS[DEFAULT_MODEL_KEY]
    if key not in ALLOWED_MODELS:
        raise ValueError(f"Unknown model: {key}")
    return ALLOWED_MODELS[key]

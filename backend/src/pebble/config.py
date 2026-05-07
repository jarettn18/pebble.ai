from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database — either set database_url directly (local dev),
    # or provide the parts and it will be assembled (ECS + Secrets Manager).
    database_url: str = "postgresql+asyncpg://pebble:pebble_dev_password@localhost:5432/pebble"
    database_host: str = ""
    database_name: str = "pebble"
    database_user: str = "pebble"
    db_password: str = ""

    @model_validator(mode="after")
    def assemble_database_url(self) -> "Settings":
        if self.database_host and self.db_password:
            self.database_url = (
                f"postgresql+asyncpg://{self.database_user}:{self.db_password}"
                f"@{self.database_host}/{self.database_name}"
            )
        return self

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "change-me-to-a-random-secret-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # Plaid
    plaid_client_id: str = ""
    plaid_secret: str = ""
    plaid_env: str = "sandbox"

    # AI providers (LiteLLM is the unified client; per-provider keys below)
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    # LiteLLM model id, e.g. "anthropic/claude-haiku-4-5-20251001" or "openai/gpt-4o-mini"
    default_chat_model: str = "anthropic/claude-haiku-4-5-20251001"
    # TODO: remove in Task 6 (service.py rewrite). Still referenced by ai/service.py:34.
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # Encryption
    encryption_key: str = ""

    # Twilio (SMS verification)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_verify_service_sid: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

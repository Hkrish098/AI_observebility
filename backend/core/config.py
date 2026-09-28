from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _clean_secret(value: str) -> str:
    cleaned = value.strip().strip('"').strip("'")
    if " #" in cleaned:
        cleaned = cleaned.split(" #", 1)[0].strip()
    return cleaned


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""

    groq_api_key: str = ""
    groq_router_model: str = "llama-3.1-8b-instant"

    gemini_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GEMINI_API_KEY", "GEMINI_API_KEy", "gemini_api_key"),
    )
    gemini_model: str = "gemini-3.6-flash"
    gemini_embedding_model: str = "gemini-embedding-001"

    cohere_api_key: str = ""
    cohere_rerank_model: str = "rerank-v3.5"

    llm_temperature: float = 0.2
    prompt_version: str = "v1"

    cost_flag_threshold_usd: float = 0.05
    groundedness_flag_threshold: float = 0.7
    latency_flag_threshold_ms: int = 8000

    @field_validator(
        "groq_api_key",
        "gemini_api_key",
        "cohere_api_key",
        "supabase_url",
        "supabase_service_role_key",
        "supabase_anon_key",
        mode="before",
    )
    @classmethod
    def strip_key_comments(cls, value: object) -> object:
        if isinstance(value, str):
            return _clean_secret(value)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        configured = [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]
        always = [
            "http://localhost:3000",
            "https://ai-observebility.vercel.app",
            "https://ai-observebility-phi.vercel.app",
        ]
        seen: list[str] = []
        for origin in [*configured, *always]:
            if origin not in seen:
                seen.append(origin)
        return seen

    @property
    def supabase_configured(self) -> bool:
        url = self.supabase_url.strip()
        key = self.supabase_service_role_key.strip()
        if not url or not key:
            return False
        if "YOUR_PROJECT" in url or key.startswith("your-"):
            return False
        return True

    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def cohere_configured(self) -> bool:
        return bool(self.cohere_api_key)

    @property
    def llm_configured(self) -> bool:
        return self.gemini_configured or self.groq_configured


settings = Settings()

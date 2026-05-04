"""Backend settings loaded from environment."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str

    OLLAMA_BASE_URL: str = "http://host.docker.internal:11434"
    LLM_MODEL: str = "llama3.2:3b"

    # Tool defaults
    NEWS_LOOKBACK_DAYS: int = 7
    NEWS_DEFAULT_LIMIT: int = 20
    FILINGS_DEFAULT_LIMIT: int = 10

    # yfinance has occasional rate limits — use modest timeouts
    YFINANCE_TIMEOUT_S: int = 15


settings = Settings()

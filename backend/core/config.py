"""Backend settings loaded from environment."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str

    OLLAMA_BASE_URL: str = "http://host.docker.internal:11434"
    LLM_MODEL: str = "llama-3.1-8b-instant"
    LLM_QUALITY_MODEL: str = "llama-3.1-8b-instant"  # set to llama-3.3-70b-versatile when not rate-limited
    GROQ_API_KEY: str = ""

    # Tool defaults
    NEWS_LOOKBACK_DAYS: int = 7
    NEWS_DEFAULT_LIMIT: int = 20
    FILINGS_DEFAULT_LIMIT: int = 10

    # yfinance has occasional rate limits — use modest timeouts
    YFINANCE_TIMEOUT_S: int = 15


settings = Settings()

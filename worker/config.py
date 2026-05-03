"""Centralized environment-driven config for the worker."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str

    SEC_USER_AGENT: str = "FinancialAgent contact@example.com"

    NEWS_INTERVAL_MINUTES: int = 30
    FILINGS_HOUR_UTC: int = 22
    COMPANIES_HOUR_UTC: int = 20

    # ETL behavior
    MAX_RETRIES_PER_TICKER: int = 3
    CIRCUIT_BREAKER_FAILURES: int = 3        # open after N failures in window
    CIRCUIT_BREAKER_WINDOW_MIN: int = 60      # window in minutes
    INTER_TICKER_SLEEP_MS: int = 200          # rate limit between tickers
    SEC_RATE_LIMIT_MS: int = 150              # SEC says max 10 req/sec


settings = Settings()

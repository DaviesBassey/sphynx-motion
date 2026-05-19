from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """
    Converged System Settings.
    Strictly enforced via Pydantic v2.
    """
    SENTRY_DSN: Optional[str] = None
    GROQ_API_KEY: str = "unconfigured"
    OPIK_API_KEY: Optional[str] = None
    DATABASE_URL: str = "unconfigured"
    STRIPE_SECRET_KEY: str = "unconfigured"
    PUBLIC_ORIGIN: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()

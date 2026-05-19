from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
import sentry_sdk
from typing import Optional
from .routers import underwriting, payments

class Settings(BaseSettings):
    SENTRY_DSN: Optional[str] = None
    GROQ_API_KEY: str = "placeholder"
    OPIK_API_KEY: Optional[str] = None
    DATABASE_URL: str = "placeholder"
    STRIPE_SECRET_KEY: str = "placeholder"
    PUBLIC_ORIGIN: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()

if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=1.0)

app = FastAPI(title="SphynxPlay Principal Architect API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.PUBLIC_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(underwriting.router, prefix="/api/v1/underwriting", tags=["underwriting"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "1.0.0-converged"}

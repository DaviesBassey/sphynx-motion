from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
import sentry_sdk
import time
from typing import Optional, Dict, List, Callable, Awaitable
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

# --- Infrastructure Rate Limiting ---
# Global Boundary: 100 req/min
# Auth Boundary: 5 req / 15 min
ip_request_counts: Dict[str, List[float]] = {}
auth_request_counts: Dict[str, List[float]] = {}

def cleanup_limits() -> None:
    """Cleanup stale IP data to prevent memory leaks."""
    now = time.time()
    for ip in list(ip_request_counts.keys()):
        ip_request_counts[ip] = [t for t in ip_request_counts[ip] if now - t < 60]
        if not ip_request_counts[ip]:
            del ip_request_counts[ip]
    for ip in list(auth_request_counts.keys()):
        auth_request_counts[ip] = [t for t in auth_request_counts[ip] if now - t < 900]
        if not auth_request_counts[ip]:
            del auth_request_counts[ip]

# --- Ingestion Hardening ---
MAX_METADATA_SIZE = 500 * 1024 # 500KB
MAX_MULTIPART_SIZE = 5 * 1024 * 1024 # 5MB

@app.middleware("http")
async def combined_infrastructure_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Global Rate Limit: 100/min
    if client_ip not in ip_request_counts:
        ip_request_counts[client_ip] = []

    ip_request_counts[client_ip] = [t for t in ip_request_counts[client_ip] if now - t < 60]
    if len(ip_request_counts[client_ip]) >= 100:
        raise HTTPException(status_code=429, detail="Too many requests")

    ip_request_counts[client_ip].append(now)

    # Auth Rate Limit: 5/15min on identity routes
    if "/api/v1/auth" in request.url.path or "/login" in request.url.path:
        if client_ip not in auth_request_counts:
            auth_request_counts[client_ip] = []
        auth_request_counts[client_ip] = [t for t in auth_request_counts[client_ip] if now - t < 900]
        if len(auth_request_counts[client_ip]) >= 5:
            raise HTTPException(status_code=429, detail="Too many authentication attempts")
        auth_request_counts[client_ip].append(now)

    # Payload Hardening
    content_length = request.headers.get("Content-Length")
    if content_length:
        try:
            size = int(content_length)
            content_type = request.headers.get("Content-Type", "")
            if "multipart/form-data" in content_type:
                if size > MAX_MULTIPART_SIZE:
                    raise HTTPException(status_code=413, detail="Payload too large (Max 5MB)")
            elif size > MAX_METADATA_SIZE:
                raise HTTPException(status_code=413, detail="Payload too large (Max 500KB)")
        except ValueError:
            pass

    # Run cleanup periodically (simplified for initialization)
    if now % 60 < 1:
        cleanup_limits()

    return await call_next(request)

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

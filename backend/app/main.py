from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import sentry_sdk
import time
from typing import Optional, Dict, List, Callable, Awaitable
from .config import settings
from .routers import underwriting, payments
from .api.v1 import portfolio

if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=1.0)

app = FastAPI(title="SphynxPlay Principal Architect API")

# --- Infrastructure Rate Limiting ---
ip_request_counts: Dict[str, List[float]] = {}
auth_request_counts: Dict[str, List[float]] = {}

def cleanup_limits() -> None:
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

    if client_ip not in ip_request_counts:
        ip_request_counts[client_ip] = []
    ip_request_counts[client_ip] = [t for t in ip_request_counts[client_ip] if now - t < 60]
    if len(ip_request_counts[client_ip]) >= 100:
        raise HTTPException(status_code=429, detail="Too many requests")
    ip_request_counts[client_ip].append(now)

    if "/api/v1/auth" in request.url.path or "/login" in request.url.path:
        if client_ip not in auth_request_counts:
            auth_request_counts[client_ip] = []
        auth_request_counts[client_ip] = [t for t in auth_request_counts[client_ip] if now - t < 900]
        if len(auth_request_counts[client_ip]) >= 5:
            raise HTTPException(status_code=429, detail="Too many authentication attempts")
        auth_request_counts[client_ip].append(now)

    content_length = request.headers.get("Content-Length")
    if content_length:
        try:
            size = int(content_length)
            content_type = request.headers.get("Content-Type", "")
            if "multipart/form-data" in content_type:
                if size > MAX_MULTIPART_SIZE:
                    raise HTTPException(status_code=413, detail="Payload too large")
            elif size > MAX_METADATA_SIZE:
                raise HTTPException(status_code=413, detail="Payload too large")
        except ValueError:
            pass

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
app.include_router(portfolio.router, prefix="/api/v1/portfolio", tags=["portfolio"])

@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "version": "1.0.0-converged"}

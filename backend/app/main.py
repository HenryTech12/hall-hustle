from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import Base, engine  # noqa: F401 (Base/engine kept for Alembic + potential scripts)
from app.rate_limit import limiter
from app.routers import admin_seed, auth, listings, messages, payments, roommates, uploads, users

# Schema is managed by Alembic now (see alembic/ + README) — run
# `alembic upgrade head` before starting the app rather than relying on
# create_all(), so schema changes are tracked and reversible.

app = FastAPI(
    title=settings.APP_NAME,
    description="Matric-verified student housing marketplace with escrow-protected payments.",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",  # covers Vercel preview + prod URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_seed.router)
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(messages.router)
app.include_router(payments.router)
app.include_router(roommates.router)
app.include_router(uploads.router)
app.include_router(users.router)


# Demo images used by POST /admin/seed-demo (and any other bundled static assets)
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "environment": settings.ENVIRONMENT}

import secrets
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.rate_limit import limiter
from app.services import demo_seed

router = APIRouter(prefix="/admin", tags=["admin"])


def _public_base_url(request: Request) -> str:
    """Absolute URL images are served from. Browsers block http images on an https page, so force https off-localhost."""
    if settings.PUBLIC_BASE_URL:
        return settings.PUBLIC_BASE_URL.rstrip("/")
    base = str(request.base_url).rstrip("/")
    host = urlparse(base).hostname or ""
    if base.startswith("http://") and host not in ("localhost", "127.0.0.1", "testserver"):
        base = "https://" + base[len("http://"):]
    return base


@router.post("/seed-demo")
@limiter.limit("10/hour")
def seed_demo(
    request: Request,
    x_seed_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    """
    Adds demo students, roommate profiles and listings WITH images.
    Idempotent: call it again to attach images to any demo listing missing one.

    Disabled (404) unless SEED_SECRET is set in the environment, and requires
    the same value in the `X-Seed-Key` header. Remove SEED_SECRET after the
    demo to switch it off again.
    """
    if not settings.SEED_SECRET:
        raise HTTPException(status_code=404, detail="Not found")
    if not secrets.compare_digest(x_seed_key.encode(), settings.SEED_SECRET.encode()):
        raise HTTPException(status_code=403, detail="Invalid seed key")

    return demo_seed.run_seed(db, image_base_url=_public_base_url(request))

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_verified_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=schemas.PublicUserOut)
def get_public_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    Public-safe profile lookup for another user — used by the chat screen
    to show who you're actually talking to (name, verified badge, phone
    for the WhatsApp fallback button), independent of whatever listing
    the conversation happens to be about. Requires auth so profiles
    aren't scrapeable by anonymous requests, but any verified student can
    look up any other verified student (same trust model as the rest of
    the platform — this isn't sensitive data beyond what's already shown
    on their listings).
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

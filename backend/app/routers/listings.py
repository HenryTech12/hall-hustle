from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.deps import get_current_verified_user, get_current_user, get_optional_current_user

router = APIRouter(prefix="/listings", tags=["listings"])


def _serialize_with_interest(listing: models.Listing, viewer: Optional[models.User], db: Session) -> schemas.ListingOut:
    out = schemas.ListingOut.model_validate(listing)
    if viewer:
        exists = (
            db.query(models.ListingInterest)
            .filter(models.ListingInterest.listing_id == listing.id, models.ListingInterest.user_id == viewer.id)
            .first()
        )
        out.is_interested_by_me = exists is not None
    return out


@router.post("", response_model=schemas.ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(
    payload: schemas.ListingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    listing = models.Listing(
        owner_id=current_user.id,
        listing_type=payload.listing_type,
        hall_name=payload.hall_name,
        price_amount=payload.price_amount,
        price_label=payload.price_label,
        duration=payload.duration,
        caption=payload.caption,
        photo_url=payload.photo_url,
        media_type=payload.media_type or "image",
        music_url=payload.music_url,
        is_urgent=payload.is_urgent,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


@router.get("", response_model=list[schemas.ListingOut])
def browse_listings(
    hall_name: Optional[str] = None,
    listing_type: Optional[models.ListingType] = None,
    urgent_only: bool = False,
    max_price: Optional[float] = None,
    limit: int = Query(default=30, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    viewer: Optional[models.User] = Depends(get_optional_current_user),
):
    query = (
        db.query(models.Listing)
        .options(joinedload(models.Listing.owner))
        .filter(models.Listing.status == models.ListingStatus.ACTIVE)
    )

    if hall_name:
        query = query.filter(models.Listing.hall_name.ilike(f"%{hall_name}%"))
    if listing_type:
        query = query.filter(models.Listing.listing_type == listing_type)
    if urgent_only:
        query = query.filter(models.Listing.is_urgent.is_(True))
    if max_price is not None:
        query = query.filter(models.Listing.price_amount <= max_price)

    query = query.order_by(
        models.Listing.is_urgent.desc(), models.Listing.created_at.desc()
    )
    listings = query.offset(offset).limit(limit).all()

    if viewer:
        interested_ids = {
            row.listing_id
            for row in db.query(models.ListingInterest.listing_id)
            .filter(
                models.ListingInterest.user_id == viewer.id,
                models.ListingInterest.listing_id.in_([l.id for l in listings]),
            )
            .all()
        }
        results = []
        for listing in listings:
            out = schemas.ListingOut.model_validate(listing)
            out.is_interested_by_me = listing.id in interested_ids
            results.append(out)
        return results

    return listings


@router.get("/urgent", response_model=list[schemas.ListingOut])
def get_urgent_listings(
    db: Session = Depends(get_db),
    viewer: Optional[models.User] = Depends(get_optional_current_user),
):
    """Powers the Instagram-style 'stories bar' of urgent listings."""
    listings = (
        db.query(models.Listing)
        .options(joinedload(models.Listing.owner))
        .filter(
            models.Listing.status == models.ListingStatus.ACTIVE,
            models.Listing.is_urgent.is_(True),
        )
        .order_by(models.Listing.created_at.desc())
        .limit(20)
        .all()
    )
    return [_serialize_with_interest(l, viewer, db) for l in listings]


@router.get("/{listing_id}", response_model=schemas.ListingOut)
def get_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    viewer: Optional[models.User] = Depends(get_optional_current_user),
):
    listing = (
        db.query(models.Listing)
        .options(joinedload(models.Listing.owner))
        .filter(models.Listing.id == listing_id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return _serialize_with_interest(listing, viewer, db)


@router.patch("/{listing_id}", response_model=schemas.ListingOut)
def update_listing(
    listing_id: str,
    payload: schemas.ListingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own listings")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, field, value)

    db.commit()
    db.refresh(listing)
    return listing


@router.post("/{listing_id}/interested", status_code=status.HTTP_200_OK)
def mark_interested(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Instagram-style double-tap equivalent. Idempotent per user: calling
    this repeatedly (e.g. after a page refresh, or a duplicate tap) never
    increments the counter more than once per user — a unique constraint
    on (listing_id, user_id) enforces this at the database level too, not
    just in application logic.
    """
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    existing = (
        db.query(models.ListingInterest)
        .filter(
            models.ListingInterest.listing_id == listing_id,
            models.ListingInterest.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        # Already marked — return current state rather than erroring or
        # incrementing again, so the frontend can call this idempotently.
        return {"interested_count": listing.interested_count, "is_interested_by_me": True}

    interest = models.ListingInterest(listing_id=listing_id, user_id=current_user.id)
    db.add(interest)
    listing.interested_count = (listing.interested_count or 0) + 1
    db.commit()
    return {"interested_count": listing.interested_count, "is_interested_by_me": True}


@router.delete("/{listing_id}/interested", status_code=status.HTTP_200_OK)
def unmark_interested(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lets a user un-like a listing (matching a real double-tap/heart toggle)."""
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    existing = (
        db.query(models.ListingInterest)
        .filter(
            models.ListingInterest.listing_id == listing_id,
            models.ListingInterest.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        listing.interested_count = max((listing.interested_count or 1) - 1, 0)
        db.commit()

    return {"interested_count": listing.interested_count, "is_interested_by_me": False}


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own listings")

    db.delete(listing)
    db.commit()

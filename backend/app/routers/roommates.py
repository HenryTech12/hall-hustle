from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.deps import get_current_verified_user
from app.services import roommate_match

router = APIRouter(prefix="/roommates", tags=["roommates"])

CANDIDATE_POOL = 500  # SQL pre-filters first; only this many rows are scored in Python


def _my_profile(db: Session, user_id: str):
    return db.query(models.RoommateProfile).filter(models.RoommateProfile.user_id == user_id).first()


@router.get("/me", response_model=schemas.RoommateProfileOut)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    profile = _my_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="You haven't filled in your roommate profile yet.")
    return profile


@router.put("/me", response_model=schemas.RoommateProfileOut)
def upsert_my_profile(
    payload: schemas.RoommateProfileIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    profile = _my_profile(db, current_user.id)
    data = payload.model_dump()
    if profile:
        for k, v in data.items():
            setattr(profile, k, v)
        profile.updated_at = datetime.utcnow()
    else:
        profile = models.RoommateProfile(user_id=current_user.id, **data)
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/matches", response_model=list[schemas.RoommateMatchOut])
def get_matches(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    Ranked roommate matches. Cheap filters (active, verified, gender rules,
    budget overlap) run in SQL so only a bounded candidate pool is scored
    in Python — this keeps the endpoint fast as the user base grows.
    """
    me = _my_profile(db, current_user.id)
    if not me:
        raise HTTPException(status_code=404, detail="Fill in your roommate profile to see matches.")

    P = models.RoommateProfile
    query = (
        db.query(P)
        .join(models.User, models.User.id == P.user_id)
        .options(joinedload(P.user))
        .filter(
            P.user_id != current_user.id,
            P.is_active.is_(True),
            models.User.is_verified.is_(True),
            P.budget_min <= me.budget_max,
            P.budget_max >= me.budget_min,
            or_(P.same_gender_only.is_(False), P.gender == me.gender),
        )
    )
    if me.same_gender_only:
        query = query.filter(P.gender == me.gender)

    candidates = query.limit(CANDIDATE_POOL).all()

    scored = []
    for cand in candidates:
        result = roommate_match.score_pair(me, cand)
        scored.append((result, cand))
    scored.sort(key=lambda x: x[0]["score"], reverse=True)
    top = scored[:limit]

    # One query for each top candidate's most recent active listing
    owner_ids = [c.user_id for _, c in top]
    listing_by_owner: dict[str, str] = {}
    if owner_ids:
        rows = (
            db.query(models.Listing.owner_id, models.Listing.id)
            .filter(
                models.Listing.owner_id.in_(owner_ids),
                models.Listing.status == models.ListingStatus.ACTIVE,
            )
            .order_by(models.Listing.created_at.desc())
            .all()
        )
        for owner_id, listing_id in rows:
            listing_by_owner.setdefault(owner_id, listing_id)

    return [
        schemas.RoommateMatchOut(
            user=schemas.RoommateUserOut.model_validate(c.user),
            score=r["score"],
            reasons=r["reasons"],
            cautions=r["cautions"],
            bio=c.bio,
            preferred_area=c.preferred_area,
            budget_min=c.budget_min,
            budget_max=c.budget_max,
            listing_id=listing_by_owner.get(c.user_id),
        )
        for r, c in top
    ]


@router.get("/score/{user_id}", response_model=schemas.CompatibilityOut)
def get_compatibility(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """Compatibility between me and one specific user (shown in chat). Empty if either profile is missing."""
    me = _my_profile(db, current_user.id)
    other = _my_profile(db, user_id)
    if not me or not other or not roommate_match.gender_compatible(me, other):
        return schemas.CompatibilityOut()
    result = roommate_match.score_pair(me, other)
    return schemas.CompatibilityOut(**result)

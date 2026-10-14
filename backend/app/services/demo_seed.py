"""
Demo data: students, roommate profiles and listings with images.

Used by both the protected POST /admin/seed-demo endpoint and
`python -m scripts.seed_demo`. Safe to run repeatedly: existing demo users
and listings are kept, and listings that are missing an image get one.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app import models
from app.security import hash_password

DEMO_PASSWORD = "DemoPass123!"
DEMO_EMAIL_DOMAIN = "live.unilag.edu.ng"

# name, student id, phone, dept, level, gender, budget range, sleep, clean, noise, guests, smokes, area, bio
USERS = [
    ("Amara Okafor", "DEMO0001", "+2348010000001", "Electrical Engineering", "200L", "female", (400000, 700000), "early", 5, 2, 2, False, "Akoka", "Neat, early riser, here to study."),
    ("Tolu Adeyemi", "DEMO0002", "+2348010000002", "Computer Science", "300L", "female", (450000, 800000), "early", 4, 2, 3, False, "Akoka", "CS student, quiet evenings."),
    ("Chiamaka Eze", "DEMO0003", "+2348010000003", "Law", "100L", "female", (300000, 600000), "late", 3, 4, 4, False, "Iwaya", "Night owl, love having friends over."),
    ("Ibrahim Musa", "DEMO0004", "+2348010000004", "Mechanical Engineering", "200L", "male", (500000, 900000), "flexible", 4, 3, 3, False, "Abule Oja", "Easygoing and tidy."),
    ("Femi Bakare", "DEMO0005", "+2348010000005", "Economics", "400L", "male", (600000, 1200000), "late", 2, 5, 5, True, "Onike", "Social, music, late nights."),
    ("Zainab Lawal", "DEMO0006", "+2348010000006", "Architecture", "300L", "female", (500000, 900000), "flexible", 4, 3, 2, False, "Akoka", "Creative, flexible schedule."),
]

# owner index, type, hall, price, label, duration, caption, urgent, image file
LISTINGS = [
    (3, "have_space", "Abule Oja", 650000, "₦650,000 / year", "1 year", "Self-contain, own bathroom, 8 min walk to campus gate.", False, "room_1.jpg"),
    (3, "have_space", "Iwaya", 520000, "₦520,000 / year", "1 year", "Shared 2-bed flat, prepaid light meter, tiled floors.", True, "room_2.jpg"),
    (4, "have_space", "Onike", 900000, "₦900,000 / year", "1 year", "Furnished room in a quiet compound with a borehole.", False, "room_3.jpg"),
    (4, "have_space", "Akoka", 780000, "₦780,000 / year", "1 year", "Mini flat close to the Akoka gate, 24h water.", False, "room_4.jpg"),
    (0, "have_space", "Akoka", 480000, "₦480,000 / year", "1 year", "One bed space in a 4-girl room, clean and secure.", True, "room_5.jpg"),
    (1, "have_space", "Akoka", 560000, "₦560,000 / year", "1 year", "Shared room with study desk and reading lamp.", False, "room_6.jpg"),
    (2, "need_space", "Iwaya", None, "Budget ₦500,000", "1 year", "Fresher looking for a female roommate near campus.", True, "need_1.jpg"),
    (5, "need_space", "Akoka", None, "Budget ₦700,000", "1 year", "Looking to split a 2-bed flat. Tidy and quiet.", False, "need_2.jpg"),
]


def run_seed(db: Session, image_base_url: str | None) -> dict:
    """image_base_url: public URL where /static/demo/<file> is reachable. None = no images."""
    summary = {"users_created": 0, "listings_created": 0, "images_attached": 0, "users_total": 0}

    users = []
    for (name, sid, phone, dept, level, gender, budget, sleep, clean, noise, guests, smokes, area, bio) in USERS:
        email = f"{sid.lower()}@{DEMO_EMAIL_DOMAIN}"
        user = db.query(models.User).filter(models.User.school_email == email).first()
        if not user:
            user = models.User(
                full_name=name, matric_number=sid, school_email=email, phone_number=phone,
                department=dept, level=level, hashed_password=hash_password(DEMO_PASSWORD),
                is_verified=True, verified_at=datetime.utcnow(), trust_score=0,
            )
            db.add(user)
            db.flush()
            db.add(models.RoommateProfile(
                user_id=user.id, gender=gender, same_gender_only=True,
                budget_min=budget[0], budget_max=budget[1], sleep_schedule=sleep,
                cleanliness=clean, noise_tolerance=noise, guests_comfort=guests,
                smokes=smokes, accepts_smoking=smokes, preferred_area=area, bio=bio,
            ))
            summary["users_created"] += 1
        users.append(user)
    db.commit()

    for owner_idx, ltype, hall, price, label, duration, caption, urgent, image in LISTINGS:
        owner = users[owner_idx]
        listing = (
            db.query(models.Listing)
            .filter(models.Listing.owner_id == owner.id, models.Listing.caption == caption)
            .first()
        )
        if not listing:
            listing = models.Listing(
                owner_id=owner.id, listing_type=models.ListingType(ltype), hall_name=hall,
                price_amount=price, price_label=label, duration=duration, caption=caption,
                is_urgent=urgent, media_type="image",
            )
            db.add(listing)
            summary["listings_created"] += 1
        if image_base_url and not listing.photo_url:
            listing.photo_url = f"{image_base_url.rstrip('/')}/static/demo/{image}"
            listing.media_type = "image"
            summary["images_attached"] += 1
    db.commit()

    summary["users_total"] = len(users)
    summary["demo_login"] = {
        "emails": [f"{u[1].lower()}@{DEMO_EMAIL_DOMAIN}" for u in USERS],
        "password": DEMO_PASSWORD,
    }
    return summary

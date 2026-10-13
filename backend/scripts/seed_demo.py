"""
Seeds demo data so the app never looks empty when recording.

    python -m scripts.seed_demo

Safe to re-run: existing demo accounts are skipped. All demo accounts use
the password below. Demo owners have NO bank details: log in as one and add
real Paystack test bank details in the app (Profile > Bank details) before
paying that owner's listings.
"""
from datetime import datetime

from app import models
from app.database import SessionLocal
from app.security import hash_password

PASSWORD = "DemoPass123!"

USERS = [
    # name, matric, phone, dept, level, gender, budget range, sleep, clean, noise, guests, smokes, area, bio
    ("Amara Okafor", "DEMO0001", "+2348010000001", "Electrical Engineering", "200L", "female", (400000, 700000), "early", 5, 2, 2, False, "Akoka", "Neat, early riser, here to study."),
    ("Tolu Adeyemi", "DEMO0002", "+2348010000002", "Computer Science", "300L", "female", (450000, 800000), "early", 4, 2, 3, False, "Akoka", "CS student, quiet evenings."),
    ("Chiamaka Eze", "DEMO0003", "+2348010000003", "Law", "100L", "female", (300000, 600000), "late", 3, 4, 4, False, "Iwaya", "Night owl, love having friends over."),
    ("Ibrahim Musa", "DEMO0004", "+2348010000004", "Mechanical Engineering", "200L", "male", (500000, 900000), "flexible", 4, 3, 3, False, "Abule Oja", "Easygoing and tidy."),
    ("Femi Bakare", "DEMO0005", "+2348010000005", "Economics", "400L", "male", (600000, 1200000), "late", 2, 5, 5, True, "Onike", "Social, music, late nights."),
    ("Zainab Lawal", "DEMO0006", "+2348010000006", "Architecture", "300L", "female", (500000, 900000), "flexible", 4, 3, 2, False, "Akoka", "Creative, flexible schedule."),
]

# owner index, type, hall, price, label, duration, caption, urgent
LISTINGS = [
    (3, "have_space", "Abule Oja", 650000, "₦650,000 / year", "1 year", "Self-contain, own bathroom, 8 min walk to campus gate.", False),
    (3, "have_space", "Iwaya", 520000, "₦520,000 / year", "1 year", "Shared 2-bed flat, prepaid light meter, tiled floors.", True),
    (4, "have_space", "Onike", 900000, "₦900,000 / year", "1 year", "Furnished room in a quiet compound with a borehole.", False),
    (4, "have_space", "Akoka", 780000, "₦780,000 / year", "1 year", "Mini flat close to the Akoka gate, 24h water.", False),
    (0, "have_space", "Akoka", 480000, "₦480,000 / year", "1 year", "One bed space in a 4-girl room, clean and secure.", True),
    (1, "have_space", "Akoka", 560000, "₦560,000 / year", "1 year", "Shared room with study desk and reading lamp.", False),
    (2, "need_space", "Iwaya", None, "Budget ₦500,000", "1 year", "Fresher looking for a female roommate near campus.", True),
    (5, "need_space", "Akoka", None, "Budget ₦700,000", "1 year", "Looking to split a 2-bed flat. Tidy and quiet.", False),
]


def main() -> None:
    db = SessionLocal()
    try:
        created_users = []
        for (name, matric, phone, dept, level, gender, budget, sleep, clean, noise, guests, smokes, area, bio) in USERS:
            email = f"{matric.lower()}@live.unilag.edu.ng"
            user = db.query(models.User).filter(models.User.school_email == email).first()
            if not user:
                user = models.User(
                    full_name=name, matric_number=matric, school_email=email, phone_number=phone,
                    faculty=None, department=dept, level=level,
                    hashed_password=hash_password(PASSWORD),
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
                print(f"created user {email}")
            created_users.append(user)
        db.commit()

        for owner_idx, ltype, hall, price, label, duration, caption, urgent in LISTINGS:
            owner = created_users[owner_idx]
            exists = (
                db.query(models.Listing)
                .filter(models.Listing.owner_id == owner.id, models.Listing.caption == caption)
                .first()
            )
            if exists:
                continue
            db.add(models.Listing(
                owner_id=owner.id, listing_type=models.ListingType(ltype), hall_name=hall,
                price_amount=price, price_label=label, duration=duration, caption=caption,
                is_urgent=urgent, media_type="image",
            ))
            print(f"created listing: {hall} ({ltype})")
        db.commit()
        print(f"\nDone. Log in with any demo email (e.g. demo0001@live.unilag.edu.ng) and password: {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

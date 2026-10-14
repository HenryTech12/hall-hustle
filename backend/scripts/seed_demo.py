"""
Command-line version of POST /admin/seed-demo.

    python -m scripts.seed_demo https://<your-api>.onrender.com

The URL is where the API's /static/demo images are publicly reachable; omit it
to seed without images. Safe to re-run.
"""
import sys

from app.database import SessionLocal
from app.services.demo_seed import run_seed


def main() -> None:
    base = sys.argv[1] if len(sys.argv) > 1 else None
    db = SessionLocal()
    try:
        print(run_seed(db, image_base_url=base))
    finally:
        db.close()


if __name__ == "__main__":
    main()

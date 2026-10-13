# HallHustle update: how to apply

Copy the files in `backend/` and `frontend/` over your projects (same paths).

## Backend
1. **Render env vars: delete `ALLOWED_EMAIL_DOMAINS`** (or set it empty). If it still holds the UNILAG
   domains, signup will keep rejecting normal emails. Empty = any email accepted.
2. `alembic upgrade head`  (roommate_profiles table, 11 indexes, matric_number becomes optional)
3. `python -m scripts.seed_demo`  -> run it against your DEPLOYED database (the Render DATABASE_URL),
   not just locally. 6 demo students, 8 listings, password `DemoPass123!`.
4. Paystack dashboard (test mode):
   - Webhook URL: `https://<your-render-app>/payments/webhook`
   - Turn OFF the OTP requirement for transfers (otherwise release returns 409)
5. Log in as a demo owner (e.g. demo0004@live.unilag.edu.ng) and add test bank details
   (Profile > Bank details), otherwise paying that owner's listings is blocked.

## Frontend
`npm run build`, deploy to Vercel. No new dependencies.

## Email / verification model
- Any valid email can sign up. An emailed OTP proves the person controls the inbox (badge: "Email verified").
- If the email's domain is a school domain (.edu, .edu.ng, .ac.uk, .ac.za, ...) the badge reads
  "Student email verified". The API exposes this as `is_student_email`.
- Student ID / matric number is optional. API field names still say `school_email` for compatibility.

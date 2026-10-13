# HallHustle Backend

FastAPI backend for HallHustle — a matric-verified UNILAG student housing
marketplace (bed spaces, squatting, roommate matching) with escrow-protected
payments via Paystack.

## Stack
- FastAPI + SQLAlchemy + PostgreSQL + Alembic (migrations)
- JWT auth (python-jose + passlib/bcrypt)
- **Brevo** — email OTP verification (proves ownership of `@live.unilag.edu.ng`)
- **Cloudinary** — listing photo storage
- **Paystack** — charges + transfers (escrow logic built on top — Paystack
  has no native escrow product, see `app/services/paystack.py` docstring)
- **slowapi** — rate limiting on auth/OTP/payment endpoints
- WebSockets for real-time chat (polling endpoints still available too)

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# fill in DATABASE_URL, JWT_SECRET_KEY, Paystack test keys,
# RESEND_API_KEY, and Cloudinary credentials

alembic upgrade head   # creates all tables via migration, not create_all()

uvicorn app.main:app --reload
```

API docs live at `http://localhost:8000/docs`.

## Signing up for the services you'll need

- **Paystack**: dashboard → Settings → API Keys & Webhooks (test keys are free)
- **Brevo**: https://brevo.com — free tier is 300 emails/day, permanent
  (not a trial). Get your API key from Settings → SMTP & API → API Keys.
  Sender setup is lightweight: verify a single sender email address
  (click a confirmation link Brevo emails you) rather than proving DNS
  ownership of a whole domain — no SPF/DKIM/domain records required to
  start sending. You can add full domain verification later for better
  deliverability, but it's optional at this stage.
- **Cloudinary**: https://cloudinary.com — free tier covers ~25GB
  storage/bandwidth, plenty for MVP. Cloud name, API key, and secret are
  all on your dashboard home page.

## Email OTP verification flow (matric verification)

UNILAG doesn't expose a public API to verify student records, but student
email (`matricno@live.unilag.edu.ng`) is provisioned by UNILAG's own IT
department via Microsoft 365 — only enrolled students get one. So instead
of needing an official API, HallHustle verifies **ownership of that
inbox**, which is a reliable proxy for "this is a real student":

1. `POST /auth/signup` — creates the user as `is_verified=False`, sends a
   6-digit OTP to their `school_email` via Brevo
2. `POST /auth/verify-otp` — checks the code (hashed, expires after
   `OTP_EXPIRE_MINUTES`, max `OTP_MAX_ATTEMPTS` tries), flips
   `is_verified=True`, returns a JWT
3. `POST /auth/resend-otp` — invalidates old codes, sends a fresh one
   (rate-limited to 3/hour to prevent spam/abuse)
4. `POST /auth/login` blocks unverified accounts

OTP codes are hashed with SHA-256 before storage (not bcrypt — OTPs are
short-lived and low-entropy, so bcrypt's deliberate slowness just adds
latency for no real benefit here).

## Escrow flow (how the money actually moves)

1. **Initialize** — `POST /payments/escrow/initialize` — payer starts a
   payment for a listing. Creates an `EscrowTransaction` row with
   `status=pending` and returns a Paystack checkout URL. Blocked if the
   payee hasn't registered bank details yet.
2. **Webhook confirms** — `POST /payments/webhook` (Paystack calls this,
   not the frontend) — flips status to `held` once the charge is verified
   server-side. Signature-verified against `PAYSTACK_WEBHOOK_SECRET`.
3. **Release** — `POST /payments/escrow/{id}/release` — only the **payer**
   can call this, confirming the deal went through (e.g. move-in
   happened). Triggers a real Paystack Transfer to the payee's bank.
4. **Dispute** — `POST /payments/escrow/{id}/dispute` — either party can
   freeze a `held` transaction pending manual review.
5. **Refund** — `POST /payments/escrow/{id}/refund` — **admin-only**
   (`is_admin=True` required). Reverses a `held`/`disputed` transaction.

Payees must call `POST /auth/bank-details` first (resolves their account
via Paystack and registers a transfer recipient) before they can receive
a payout.

### Making yourself an admin

There's no signup flag for this on purpose — you don't want strangers
setting `is_admin=True` on themselves. Do it directly in the DB:

```sql
UPDATE users SET is_admin = true WHERE school_email = 'you@live.unilag.edu.ng';
```

## Photo uploads (Cloudinary)

```
POST /uploads/listing-photo/{listing_id}   (multipart/form-data, field name "file")
```

Returns `{ "photo_url": "https://res.cloudinary.com/..." }`. Attach it to
the listing afterward with `PATCH /listings/{listing_id}`. Kept as a
separate step so the frontend can show upload progress independently of
the rest of the form. Max 8MB, JPEG/PNG/WebP/HEIC only; images are
auto-resized to fit 1080×1080 and quality-optimized on Cloudinary's side.

## Real-time chat (WebSockets)

```
GET /messages/thread/{listing_id}/{other_user_id}   — polling, still works fine for MVP
WS  /messages/ws/{listing_id}/{other_user_id}?token=<jwt>   — real-time push
```

Since browsers can't set custom headers on a WebSocket handshake, the JWT
goes in the query string instead of an `Authorization` header — the
standard workaround. That does mean tokens can land in access logs, so
use short-lived tokens if that's a concern for your deployment. Connect
once per open chat screen; messages are persisted to the same `messages`
table the polling endpoint reads from, so both approaches stay in sync.

## Rate limiting

Applied via `slowapi`, keyed by client IP (see `app/rate_limit.py`):

| Endpoint | Limit |
|---|---|
| `POST /auth/signup` | 5/hour |
| `POST /auth/login` | 10/hour |
| `POST /auth/verify-otp` | 10/hour |
| `POST /auth/resend-otp` | 3/hour |
| `POST /payments/escrow/initialize` | 20/hour |

If you deploy behind a load balancer or reverse proxy, make sure it
forwards the real client IP (`X-Forwarded-For`) correctly, or these limits
will key off the proxy's IP instead of the actual user.

## Database migrations (Alembic)

Schema is now managed by Alembic instead of `Base.metadata.create_all()`.

```bash
# after changing any model in app/models.py:
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

The initial migration (`alembic/versions/..._initial_schema.py`) was
autogenerated and verified against a clean SQLite database — all five
tables (`users`, `listings`, `messages`, `escrow_transactions`,
`email_otps`) create correctly.

## Remaining known gaps before public launch

- **Matric verification** only confirms email ownership, not identity —
  someone with access to a graduated/inactive `@live.unilag.edu.ng`
  inbox could still sign up. Low-risk edge case at MVP scale; consider
  Termii SMS OTP or ID-upload review if it becomes a real problem.
- **No admin UI** — granting `is_admin` and resolving disputes/refunds is
  currently a direct DB operation. Fine while it's just you; build a
  small internal dashboard once you're not the only admin.
- **WebSocket auth via query param** — functional but logs the JWT in
  access logs; rotate/short-expire tokens if this matters for your setup.
- **No test suite yet** — the flows in this README were manually verified
  end-to-end during development (signup → OTP → verify, all routes
  wiring, Alembic migration against a real DB), but there's no automated
  pytest suite. Worth adding once the API surface stabilizes.

## Project structure

```
app/
  main.py              FastAPI app, router + rate-limiter wiring
  config.py            Settings loaded from .env
  database.py          SQLAlchemy engine/session
  models.py            User, Listing, Message, EmailOTP, EscrowTransaction
  schemas.py           Pydantic request/response models
  security.py          Password hashing, JWT, OTP generation/hashing
  deps.py              get_db, get_current_user, get_current_verified_user, get_current_admin_user
  rate_limit.py         Shared slowapi Limiter instance
  routers/
    auth.py            Signup, OTP verification, login, bank details
    listings.py        Create/browse/filter listings, mark interested
    messages.py        In-app chat — polling endpoints + WebSocket real-time
    payments.py        Escrow initialize/webhook/release/dispute/refund (admin-gated)
    uploads.py         Cloudinary photo upload
  services/
    paystack.py        Raw Paystack API wrapper (charges, transfers, webhook verify)
    brevo_email.py      OTP email delivery via Brevo
    cloudinary_service.py   Photo upload to Cloudinary
alembic/
  env.py               Wired to app's Base.metadata + settings.DATABASE_URL
  versions/            Migration history (starts with initial schema)
```

## Photos, video, and music on listings

- `POST /uploads/listing-media/{listing_id}` — accepts an image (JPEG/PNG/WebP/HEIC, max 8MB) or a video (MP4/MOV/WebM, max 50MB). Returns `{ photo_url, media_type }` — attach both fields via `PATCH /listings/{id}`.
- `POST /uploads/listing-music/{listing_id}` — optional background audio track (MP3/M4A/WAV/AAC, max 10MB) for a listing, played back muted-by-default in the feed with a tap-to-unmute control (same pattern as Reels/TikTok — browsers block audible autoplay regardless). Returns `{ music_url }`.
- Only upload audio you have the rights to use — same copyright rule as any social platform; this isn't enforced technically, it's on the person posting.

**Frontend bug this fixes:** the original upload call manually set
`Content-Type: multipart/form-data` on the request, which strips the
`boundary` parameter the server needs to actually parse the file — this
silently broke every photo upload (listing posted, but the image never
attached). Fixed by letting axios generate the header itself.

## Interested/like tracking

`POST /listings/{id}/interested` is now backed by a `listing_interests`
table (unique on `listing_id` + `user_id`) instead of a bare counter.
This means:
- Calling it multiple times for the same user is a no-op after the first call — it can no longer be spammed to inflate the count
- `GET /listings`, `/listings/urgent`, and `/listings/{id}` all return `is_interested_by_me` for the calling user (via an optional-auth dependency — works whether or not a token is sent), so the frontend correctly shows the heart as already-filled after a refresh instead of resetting to unliked every time
- `DELETE /listings/{id}/interested` lets a user un-like

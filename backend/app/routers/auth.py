from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.rate_limit import limiter
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_otp_code,
    hash_otp_code,
    verify_otp_code,
)
from app.services import paystack
from app.services.brevo_email import send_otp_email, BrevoError

router = APIRouter(prefix="/auth", tags=["auth"])


def _check_email_allowed(email: str) -> None:
    """Any email is accepted unless ALLOWED_EMAIL_DOMAINS is set in the environment."""
    allowed = settings.allowed_email_domains_list
    if not allowed:
        return
    domain = email.split("@")[-1].lower()
    if domain not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Please sign up with an email from: {', '.join(allowed)}.",
        )


async def _issue_and_send_otp(db: Session, user: models.User, purpose: str = "signup_verification"):
    code = generate_otp_code()

    otp = models.EmailOTP(
        user_id=user.id,
        code_hash=hash_otp_code(code),
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(otp)
    db.commit()

    try:
        await send_otp_email(to_email=user.school_email, code=code, full_name=user.full_name)
    except BrevoError as e:
        # Don't leave a dangling unusable OTP row if the email never went out
        db.delete(otp)
        db.commit()
        raise HTTPException(status_code=502, detail=f"Could not send verification email: {e}")


@router.post("/signup", response_model=schemas.SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def signup(request: Request, payload: schemas.SignupRequest, db: Session = Depends(get_db)):
    _check_email_allowed(payload.school_email)

    conditions = [
        models.User.school_email == payload.school_email.lower(),
        models.User.phone_number == payload.phone_number,
    ]
    if payload.matric_number:
        conditions.append(models.User.matric_number == payload.matric_number)
    existing = db.query(models.User).filter(or_(*conditions)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email, student ID, or phone number already exists.",
        )

    user = models.User(
        full_name=payload.full_name,
        matric_number=payload.matric_number,
        school_email=payload.school_email.lower(),
        phone_number=payload.phone_number,
        faculty=payload.faculty,
        department=payload.department,
        level=payload.level,
        hashed_password=hash_password(payload.password),
        is_verified=False,  # only flips true after OTP confirmation
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    await _issue_and_send_otp(db, user, purpose="signup_verification")

    return schemas.SignupResponse(
        message="Account created. Check your email for a verification code.",
        user_id=user.id,
        school_email=user.school_email,
    )


@router.post("/verify-otp", response_model=schemas.TokenResponse)
@limiter.limit("10/hour")
def verify_otp(request: Request, payload: schemas.VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.school_email == payload.school_email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email.")

    if user.is_verified:
        token = create_access_token(subject=user.id)
        return schemas.TokenResponse(access_token=token, user=schemas.UserOut.model_validate(user))

    otp = (
        db.query(models.EmailOTP)
        .filter(
            models.EmailOTP.user_id == user.id,
            models.EmailOTP.consumed_at.is_(None),
        )
        .order_by(models.EmailOTP.created_at.desc())
        .first()
    )

    if not otp:
        raise HTTPException(status_code=400, detail="No pending verification code. Request a new one.")

    if otp.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This code has expired. Request a new one.")

    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")

    otp.attempts += 1
    db.commit()

    if not verify_otp_code(payload.code, otp.code_hash):
        raise HTTPException(status_code=400, detail="Incorrect code.")

    otp.consumed_at = datetime.utcnow()
    user.is_verified = True
    user.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id)
    return schemas.TokenResponse(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/resend-otp", status_code=status.HTTP_200_OK)
@limiter.limit("3/hour")
async def resend_otp(request: Request, payload: schemas.RequestOtpRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.school_email == payload.school_email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email.")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="This account is already verified.")

    # Invalidate any prior unconsumed OTPs so only the latest one is valid
    db.query(models.EmailOTP).filter(
        models.EmailOTP.user_id == user.id, models.EmailOTP.consumed_at.is_(None)
    ).update({"consumed_at": datetime.utcnow()})
    db.commit()

    await _issue_and_send_otp(db, user, purpose="signup_verification")
    return {"message": "A new verification code has been sent."}


@router.post("/login", response_model=schemas.TokenResponse)
@limiter.limit("10/hour")
def login(request: Request, payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.school_email == payload.school_email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    token = create_access_token(subject=user.id)
    return schemas.TokenResponse(access_token=token, user=schemas.UserOut.model_validate(user))


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/bank-details", response_model=schemas.UserOut)
async def set_bank_details(
    payload: schemas.BankDetailsRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Registers the bank account HallHustle will pay out to when this user
    is the payee in an escrow transaction. Resolves the account name via
    Paystack first so we never guess who we're paying.
    """
    try:
        resolved = await paystack.resolve_account_number(
            account_number=payload.bank_account_number,
            bank_code=payload.bank_code,
        )

        recipient = await paystack.create_transfer_recipient(
            name=resolved["account_name"],
            account_number=payload.bank_account_number,
            bank_code=payload.bank_code,
        )
    except paystack.PaystackError as e:
        raise HTTPException(status_code=502, detail=f"Could not verify bank details: {e}")

    current_user.bank_code = payload.bank_code
    current_user.bank_account_number = payload.bank_account_number
    current_user.bank_account_name = resolved["account_name"]
    current_user.paystack_recipient_code = recipient["recipient_code"]

    db.commit()
    db.refresh(current_user)
    return current_user

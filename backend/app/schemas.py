from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import ListingType, ListingStatus, EscrowStatus


# ---------- Auth / Users ----------

class SignupRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    matric_number: Optional[str] = Field(default=None, max_length=40)  # optional student ID
    school_email: EmailStr  # any valid email (field name kept for API compatibility)
    phone_number: str = Field(min_length=10, max_length=20)
    password: str = Field(min_length=8, max_length=100)
    faculty: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None

    @field_validator("matric_number")
    @classmethod
    def clean_matric(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if not v:
            return None
        if len(v) < 3:
            raise ValueError("Student ID must be at least 3 characters")
        return v

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        v = v.strip().replace(" ", "")
        if v.startswith("0"):
            v = "+234" + v[1:]
        elif v.startswith("234"):
            v = "+" + v
        return v


class LoginRequest(BaseModel):
    school_email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    full_name: str
    matric_number: Optional[str] = None
    school_email: EmailStr
    phone_number: str
    faculty: Optional[str]
    department: Optional[str]
    level: Optional[str]
    is_verified: bool
    is_student_email: bool = False
    is_admin: bool
    trust_score: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SignupResponse(BaseModel):
    message: str
    user_id: str
    school_email: EmailStr


class RequestOtpRequest(BaseModel):
    school_email: EmailStr


class VerifyOtpRequest(BaseModel):
    school_email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class BankDetailsRequest(BaseModel):
    bank_code: str
    bank_account_number: str = Field(min_length=10, max_length=10)


# ---------- Listings ----------

class MediaUploadResponse(BaseModel):
    photo_url: str
    media_type: str


class MusicUploadResponse(BaseModel):
    music_url: str


class ListingCreate(BaseModel):
    listing_type: ListingType
    hall_name: str = Field(min_length=2, max_length=100)
    price_amount: Optional[Decimal] = None
    price_label: Optional[str] = None
    duration: Optional[str] = None
    caption: Optional[str] = None
    photo_url: Optional[str] = None
    media_type: Optional[str] = "image"
    music_url: Optional[str] = None
    is_urgent: bool = False


class ListingUpdate(BaseModel):
    status: Optional[ListingStatus] = None
    price_amount: Optional[Decimal] = None
    price_label: Optional[str] = None
    caption: Optional[str] = None
    is_urgent: Optional[bool] = None
    photo_url: Optional[str] = None
    media_type: Optional[str] = None
    music_url: Optional[str] = None


class ListingOwnerOut(BaseModel):
    id: str
    full_name: str
    is_verified: bool
    is_student_email: bool = False
    trust_score: int

    model_config = {"from_attributes": True}


class ListingOut(BaseModel):
    id: str
    owner: ListingOwnerOut
    listing_type: ListingType
    hall_name: str
    price_amount: Optional[Decimal]
    price_label: Optional[str]
    duration: Optional[str]
    caption: Optional[str]
    photo_url: Optional[str]
    media_type: str
    music_url: Optional[str]
    is_urgent: bool
    status: ListingStatus
    interested_count: int
    is_interested_by_me: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Messages ----------

class MessageCreate(BaseModel):
    listing_id: str
    receiver_id: str
    body: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: str
    listing_id: str
    sender_id: str
    receiver_id: str
    body: str
    created_at: datetime
    read_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ConversationParticipant(BaseModel):
    id: str
    full_name: str
    is_verified: bool

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    listing_id: str
    hall_name: Optional[str] = None
    other_user: ConversationParticipant
    last_message: str
    last_message_at: datetime
    last_message_is_mine: bool
    unread_count: int


class UnreadCountOut(BaseModel):
    count: int


class PublicUserOut(BaseModel):
    id: str
    full_name: str
    is_verified: bool
    is_student_email: bool = False
    trust_score: int
    phone_number: str

    model_config = {"from_attributes": True}


# ---------- Escrow / Payments ----------

class EscrowInitRequest(BaseModel):
    listing_id: str
    payee_id: str
    amount: Decimal = Field(gt=0, description="Amount in Naira")


class EscrowInitResponse(BaseModel):
    escrow_id: str
    authorization_url: str
    access_code: str
    reference: str


class EscrowOut(BaseModel):
    id: str
    listing_id: str
    payer_id: str
    payee_id: str
    amount: Decimal
    platform_fee: Decimal
    paystack_reference: str
    status: EscrowStatus
    created_at: datetime
    held_at: Optional[datetime]
    released_at: Optional[datetime]
    refunded_at: Optional[datetime]
    dispute_reason: Optional[str] = None
    # Filled in by the payments router (not stored on the row)
    hall_name: Optional[str] = None
    payout_amount: Optional[Decimal] = None

    model_config = {"from_attributes": True}


class DisputeRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)


# ---------- Roommate matching ----------

SLEEP_SCHEDULES = {"early", "flexible", "late"}
GENDERS = {"male", "female"}


class RoommateProfileIn(BaseModel):
    gender: str
    same_gender_only: bool = True
    budget_min: int = Field(ge=0, le=100_000_000, description="Naira per year")
    budget_max: int = Field(ge=0, le=100_000_000)
    sleep_schedule: str
    cleanliness: int = Field(ge=1, le=5)
    noise_tolerance: int = Field(ge=1, le=5)
    guests_comfort: int = Field(ge=1, le=5)
    smokes: bool = False
    accepts_smoking: bool = False
    preferred_area: Optional[str] = Field(default=None, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=280)
    is_active: bool = True

    @field_validator("gender")
    @classmethod
    def check_gender(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in GENDERS:
            raise ValueError("gender must be 'male' or 'female'")
        return v

    @field_validator("sleep_schedule")
    @classmethod
    def check_sleep(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in SLEEP_SCHEDULES:
            raise ValueError("sleep_schedule must be 'early', 'flexible' or 'late'")
        return v

    @field_validator("budget_max")
    @classmethod
    def check_budget_range(cls, v: int, info) -> int:
        lo = info.data.get("budget_min")
        if lo is not None and v < lo:
            raise ValueError("budget_max must be greater than or equal to budget_min")
        return v


class RoommateProfileOut(RoommateProfileIn):
    id: str
    user_id: str
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RoommateUserOut(BaseModel):
    id: str
    full_name: str
    is_verified: bool
    trust_score: int
    department: Optional[str] = None
    level: Optional[str] = None

    model_config = {"from_attributes": True}


class RoommateMatchOut(BaseModel):
    user: RoommateUserOut
    score: int
    reasons: list[str]
    cautions: list[str]
    bio: Optional[str] = None
    preferred_area: Optional[str] = None
    budget_min: int
    budget_max: int
    listing_id: Optional[str] = None  # their latest active listing, if any (enables in-app chat)


class CompatibilityOut(BaseModel):
    score: Optional[int] = None
    reasons: list[str] = []
    cautions: list[str] = []

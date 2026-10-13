import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Enum,
    Numeric,
    Integer,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.services.email_rules import is_academic_email


def gen_uuid():
    return str(uuid.uuid4())


class ListingType(str, enum.Enum):
    NEED_SPACE = "need_space"
    HAVE_SPACE = "have_space"


class ListingStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    FLAGGED = "flagged"


class EscrowStatus(str, enum.Enum):
    PENDING = "pending"      # payment initialized, not yet confirmed by Paystack
    HELD = "held"            # payment confirmed, funds held pending release
    RELEASED = "released"    # funds transferred to payee
    REFUNDED = "refunded"    # funds returned to payer
    DISPUTED = "disputed"    # frozen pending manual review
    FAILED = "failed"        # payment failed / never completed


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    full_name = Column(String(120), nullable=False)
    matric_number = Column(String(40), unique=True, nullable=True, index=True)  # optional student ID
    school_email = Column(String(150), unique=True, nullable=False, index=True)
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    faculty = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    level = Column(String(10), nullable=True)  # e.g. "100L"

    hashed_password = Column(String(255), nullable=False)

    is_verified = Column(Boolean, default=False)  # email ownership confirmed via OTP
    verified_at = Column(DateTime, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)

    # Bank details for receiving escrow payouts (Paystack transfer recipient)
    bank_code = Column(String(10), nullable=True)
    bank_account_number = Column(String(20), nullable=True)
    bank_account_name = Column(String(150), nullable=True)
    paystack_recipient_code = Column(String(60), nullable=True)

    trust_score = Column(Integer, default=0)  # simple reputation counter

    created_at = Column(DateTime, default=datetime.utcnow)

    listings = relationship("Listing", back_populates="owner", cascade="all, delete-orphan")

    @property
    def is_student_email(self) -> bool:
        """True when the (OTP-verified) email belongs to a school/university domain."""
        return bool(self.is_verified) and is_academic_email(self.school_email)


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        # Feed query: WHERE status = 'active' ORDER BY is_urgent DESC, created_at DESC
        Index("ix_listings_status_created_at", "status", "created_at"),
        Index("ix_listings_owner_id", "owner_id"),
        Index("ix_listings_listing_type", "listing_type"),
    )

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    listing_type = Column(Enum(ListingType), nullable=False)
    hall_name = Column(String(100), nullable=False)
    price_amount = Column(Numeric(12, 2), nullable=True)  # null if "negotiable"
    price_label = Column(String(60), nullable=True)  # e.g. "₦150,000 / semester"
    duration = Column(String(60), nullable=True)
    caption = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    media_type = Column(String(10), default="image")  # "image" or "video"
    music_url = Column(String(500), nullable=True)  # optional background audio track

    is_urgent = Column(Boolean, default=False)
    status = Column(Enum(ListingStatus), default=ListingStatus.ACTIVE)

    interested_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="listings")
    messages = relationship("Message", back_populates="listing", cascade="all, delete-orphan")
    escrow_transactions = relationship("EscrowTransaction", back_populates="listing")
    interests = relationship("ListingInterest", back_populates="listing", cascade="all, delete-orphan")


class ListingInterest(Base):
    """
    Tracks which user marked which listing as 'interested', so the action
    is idempotent (one mark per user per listing) instead of an unlimited
    counter anyone can spam, and so the frontend can correctly show the
    heart as already-filled after a page refresh.
    """

    __tablename__ = "listing_interests"
    __table_args__ = (UniqueConstraint("listing_id", "user_id", name="uq_listing_user_interest"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    listing_id = Column(UUID(as_uuid=False), ForeignKey("listings.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    listing = relationship("Listing", back_populates="interests")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_listing_id", "listing_id"),
        # Unread counts / inbox: WHERE receiver_id = ? AND read_at IS NULL
        Index("ix_messages_receiver_read", "receiver_id", "read_at"),
        Index("ix_messages_sender_id", "sender_id"),
    )

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    listing_id = Column(UUID(as_uuid=False), ForeignKey("listings.id"), nullable=False)
    sender_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    receiver_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)

    listing = relationship("Listing", back_populates="messages")


class EmailOTP(Base):
    """
    Short-lived verification codes sent to the user's email address
    address. Proving ownership of that inbox is the actual verification
    mechanism, since UNILAG (not us) controls who gets issued one.
    """

    __tablename__ = "email_otps"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    code_hash = Column(String(128), nullable=False)
    purpose = Column(String(30), default="signup_verification")

    attempts = Column(Integer, default=0)
    consumed_at = Column(DateTime, nullable=True)

    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EscrowTransaction(Base):
    """
    Ledger of funds moving through HallHustle's Paystack merchant account.
    HallHustle collects the full payment (status=held), and only releases it
    to the payee's bank account via Paystack Transfer once move-in is confirmed.
    """

    __tablename__ = "escrow_transactions"
    __table_args__ = (
        Index("ix_escrow_transactions_payer_id", "payer_id"),
        Index("ix_escrow_transactions_payee_id", "payee_id"),
        Index("ix_escrow_transactions_status", "status"),
    )

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    listing_id = Column(UUID(as_uuid=False), ForeignKey("listings.id"), nullable=False)
    payer_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    payee_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    amount = Column(Numeric(12, 2), nullable=False)  # in Naira
    platform_fee = Column(Numeric(12, 2), default=0)

    paystack_reference = Column(String(100), unique=True, nullable=False, index=True)
    paystack_transfer_code = Column(String(100), nullable=True)

    status = Column(Enum(EscrowStatus), default=EscrowStatus.PENDING)

    dispute_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    held_at = Column(DateTime, nullable=True)
    released_at = Column(DateTime, nullable=True)
    refunded_at = Column(DateTime, nullable=True)

    listing = relationship("Listing", back_populates="escrow_transactions")


class RoommateProfile(Base):
    """
    Lifestyle questionnaire used for roommate compatibility scoring.
    One row per user. Scoring itself lives in app/services/roommate_match.py.
    """

    __tablename__ = "roommate_profiles"
    __table_args__ = (
        Index("ix_roommate_profiles_gender_active", "gender", "is_active"),
        Index("ix_roommate_profiles_budget", "budget_min", "budget_max"),
    )

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), unique=True, nullable=False)

    gender = Column(String(10), nullable=False)  # "male" | "female"
    same_gender_only = Column(Boolean, default=True, nullable=False)

    budget_min = Column(Integer, nullable=False)  # Naira per year
    budget_max = Column(Integer, nullable=False)

    sleep_schedule = Column(String(10), nullable=False)  # "early" | "flexible" | "late"
    cleanliness = Column(Integer, nullable=False)  # 1 = relaxed, 5 = very tidy
    noise_tolerance = Column(Integer, nullable=False)  # 1 = needs quiet, 5 = fine with noise
    guests_comfort = Column(Integer, nullable=False)  # 1 = rarely, 5 = often

    smokes = Column(Boolean, default=False, nullable=False)
    accepts_smoking = Column(Boolean, default=False, nullable=False)

    preferred_area = Column(String(100), nullable=True)  # e.g. "Akoka"
    bio = Column(String(280), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

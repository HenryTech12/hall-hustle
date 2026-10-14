import json
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.database import get_db
from app.deps import get_current_verified_user, get_current_admin_user
from app.services import paystack
from app.rate_limit import limiter

router = APIRouter(prefix="/payments", tags=["payments"])

PLATFORM_FEE_PERCENT = 2.5  # HallHustle's cut, taken out at release time


def _kobo(amount) -> int:
    return int(round(float(amount) * 100))


def _to_out(escrow: models.EscrowTransaction) -> schemas.EscrowOut:
    out = schemas.EscrowOut.model_validate(escrow)
    out.hall_name = escrow.listing.hall_name if escrow.listing else None
    out.payout_amount = Decimal(str(escrow.amount)) - Decimal(str(escrow.platform_fee or 0))
    return out


def _apply_verified_charge(escrow: models.EscrowTransaction, verified: dict) -> str:
    """
    Moves a PENDING escrow forward based on Paystack's own verification data
    (never on anything the client sent). Shared by the webhook and the
    verify-by-reference endpoint so both behave identically.
    Returns one of: held | failed | pending | amount_mismatch | unchanged
    """
    if escrow.status != models.EscrowStatus.PENDING:
        return "unchanged"

    pstatus = verified.get("status")
    if pstatus == "success":
        if int(verified.get("amount", 0)) != _kobo(escrow.amount):
            return "amount_mismatch"  # never hold funds for a different amount than expected
        escrow.status = models.EscrowStatus.HELD
        escrow.held_at = datetime.utcnow()
        return "held"
    if pstatus in ("failed", "reversed"):
        escrow.status = models.EscrowStatus.FAILED
        return "failed"
    return "pending"  # abandoned / ongoing


@router.post("/escrow/initialize", response_model=schemas.EscrowInitResponse)
@limiter.limit("20/hour")
async def initialize_escrow(
    request: Request,
    payload: schemas.EscrowInitRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    Step 1 of escrow: the payer (squatter) starts a payment. Funds land in
    HallHustle's own Paystack merchant account — nothing goes to the payee
    yet. The escrow_transactions row is created with status=pending and
    flips to `held` once the webhook confirms the charge succeeded.
    """
    listing = db.query(models.Listing).filter(models.Listing.id == payload.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.status != models.ListingStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="This listing is no longer active.")
    if listing.listing_type != models.ListingType.HAVE_SPACE:
        raise HTTPException(status_code=400, detail="Escrow payments are only available for 'have space' listings.")
    if listing.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't pay for your own listing.")
    if payload.payee_id != listing.owner_id:
        raise HTTPException(status_code=400, detail="Payee must be the owner of this listing.")
    if listing.price_amount is not None and payload.amount > listing.price_amount:
        raise HTTPException(status_code=400, detail="Amount can't be higher than the listing price.")

    payee = db.query(models.User).filter(models.User.id == payload.payee_id).first()
    if not payee:
        raise HTTPException(status_code=404, detail="Payee not found")
    if not payee.paystack_recipient_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user hasn't added bank details yet, so funds can't be released to them.",
        )

    reference = paystack.generate_reference("HH-ESC")

    escrow = models.EscrowTransaction(
        listing_id=payload.listing_id,
        payer_id=current_user.id,
        payee_id=payload.payee_id,
        amount=payload.amount,
        platform_fee=round(float(payload.amount) * PLATFORM_FEE_PERCENT / 100, 2),
        paystack_reference=reference,
        status=models.EscrowStatus.PENDING,
    )
    db.add(escrow)
    db.commit()
    db.refresh(escrow)

    try:
        data = await paystack.initialize_transaction(
            email=current_user.school_email,
            amount_naira=payload.amount,
            reference=reference,
            metadata={
                "escrow_transaction_id": escrow.id,
                "listing_id": payload.listing_id,
                "payer_id": current_user.id,
                "payee_id": payload.payee_id,
            },
            callback_url=f"{settings.FRONTEND_URL}/payments/callback",
        )
    except paystack.PaystackError as e:
        escrow.status = models.EscrowStatus.FAILED
        db.commit()
        raise HTTPException(status_code=502, detail=f"Paystack error: {e}")

    return schemas.EscrowInitResponse(
        escrow_id=escrow.id,
        authorization_url=data["authorization_url"],
        access_code=data["access_code"],
        reference=data["reference"],
    )


@router.post("/webhook", include_in_schema=False)
async def paystack_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Step 2 of escrow: Paystack calls this when a charge succeeds (or fails).
    This is the source of truth — never mark an escrow as `held` based on
    the frontend redirect alone, since that can be spoofed or interrupted.
    """
    raw_body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    if not paystack.verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = json.loads(raw_body)
    event_type = event.get("event")
    data = event.get("data", {})
    reference = data.get("reference")

    if not reference:
        return {"status": "ignored"}

    escrow = (
        db.query(models.EscrowTransaction)
        .filter(models.EscrowTransaction.paystack_reference == reference)
        .first()
    )
    if not escrow:
        return {"status": "ignored", "reason": "unknown reference"}

    if event_type == "charge.success":
        # Double-check server-side rather than trusting the webhook payload
        try:
            verified = await paystack.verify_transaction(reference)
        except paystack.PaystackError:
            # Non-2xx so Paystack retries later instead of treating this as processed
            raise HTTPException(status_code=502, detail="Could not verify transaction with Paystack")

        outcome = _apply_verified_charge(escrow, verified)
        db.commit()
        if outcome == "amount_mismatch":
            return {"status": "ignored", "reason": "amount mismatch"}

    elif event_type == "charge.failed":
        if escrow.status == models.EscrowStatus.PENDING:
            escrow.status = models.EscrowStatus.FAILED
            db.commit()

    return {"status": "processed"}


@router.get("/escrow", response_model=list[schemas.EscrowOut])
def list_my_escrows(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """All payments where I'm the payer or the payee, newest first."""
    rows = (
        db.query(models.EscrowTransaction)
        .filter(
            or_(
                models.EscrowTransaction.payer_id == current_user.id,
                models.EscrowTransaction.payee_id == current_user.id,
            )
        )
        .order_by(models.EscrowTransaction.created_at.desc())
        .limit(50)
        .all()
    )
    return [_to_out(e) for e in rows]


@router.post("/verify/{reference}", response_model=schemas.EscrowOut)
async def verify_by_reference(
    reference: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    Called by the frontend after Paystack redirects back. Asks Paystack
    directly whether the charge succeeded, so the escrow reaches `held`
    even if the webhook is delayed or not configured. Idempotent, and it
    only ever acts on Paystack's answer, never on the client's.
    """
    escrow = (
        db.query(models.EscrowTransaction)
        .filter(models.EscrowTransaction.paystack_reference == reference)
        .first()
    )
    if not escrow:
        raise HTTPException(status_code=404, detail="Payment not found")
    if current_user.id not in (escrow.payer_id, escrow.payee_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this transaction")

    if escrow.status == models.EscrowStatus.PENDING:
        try:
            verified = await paystack.verify_transaction(reference)
        except paystack.PaystackError as e:
            raise HTTPException(status_code=502, detail=f"Could not verify with Paystack: {e}")
        outcome = _apply_verified_charge(escrow, verified)
        db.commit()
        db.refresh(escrow)
        if outcome == "amount_mismatch":
            raise HTTPException(status_code=409, detail="Paid amount does not match the escrow amount.")

    return _to_out(escrow)


@router.get("/escrow/{escrow_id}", response_model=schemas.EscrowOut)
def get_escrow(
    escrow_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    escrow = db.query(models.EscrowTransaction).filter(models.EscrowTransaction.id == escrow_id).first()
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow transaction not found")
    if current_user.id not in (escrow.payer_id, escrow.payee_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this transaction")
    return _to_out(escrow)


@router.post("/escrow/{escrow_id}/release", response_model=schemas.EscrowOut)
async def release_escrow(
    escrow_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    Step 3 of escrow: the PAYER confirms move-in happened, which triggers
    the actual payout to the payee's bank account via Paystack Transfer.
    Only the payer can release — this is what makes it trust-building
    rather than the payee just self-releasing their own money.
    """
    # Row lock: two simultaneous release requests (double-tap, retry) can't both pay out.
    escrow = (
        db.query(models.EscrowTransaction)
        .filter(models.EscrowTransaction.id == escrow_id)
        .with_for_update()
        .first()
    )
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow transaction not found")
    if escrow.payer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the payer can release funds")
    if escrow.status != models.EscrowStatus.HELD:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot release funds from status '{escrow.status.value}'",
        )

    payee = db.query(models.User).filter(models.User.id == escrow.payee_id).first()
    payout_amount = float(escrow.amount) - float(escrow.platform_fee)

    try:
        transfer = await paystack.initiate_transfer(
            recipient_code=payee.paystack_recipient_code,
            amount_naira=payout_amount,
            reason=f"HallHustle payout — listing {escrow.listing_id}",
            reference=paystack.generate_reference("HH-PAYOUT"),
        )
    except paystack.PaystackError as e:
        raise HTTPException(status_code=502, detail=f"Paystack transfer failed: {e}")

    transfer_status = transfer.get("status")
    if transfer_status == "otp":
        # Paystack is waiting for OTP confirmation, so no money has moved yet.
        raise HTTPException(
            status_code=409,
            detail="Paystack needs OTP confirmation for transfers. Disable the transfer OTP requirement in your Paystack dashboard settings.",
        )
    if transfer_status in ("failed", "reversed"):
        raise HTTPException(status_code=502, detail="Paystack transfer failed. Funds are still held.")

    escrow.status = models.EscrowStatus.RELEASED
    escrow.released_at = datetime.utcnow()
    escrow.paystack_transfer_code = transfer.get("transfer_code")
    db.commit()
    db.refresh(escrow)

    # Reward both parties' trust score for a completed transaction
    payer = db.query(models.User).filter(models.User.id == escrow.payer_id).first()
    payer.trust_score = (payer.trust_score or 0) + 1
    payee.trust_score = (payee.trust_score or 0) + 1
    db.commit()

    return _to_out(escrow)


@router.post("/escrow/{escrow_id}/dispute", response_model=schemas.EscrowOut)
def dispute_escrow(
    escrow_id: str,
    payload: schemas.DisputeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    Either party can freeze a held escrow pending manual review. At MVP
    stage, resolution is a human (you) looking at the thread and deciding
    to release or refund — there's no automated arbitration yet.
    """
    escrow = db.query(models.EscrowTransaction).filter(models.EscrowTransaction.id == escrow_id).first()
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow transaction not found")
    if current_user.id not in (escrow.payer_id, escrow.payee_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    if escrow.status != models.EscrowStatus.HELD:
        raise HTTPException(status_code=400, detail="Only held funds can be disputed")

    escrow.status = models.EscrowStatus.DISPUTED
    escrow.dispute_reason = payload.reason
    db.commit()
    db.refresh(escrow)
    return _to_out(escrow)


@router.post("/escrow/{escrow_id}/refund", response_model=schemas.EscrowOut)
async def refund_escrow(
    escrow_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    """
    Admin-only resolution action: refunds a disputed or held transaction
    back to the payer via Paystack's refund endpoint. Restricted to
    is_admin=True accounts — regular verified users cannot call this,
    since it moves other people's money.
    """
    escrow = db.query(models.EscrowTransaction).filter(models.EscrowTransaction.id == escrow_id).first()
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow transaction not found")
    if escrow.status not in (models.EscrowStatus.HELD, models.EscrowStatus.DISPUTED):
        raise HTTPException(status_code=400, detail=f"Cannot refund from status '{escrow.status.value}'")

    import httpx

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://api.paystack.co/refund",
            json={"transaction": escrow.paystack_reference},
            headers={"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"},
        )
    body = paystack._safe_json(resp)
    if resp.status_code >= 400 or not body.get("status"):
        raise HTTPException(status_code=502, detail=f"Paystack refund failed: {body.get('message')}")

    escrow.status = models.EscrowStatus.REFUNDED
    escrow.refunded_at = datetime.utcnow()
    db.commit()
    db.refresh(escrow)
    return _to_out(escrow)


@router.get("/banks")
async def get_banks():
    """Powers the bank dropdown when a user adds payout details."""
    try:
        return await paystack.list_banks()
    except paystack.PaystackError as e:
        raise HTTPException(status_code=502, detail=str(e))

"""
Thin wrapper around the Paystack API.

Docs referenced:
- Initialize transaction: https://paystack.com/docs/api/transaction/#initialize
- Verify transaction:     https://paystack.com/docs/api/transaction/#verify
- Transfer recipient:     https://paystack.com/docs/api/transfer-recipient/#create
- Transfer:               https://paystack.com/docs/api/transfer/#initiate
- Webhooks:                https://paystack.com/docs/payments/webhooks/

Paystack has no native "escrow" product. HallHustle collects the full
payment into its own merchant account (a normal charge), holds it in its
own ledger (see models.EscrowTransaction), and only calls the Transfer API
to pay the recipient once a release condition is met. This file only wraps
the raw API calls — the hold/release business logic lives in
routers/payments.py.
"""

import hashlib
import hmac
import uuid

import httpx

from app.config import settings

PAYSTACK_BASE_URL = "https://api.paystack.co"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


def generate_reference(prefix: str = "HH") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:20]}"


class PaystackError(Exception):
    def __init__(self, message: str, response_body: dict | None = None):
        super().__init__(message)
        self.response_body = response_body or {}


def _safe_json(resp: httpx.Response) -> dict:
    """
    Paystack (like any external API) can occasionally return HTML error
    pages, empty bodies, or plain text (e.g. from an intermediary proxy or
    an outage) instead of JSON. Calling .json() directly on those crashes
    with an unhelpful JSONDecodeError — this gives a clear error instead.
    """
    try:
        return resp.json()
    except ValueError:
        raise PaystackError(
            f"Paystack returned a non-JSON response (status {resp.status_code}). "
            "Check your PAYSTACK_SECRET_KEY and network access to api.paystack.co."
        )


async def initialize_transaction(
    email: str,
    amount_naira,
    reference: str,
    metadata: dict | None = None,
    callback_url: str | None = None,
) -> dict:
    """
    Kicks off a payment. Amount is converted to kobo (Paystack's base unit).
    Returns Paystack's `data` object containing `authorization_url`,
    `access_code`, and `reference`.
    """
    amount_kobo = int(round(float(amount_naira) * 100))

    payload = {
        "email": email,
        "amount": amount_kobo,
        "reference": reference,
        "metadata": metadata or {},
    }
    if callback_url:
        payload["callback_url"] = callback_url

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            json=payload,
            headers=_headers(),
        )

    body = _safe_json(resp)
    if resp.status_code >= 400 or not body.get("status"):
        raise PaystackError(body.get("message", "Failed to initialize transaction"), body)

    return body["data"]


async def verify_transaction(reference: str) -> dict:
    """
    Confirms a transaction actually succeeded. ALWAYS call this server-side
    before trusting a payment — never trust the client-side callback alone.
    """
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
            headers=_headers(),
        )

    body = _safe_json(resp)
    if resp.status_code >= 400 or not body.get("status"):
        raise PaystackError(body.get("message", "Failed to verify transaction"), body)

    return body["data"]


async def create_transfer_recipient(
    name: str,
    account_number: str,
    bank_code: str,
) -> dict:
    """
    Registers a payee's bank account with Paystack so you can send them
    money later. Returns the `recipient_code` to store on the User record.
    """
    payload = {
        "type": "nuban",
        "name": name,
        "account_number": account_number,
        "bank_code": bank_code,
        "currency": "NGN",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{PAYSTACK_BASE_URL}/transferrecipient",
            json=payload,
            headers=_headers(),
        )

    body = _safe_json(resp)
    if resp.status_code >= 400 or not body.get("status"):
        raise PaystackError(body.get("message", "Failed to create transfer recipient"), body)

    return body["data"]


async def initiate_transfer(
    recipient_code: str,
    amount_naira,
    reason: str,
    reference: str | None = None,
) -> dict:
    """
    Releases held escrow funds to the payee's registered bank account.
    """
    amount_kobo = int(round(float(amount_naira) * 100))

    payload = {
        "source": "balance",
        "amount": amount_kobo,
        "recipient": recipient_code,
        "reason": reason,
    }
    if reference:
        payload["reference"] = reference

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{PAYSTACK_BASE_URL}/transfer",
            json=payload,
            headers=_headers(),
        )

    body = _safe_json(resp)
    if resp.status_code >= 400 or not body.get("status"):
        raise PaystackError(body.get("message", "Failed to initiate transfer"), body)

    return body["data"]


async def resolve_account_number(account_number: str, bank_code: str) -> dict:
    """Confirms an account number/bank pair resolves to a real account name."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{PAYSTACK_BASE_URL}/bank/resolve",
            params={"account_number": account_number, "bank_code": bank_code},
            headers=_headers(),
        )

    body = _safe_json(resp)
    if resp.status_code >= 400 or not body.get("status"):
        raise PaystackError(body.get("message", "Could not resolve account number"), body)

    return body["data"]


async def list_banks() -> list[dict]:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{PAYSTACK_BASE_URL}/bank",
            params={"country": "nigeria"},
            headers=_headers(),
        )
    body = _safe_json(resp)
    if resp.status_code >= 400 or not body.get("status"):
        raise PaystackError(body.get("message", "Could not fetch bank list"), body)
    return body["data"]


def verify_webhook_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Paystack signs webhook payloads with your secret key. ALWAYS verify this
    before acting on a webhook — never trust an unsigned request.
    https://paystack.com/docs/payments/webhooks/#verifying-events
    """
    computed = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode("utf-8"),
        raw_body,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(computed, signature_header or "")

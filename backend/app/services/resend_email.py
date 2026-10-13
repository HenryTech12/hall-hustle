"""
Thin wrapper around the Resend API (https://resend.com/docs/api-reference/emails/send-email).

Used only to deliver OTP codes to a student's @live.unilag.edu.ng inbox.
Proving they can receive and read mail there is the actual verification
mechanism — UNILAG's Microsoft 365 tenant only issues that address to
enrolled students, so nobody but us needs to expose an API for this.
"""

import httpx

from app.config import settings

RESEND_BASE_URL = "https://api.resend.com"


class ResendError(Exception):
    def __init__(self, message: str, response_body: dict | None = None):
        super().__init__(message)
        self.response_body = response_body or {}


async def send_otp_email(to_email: str, code: str, full_name: str) -> dict:
    subject = "Your HallHustle verification code"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1C1710;">Hi {full_name.split(' ')[0]},</h2>
      <p>Use this code to verify your HallHustle account:</p>
      <p style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color:#1C1710;">
        {code}
      </p>
      <p>This code expires in {settings.OTP_EXPIRE_MINUTES} minutes. If you didn't
      request this, you can ignore this email.</p>
      <p style="color:#8A7E68; font-size: 12px;">HallHustle — built by and for UNILAG students.</p>
    </div>
    """

    payload = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }

    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.post(f"{RESEND_BASE_URL}/emails", json=payload, headers=headers)
        except httpx.HTTPError as e:
            raise ResendError(f"Could not reach Resend: {e}") from e

    try:
        body = resp.json()
    except ValueError:
        raise ResendError(
            f"Resend returned a non-JSON response (status {resp.status_code}). "
            "Check your RESEND_API_KEY and network access to api.resend.com."
        )

    if resp.status_code >= 400:
        raise ResendError(body.get("message", "Failed to send verification email"), body)

    return body

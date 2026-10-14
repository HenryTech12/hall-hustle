"""
Thin wrapper around Brevo's transactional email API
(https://developers.brevo.com/docs/send-a-transactional-email).

Used only to deliver OTP codes to the user's inbox (any email provider).
Proving they can receive and read mail there is the actual verification
mechanism — UNILAG's Microsoft 365 tenant only issues that address to
enrolled students.

Brevo was chosen over Resend for this project specifically because it
only requires verifying a single sender email address (click a
confirmation link) rather than proving DNS ownership of an entire
domain — much less setup friction for a project at this stage. Domain
verification (SPF/DKIM) can be added later on Brevo too, for better
deliverability, but isn't required to start sending.
"""

import httpx

from app.config import settings

BREVO_BASE_URL = "https://api.brevo.com/v3"


class BrevoError(Exception):
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
      <p style="color:#8A7E68; font-size: 12px;">HallHustle — verified student housing.</p>
    </div>
    """

    payload = {
        "sender": {"name": settings.BREVO_SENDER_NAME, "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": full_name}],
        "subject": subject,
        "htmlContent": html,
    }

    headers = {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.post(f"{BREVO_BASE_URL}/smtp/email", json=payload, headers=headers)
        except httpx.HTTPError as e:
            raise BrevoError(f"Could not reach Brevo: {e}") from e

    try:
        body = resp.json()
    except ValueError:
        raise BrevoError(
            f"Brevo returned a non-JSON response (status {resp.status_code}). "
            "Check your BREVO_API_KEY and network access to api.brevo.com."
        )

    if resp.status_code >= 400:
        raise BrevoError(body.get("message", "Failed to send verification email"), body)

    return body

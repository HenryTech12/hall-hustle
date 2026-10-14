"""
Email rules. HallHustle accepts any valid email address: an OTP sent to the
inbox proves the person controls it. A separate, honest "student email" flag
is derived from the domain, so the UI can show a Student badge only when the
address belongs to a school/university, and an "Email verified" badge
otherwise.
"""

# Suffix match on the domain, so subdomains such as live.unilag.edu.ng also count.
# Alumni can keep school addresses, so this means "school email", not "currently enrolled".
STUDENT_EMAIL_SUFFIXES = (
    ".edu", ".edu.ng", ".edu.gh", ".edu.au", ".edu.eg",
    ".ac.uk", ".ac.za", ".ac.ke", ".ac.ug", ".ac.tz", ".ac.in", ".ac.jp", ".ac.nz",
)


def is_academic_email(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].strip().lower()
    return any(domain.endswith(s) for s in STUDENT_EMAIL_SUFFIXES)

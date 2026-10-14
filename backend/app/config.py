from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "HallHustle"
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        origins = {o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()}
        origins.add(self.FRONTEND_URL)
        origins.add("http://localhost:3000")
        return list(origins)

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    PAYSTACK_SECRET_KEY: str
    PAYSTACK_PUBLIC_KEY: str
    PAYSTACK_WEBHOOK_SECRET: str

    # Brevo (email OTP verification) — https://brevo.com, free tier 300/day
    BREVO_API_KEY: str
    BREVO_SENDER_EMAIL: str = "verify@hallhustle.app"
    BREVO_SENDER_NAME: str = "HallHustle"
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5

    # Cloudinary (listing photo uploads)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Leave empty to accept any email address. Set a comma-separated list to restrict signups to those domains.
    ALLOWED_EMAIL_DOMAINS: str = ""

    @property
    def allowed_email_domains_list(self) -> list[str]:
        return [d.strip().lower() for d in self.ALLOWED_EMAIL_DOMAINS.split(",") if d.strip()]


settings = Settings()

import datetime
import re

import phonenumbers
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v


def _validate_phone(v: str) -> str:
    """Validate and normalize phone number to E.164 format."""
    # Dev-only: allow the fictitious-use mock number through without
    # phonenumbers' validity check (555-01xx is reserved, not "valid").
    from pebble.services.sms import MOCK_PHONE_NUMBER
    if v == MOCK_PHONE_NUMBER:
        return MOCK_PHONE_NUMBER

    try:
        parsed = phonenumbers.parse(v, "US")
    except phonenumbers.NumberParseException:
        raise ValueError("Invalid phone number format")
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Invalid phone number")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


class InitiateRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone_number: str = Field(min_length=10, max_length=20)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _validate_phone(v)


class InitiateRegisterResponse(BaseModel):
    verification_id: str
    message: str = "Verification code sent"


class VerifyRegisterRequest(BaseModel):
    verification_id: str
    code: str = Field(pattern=r"^\d{6}$")


class ResendCodeRequest(BaseModel):
    verification_id: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    subscription_tier: str
    phone_number: str | None = None
    phone_verified: bool = False
    date_of_birth: datetime.date | None = None
    occupation: str | None = None
    annual_income: int | None = None
    state: str | None = None
    marital_status: str | None = None
    dependents: int | None = None
    financial_goals: list[str] | None = None

    model_config = {"from_attributes": True}


US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC",
}

MARITAL_STATUSES = {"single", "married", "divorced", "widowed", "separated"}


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    date_of_birth: datetime.date | None = None
    occupation: str | None = Field(None, max_length=100)
    annual_income: int | None = Field(None, ge=0)
    state: str | None = Field(None, min_length=2, max_length=2)
    marital_status: str | None = None
    dependents: int | None = Field(None, ge=0)
    financial_goals: list[str] | None = None

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: datetime.date | None) -> datetime.date | None:
        if v is None:
            return v
        if v > datetime.date.today():
            raise ValueError("Date of birth cannot be in the future")
        if v.year < 1900:
            raise ValueError("Date of birth must be after 1900")
        return v

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str | None) -> str | None:
        if v is None:
            return v
        upper = v.upper()
        if upper not in US_STATES:
            raise ValueError(f"Invalid US state abbreviation: {v}")
        return upper

    @field_validator("marital_status")
    @classmethod
    def validate_marital_status(cls, v: str | None) -> str | None:
        if v is None:
            return v
        lower = v.lower()
        if lower not in MARITAL_STATUSES:
            raise ValueError(f"Must be one of: {', '.join(sorted(MARITAL_STATUSES))}")
        return lower

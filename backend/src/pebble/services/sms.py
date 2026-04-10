import asyncio
import logging

from pebble.config import settings

logger = logging.getLogger(__name__)

_twilio_client = None


def _get_client():
    global _twilio_client
    if _twilio_client is None:
        from twilio.rest import Client

        _twilio_client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    return _twilio_client


async def send_verification_code(to_number: str) -> None:
    """Send a verification code via Twilio Verify API."""
    if not settings.twilio_account_sid:
        logger.warning("Twilio not configured — skipping SMS to %s", to_number)
        return

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        lambda: _get_client().verify.v2.services(
            settings.twilio_verify_service_sid
        ).verifications.create(to=to_number, channel="sms"),
    )


async def check_verification_code(to_number: str, code: str) -> bool:
    """Check a verification code via Twilio Verify API. Returns True if valid."""
    if not settings.twilio_account_sid:
        logger.warning("Twilio not configured — auto-approving code for %s", to_number)
        return True

    loop = asyncio.get_running_loop()
    check = await loop.run_in_executor(
        None,
        lambda: _get_client().verify.v2.services(
            settings.twilio_verify_service_sid
        ).verification_checks.create(to=to_number, code=code),
    )
    return check.status == "approved"

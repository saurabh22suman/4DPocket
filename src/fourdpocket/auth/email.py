"""Pluggable email sender.

Email delivery requires an SMTP host and sender address.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape

logger = logging.getLogger(__name__)


def _wrap_html(subject: str, body_text: str) -> str:
    """Auto-wrap plain text into a minimal HTML email."""
    lines = escape(body_text).replace("\n", "<br>")
    return (
        f"<!DOCTYPE html><html><body>"
        f"<h2>{escape(subject)}</h2><p>{lines}</p>"
        f"</body></html>"
    )


def send_email(
    to: str,
    subject: str,
    body_text: str,
    body_html: str | None = None,
) -> bool:
    """Return whether SMTP accepted the message. Never log its contents."""
    from fourdpocket.config import get_settings

    cfg = get_settings().email

    if not cfg.configured:
        logger.info("Email delivery skipped because SMTP is unconfigured")
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = formataddr((cfg.from_name, cfg.from_address))
        msg["To"] = to
        msg.set_content(body_text)
        msg.add_alternative(body_html or _wrap_html(subject, body_text), subtype="html")

        context = ssl.create_default_context()
        if cfg.smtp_use_ssl:
            connection = smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, timeout=10, context=context)
        else:
            connection = smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=10)
        with connection as smtp:
            if cfg.smtp_use_tls and not cfg.smtp_use_ssl:
                smtp.starttls(context=context)
            if cfg.smtp_user:
                smtp.login(cfg.smtp_user, cfg.smtp_password)
            smtp.send_message(msg, from_addr=cfg.from_address, to_addrs=[to])
        return True
    except Exception as exc:
        logger.error("Email delivery failed (%s)", type(exc).__name__)
        return False

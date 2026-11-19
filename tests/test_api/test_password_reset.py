"""Tests for the password-reset flow.

Regression tests for:
- POST /api/v1/auth/password-reset/request  (no-leak, token creation)
- POST /api/v1/auth/password-reset/confirm  (happy path, expired, already used, weak password)
"""

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import pytest

from fourdpocket.auth.tokens import generate_token, hash_token
from fourdpocket.config import get_settings
from fourdpocket.models.password_reset import PasswordResetToken


def _register(client, email="reset@example.com", username="resetuser", password="Reset123!"):
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "password": password},
    )


def _request_reset(client, identifier):
    return client.post(
        "/api/v1/auth/password-reset/request",
        json={"email_or_username": identifier},
    )


def _confirm_reset(client, token, new_password):
    return client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "new_password": new_password},
    )


# ── no-leak behaviour ─────────────────────────────────────────────────────────

@pytest.fixture
def reset_emails(monkeypatch):
    settings = get_settings().email
    monkeypatch.setattr(settings, "smtp_host", "smtp.test.example.com")
    monkeypatch.setattr(settings, "from_address", "pocket@example.com")
    captured = []

    def capture(**message):
        captured.append(message)
        return True

    monkeypatch.setattr("fourdpocket.api.auth.send_email", capture)
    return captured


def test_request_reset_unavailable_without_smtp(client):
    assert client.get("/api/v1/auth/config").json()["password_reset_enabled"] is False
    assert _request_reset(client, "ghost@example.com").status_code == 503


def test_request_reset_nonexistent_user_returns_200(client, reset_emails):
    """Request for unknown email must return 200 + {sent: true} (no enumeration)."""
    response = _request_reset(client, "ghost@example.com")
    assert response.status_code == 200
    assert response.json() == {"sent": True}
    assert reset_emails == []


def test_request_reset_known_user_returns_200(client, reset_emails):
    _register(client)
    assert client.get("/api/v1/auth/config").json()["password_reset_enabled"] is True
    response = _request_reset(client, "reset@example.com")
    assert response.status_code == 200
    assert response.json() == {"sent": True}
    message = reset_emails[-1]
    assert message["to"] == "reset@example.com"
    link = urlsplit(message["body_text"].splitlines()[2])
    assert link.path == "/reset-password"
    assert not link.query
    assert parse_qs(link.fragment).get("token")


def test_request_reset_by_username(client, reset_emails):
    _register(client)
    response = _request_reset(client, "resetuser")
    assert response.status_code == 200
    assert response.json() == {"sent": True}
    assert reset_emails[-1]["to"] == "reset@example.com"


def test_password_recovery_invalidates_other_outstanding_links(client, reset_emails):
    _register(client)
    assert _request_reset(client, "resetuser").status_code == 200
    first_link = urlsplit(reset_emails[-1]["body_text"].splitlines()[2])
    assert _request_reset(client, "resetuser").status_code == 200
    second_link = urlsplit(reset_emails[-1]["body_text"].splitlines()[2])
    first = parse_qs(first_link.fragment)["token"][0]
    second = parse_qs(second_link.fragment)["token"][0]

    assert _confirm_reset(client, second, "NewPass456!").status_code == 204
    assert _confirm_reset(client, first, "AnotherPass789!").status_code == 400


# ── happy path ────────────────────────────────────────────────────────────────

def test_confirm_reset_updates_password(client, db):
    """Valid token + strong new password → 204, then login with new password works."""
    _register(client)

    # Inject a fresh token directly into the DB (bypasses email)
    from sqlmodel import select
    from fourdpocket.models.user import User

    user = db.exec(select(User).where(User.email == "reset@example.com")).first()
    raw, token_hash = generate_token()
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
    )
    db.add(token)
    db.commit()

    response = _confirm_reset(client, raw, "NewPass456!")
    assert response.status_code == 204

    # Old password must fail
    login_old = client.post(
        "/api/v1/auth/login",
        data={"username": "reset@example.com", "password": "Reset123!"},
    )
    assert login_old.status_code == 401

    # New password must succeed
    login_new = client.post(
        "/api/v1/auth/login",
        data={"username": "reset@example.com", "password": "NewPass456!"},
    )
    assert login_new.status_code == 200
    assert "access_token" in login_new.json()
    assert client.get("/api/v1/auth/me").status_code == 200


def test_confirm_reset_token_is_single_use(client, db):
    """Second use of the same token must return 400."""
    _register(client)

    from sqlmodel import select
    from fourdpocket.models.user import User

    user = db.exec(select(User).where(User.email == "reset@example.com")).first()
    raw, token_hash = generate_token()
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
    )
    db.add(token)
    db.commit()

    _confirm_reset(client, raw, "NewPass456!")

    second = _confirm_reset(client, raw, "AnotherPass789!")
    assert second.status_code == 400
    assert "already been used" in second.json()["detail"]


def test_confirm_reset_expired_token(client, db):
    """Expired token must return 400."""
    _register(client)

    from sqlmodel import select
    from fourdpocket.models.user import User

    user = db.exec(select(User).where(User.email == "reset@example.com")).first()
    raw, token_hash = generate_token()
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # already expired
    )
    db.add(token)
    db.commit()

    response = _confirm_reset(client, raw, "NewPass456!")
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]


def test_confirm_reset_invalid_token(client):
    """Unknown token must return 400."""
    response = _confirm_reset(client, "notavalidtoken", "NewPass456!")
    assert response.status_code == 400


@pytest.mark.parametrize("password", [
    "short1!",         # too short
    "nouppercase1!",   # no uppercase
    "NoDigitSpecial!", # no digit
    "NoSpecial1",      # no special char
])
def test_confirm_reset_weak_password(client, db, password):
    """Weak new_password must be rejected with 422."""
    _register(client)

    from sqlmodel import select
    from fourdpocket.models.user import User

    user = db.exec(select(User).where(User.email == "reset@example.com")).first()
    raw, token_hash = generate_token()
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
    )
    db.add(token)
    db.commit()

    response = _confirm_reset(client, raw, password)
    assert response.status_code == 422


def test_confirm_reset_invalidates_old_jwt(client, db):
    """After password reset, JWTs issued before the reset are rejected."""
    _register(client)
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "reset@example.com", "password": "Reset123!"},
    )
    old_token = login_resp.json()["access_token"]
    old_headers = {"Authorization": f"Bearer {old_token}"}

    # Verify the old token works before reset
    assert client.get("/api/v1/auth/me", headers=old_headers).status_code == 200

    from sqlmodel import select
    from fourdpocket.models.user import User

    user = db.exec(select(User).where(User.email == "reset@example.com")).first()
    raw, token_hash = generate_token()
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
    )
    db.add(token)
    db.commit()

    _confirm_reset(client, raw, "NewPass456!")

    # Old JWT must be rejected because iat < password_changed_at
    me_resp = client.get("/api/v1/auth/me", headers=old_headers)
    assert me_resp.status_code == 401

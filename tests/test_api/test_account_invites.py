from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

from fourdpocket.auth.tokens import hash_token
from fourdpocket.config import get_settings
from fourdpocket.models.account_invite import AccountInvite


def _registration(name, token=None):
    data = {
        "email": f"{name}@example.com",
        "username": name,
        "password": "InviteTest123!",
    }
    if token is not None:
        data["invite_token"] = token
    return data


def test_admin_invite_allows_one_regular_account(client, auth_headers, second_user_headers, db):
    settings = get_settings()
    settings.auth.allow_invites = True
    settings.auth.allow_registration = False

    assert client.get("/api/v1/auth/config").json() == {
        "registration_enabled": False,
        "invites_enabled": True,
        "password_reset_enabled": False,
    }
    assert client.post("/api/v1/admin/invites", headers=second_user_headers).status_code == 403
    assert client.post("/api/v1/auth/register", json=_registration("uninvited")).status_code == 403

    invite = client.post("/api/v1/admin/invites", headers=auth_headers)
    assert invite.status_code == 201
    assert invite.headers["Cache-Control"] == "no-store"
    link = urlsplit(invite.json()["url"])
    assert link.path == "/register"
    assert not link.query
    token = parse_qs(link.fragment)["invite"][0]
    assert db.get(AccountInvite, hash_token(token)) is not None
    expiry = datetime.fromisoformat(invite.json()["expires_at"])
    assert timedelta(hours=23, minutes=59) < expiry - datetime.now(timezone.utc) <= timedelta(hours=24)

    duplicate = client.post("/api/v1/auth/register", json=_registration("testuser", token))
    assert duplicate.status_code == 409
    accepted = client.post("/api/v1/auth/register", json=_registration("invited", token))
    assert accepted.status_code == 201
    assert accepted.json()["role"] == "user"
    reused = client.post("/api/v1/auth/register", json=_registration("someoneelse", token))
    assert reused.status_code == 403


def test_expired_invite_is_rejected(client, auth_headers, db):
    settings = get_settings()
    settings.auth.allow_invites = True
    settings.auth.allow_registration = False
    token = parse_qs(urlsplit(client.post("/api/v1/admin/invites", headers=auth_headers).json()["url"]).fragment)["invite"][0]
    invite = db.get(AccountInvite, hash_token(token))
    invite.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()

    result = client.post("/api/v1/auth/register", json=_registration("expired", token))
    assert result.status_code == 403

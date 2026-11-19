"""Tests for the media downloader background task."""

from unittest.mock import MagicMock

import httpx
import pytest
from sqlmodel import Session

from fourdpocket.models.item import KnowledgeItem
from fourdpocket.utils.ssrf import BlockedURLError, ResponseTooLargeError
from fourdpocket.workers.media_downloader import (
    _is_safe_media_url,
    _resolve_and_pin,
    download_media,
    download_video,
)


def _make_media_user(db: Session):
    from fourdpocket.models.user import User

    user = User(
        email="mediauser@test.com",
        username="mediauser",
        password_hash="$2b$12$fake",
        display_name="Media User",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_media_item(db: Session, user):
    item = KnowledgeItem(
        user_id=user.id,
        title="Media Item",
        media=[],
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


class TestIsSafeMediaUrl:
    """Test SSRF URL validation for media downloads."""

    @pytest.mark.parametrize("url,expected", [
        ("https://example.com/image.jpg", True),
        ("http://example.com/video.mp4", True),
        ("https://127.0.0.1/image.jpg", False),
        ("https://10.0.0.1/image.jpg", False),
        ("https://172.16.0.1/image.jpg", False),
        ("https://192.168.1.1/image.jpg", False),
        ("https://169.254.0.1/image.jpg", False),
        ("file:///etc/passwd", False),
        ("ftp://example.com/file.bin", False),
    ])
    def test_ssrf_blocked(self, url, expected):
        assert _is_safe_media_url(url) == expected


class TestResolveAndPin:
    """Test DNS resolution and pinning for SSRF protection."""

    @pytest.mark.parametrize("url,expected", [
        ("https://example.com/image.jpg", True),
        ("https://127.0.0.1/image.jpg", False),
        ("https://10.0.0.1/image.jpg", False),
    ])
    def test_resolve_and_pin(self, url, expected):
        result = _resolve_and_pin(url)
        if expected:
            assert result is not None
        else:
            assert result is None


class TestDownloadMedia:
    """Test the download_media Huey task."""

    def test_download_media_empty_list(self, db: Session, engine, monkeypatch):
        """Empty media_urls returns success with 0 downloaded."""
        import fourdpocket.db.session as db_module
        monkeypatch.setattr(db_module, "_engine", engine)

        user = _make_media_user(db)
        item = _make_media_item(db, user)

        result = download_media.call_local(str(item.id), str(user.id), [])
        assert result["downloaded"] == 0
        assert result["total"] == 0

    def test_download_media_ssrf_blocked(self, db: Session, engine, monkeypatch):
        """Internal URL is blocked, not downloaded."""
        import fourdpocket.db.session as db_module
        monkeypatch.setattr(db_module, "_engine", engine)

        user = _make_media_user(db)
        item = _make_media_item(db, user)

        media_urls = [{"url": "https://127.0.0.1/image.jpg", "type": "image", "role": "thumbnail"}]
        result = download_media.call_local(str(item.id), str(user.id), media_urls)

        assert result["downloaded"] == 0

    def test_download_media_success(self, db: Session, engine, monkeypatch):
        """Valid media URL is downloaded and item is updated."""
        import fourdpocket.db.session as db_module
        monkeypatch.setattr(db_module, "_engine", engine)

        user = _make_media_user(db)
        item = _make_media_item(db, user)

        monkeypatch.setattr(
            "fourdpocket.workers.media_downloader.fetch_public_url",
            lambda *_args, **_kwargs: httpx.Response(200, content=b"\x89PNG\r\n\x1a\n\x00fake"),
        )

        class MockStorage:
            def save_file(self, uid, kind, filename, data):
                return f"{kind}/{filename}"

        monkeypatch.setattr(
            "fourdpocket.storage.local.LocalStorage",
            lambda: MockStorage(),
        )

        media_urls = [
            {"url": "https://example.com/image.png", "type": "image", "role": "thumbnail"}
        ]

        result = download_media.call_local(str(item.id), str(user.id), media_urls)

        assert result["downloaded"] == 1
        assert result["total"] == 1

    def test_download_media_connection_error(self, db: Session, engine, monkeypatch):
        """A fetch error leaves the media unsaved."""
        import fourdpocket.db.session as db_module
        monkeypatch.setattr(db_module, "_engine", engine)

        user = _make_media_user(db)
        item = _make_media_item(db, user)

        def fetch(*_args, **_kwargs):
            raise httpx.ConnectError("DNS failure")

        monkeypatch.setattr("fourdpocket.workers.media_downloader.fetch_public_url", fetch)

        media_urls = [{"url": "https://example.com/image.png", "type": "image", "role": "thumbnail"}]

        result = download_media.call_local(str(item.id), str(user.id), media_urls)
        assert result["downloaded"] == 0

    def test_download_media_max_size_exceeded(self, db: Session, engine, monkeypatch):
        """Media exceeding MAX_MEDIA_SIZE_BYTES is not saved."""
        import fourdpocket.db.session as db_module
        monkeypatch.setattr(db_module, "_engine", engine)

        user = _make_media_user(db)
        item = _make_media_item(db, user)

        def fetch(*_args, max_bytes, **_kwargs):
            assert max_bytes == 100 * 1024 * 1024
            raise ResponseTooLargeError("Media too large")

        monkeypatch.setattr("fourdpocket.workers.media_downloader.fetch_public_url", fetch)

        media_urls = [{"url": "https://example.com/huge.bin", "type": "binary", "role": "content"}]

        result = download_media.call_local(str(item.id), str(user.id), media_urls)
        assert result["downloaded"] == 0


# === PHASE 2C MOPUP ADDITIONS ===

class TestIsSafeMediaUrlDnsFailure:
    """DNS failure edge cases for _is_safe_media_url."""

    def test_is_safe_media_url_dns_failure(self, monkeypatch):
        """socket.gaierror → False."""
        import socket

        def fake_getaddrinfo(*a):
            raise socket.gaierror("DNS lookup failed")

        monkeypatch.setattr("socket.getaddrinfo", fake_getaddrinfo)
        from fourdpocket.workers.media_downloader import _is_safe_media_url

        assert _is_safe_media_url("https://example.com/video.mp4") is False


class TestResolveAndPinEmpty:
    """Empty / invalid input edge cases for _resolve_and_pin."""

    def test_resolve_and_pin_empty_hostname(self):
        """URL with no host → None."""
        from fourdpocket.workers.media_downloader import _resolve_and_pin

        result = _resolve_and_pin("not-a-url")
        assert result is None

    def test_resolve_and_pin_empty_addr_info(self, monkeypatch):
        """DNS returns [] → None."""

        def fake_resolve(*a):
            return []

        monkeypatch.setattr("socket.getaddrinfo", fake_resolve)
        from fourdpocket.workers.media_downloader import _resolve_and_pin

        result = _resolve_and_pin("https://example.com/video.mp4")
        assert result is None


class TestDownloadMediaRedirect:
    """Redirect handling in download_media."""

    def test_download_media_redirect_ssrf(self, db: Session, engine, monkeypatch):
        """Redirect to internal IP → skipped, not appended."""
        import fourdpocket.db.session as db_module
        from fourdpocket.workers.media_downloader import download_media

        monkeypatch.setattr(db_module, "_engine", engine)

        user = _make_media_user(db)
        item = _make_media_item(db, user)

        def fetch(*_args, **_kwargs):
            raise BlockedURLError("Redirect denied by the public URL policy")

        monkeypatch.setattr("fourdpocket.workers.media_downloader.fetch_public_url", fetch)

        media_urls = [{"url": "https://example.com/image.png", "type": "image", "role": "thumbnail"}]
        result = download_media.call_local(str(item.id), str(user.id), media_urls)

        assert result["downloaded"] == 0

    def test_download_media_too_many_redirects(self, db: Session, engine, monkeypatch):
        """5 redirect loop → final_url None, skipped."""
        import fourdpocket.db.session as db_module
        from fourdpocket.workers.media_downloader import download_media

        monkeypatch.setattr(db_module, "_engine", engine)

        user = _make_media_user(db)
        item = _make_media_item(db, user)

        def fetch(*_args, **_kwargs):
            raise httpx.TooManyRedirects("Redirect limit reached")

        monkeypatch.setattr("fourdpocket.workers.media_downloader.fetch_public_url", fetch)

        media_urls = [{"url": "https://example.com/image.png", "type": "image", "role": "thumbnail"}]
        result = download_media.call_local(str(item.id), str(user.id), media_urls)

        # Loop exhausts 5 hops → no final URL → skipped
        assert result["downloaded"] == 0

    def test_download_media_dedup_existing(self, db: Session, engine, monkeypatch):
        """Item already has media entry for same URL → updated not appended."""
        import fourdpocket.db.session as db_module
        from fourdpocket.workers.media_downloader import download_media

        monkeypatch.setattr(db_module, "_engine", engine)

        user = _make_media_user(db)
        item = _make_media_item(db, user)

        # Pre-existing media entry with same URL
        existing_media = [{"url": "https://example.com/image.png", "type": "image", "role": "thumbnail", "local_path": "media/old.png"}]
        item.media = existing_media
        db.add(item)
        db.commit()

        monkeypatch.setattr(
            "fourdpocket.workers.media_downloader.fetch_public_url",
            lambda *_args, **_kwargs: httpx.Response(200, content=b"\x89PNG\r\n\x1a\n\x00fake"),
        )

        monkeypatch.setattr("fourdpocket.storage.local.LocalStorage", lambda: MagicMock(save_file=lambda *a: "media/new.png"))

        media_urls = [{"url": "https://example.com/image.png", "type": "image", "role": "thumbnail"}]
        result = download_media.call_local(str(item.id), str(user.id), media_urls)

        assert result["downloaded"] == 1

        db.refresh(item)
        # Should be updated, not appended — still 1 entry
        assert len(item.media) == 1
        # local_path should be updated
        assert item.media[0].get("local_path") == "media/new.png"


class TestDownloadVideo:
    """Test the download_video function (yt-dlp wrapper)."""

    def test_download_video_ssrf_blocked(self, monkeypatch):
        """Internal URL is rejected before yt-dlp is called."""
        call_count = [0]

        def mock_run(*args, **kwargs):
            call_count[0] += 1
            return type("Result", (), {"returncode": 1})()

        monkeypatch.setattr("subprocess.run", mock_run)

        result = download_video("https://127.0.0.1/video.mp4", "/tmp")
        assert result is None
        assert call_count[0] == 0

    def test_download_video_yt_dlp_success(self, monkeypatch, tmp_path):
        """yt-dlp returns file path on success."""
        def mock_run(cmd, *args, **kwargs):
            return type("Result", (), {"returncode": 0})()

        monkeypatch.setattr("subprocess.run", mock_run)

        monkeypatch.setattr("fourdpocket.workers.media_downloader._is_safe_media_url", lambda _url: True)
        output = tmp_path / "video.mp4"
        output.touch()
        result = download_video("https://www.youtube.com/watch?v=fixture", str(tmp_path))
        assert result == str(output)

    def test_download_video_yt_dlp_failure(self, monkeypatch, tmp_path):
        """yt-dlp non-zero return code yields None."""
        def mock_run(cmd, *args, **kwargs):
            return type("Result", (), {"returncode": 1, "stderr": "error"})()

        monkeypatch.setattr("subprocess.run", mock_run)

        monkeypatch.setattr("fourdpocket.workers.media_downloader._is_safe_media_url", lambda _url: True)
        result = download_video("https://www.youtube.com/watch?v=fixture", str(tmp_path))
        assert result is None

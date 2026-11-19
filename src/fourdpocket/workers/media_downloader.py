"""Background task for downloading media files."""

import hashlib
import logging
import uuid
from urllib.parse import urlparse

from fourdpocket.utils.ssrf import fetch_public_url, is_safe_url, resolve_and_check
from fourdpocket.workers import huey

logger = logging.getLogger(__name__)

MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024  # 100MB


def _is_safe_media_url(url: str) -> bool:
    """Check if URL is safe to download (SSRF protection)."""
    return is_safe_url(url)


def _resolve_and_pin(url: str) -> str | None:
    """Return the address the public fetch policy permits."""
    return resolve_and_check(url)


def supported_video_url(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return any(
        host == domain or host.endswith("." + domain)
        for domain in ("youtube.com", "youtu.be", "instagram.com", "tiktok.com")
    )


@huey.task(retries=3, retry_delay=60)
def download_media(item_id: str, user_id: str, media_urls: list[dict]) -> dict:
    """Download media files (images, thumbnails) and store locally.

    Args:
        item_id: Knowledge item ID
        user_id: Owner user ID
        media_urls: List of {"url": str, "type": str, "role": str}
    """
    from sqlmodel import Session

    from fourdpocket.db.session import get_engine
    from fourdpocket.models.item import KnowledgeItem
    from fourdpocket.storage.local import LocalStorage

    logger.info("Downloading %d media files for item %s", len(media_urls), item_id)
    storage = LocalStorage()
    uid = uuid.UUID(user_id)
    downloaded = []

    for media_info in media_urls:
        media_url = media_info.get("url", "")
        if not media_url:
            continue

        try:
            response = fetch_public_url(
                media_url,
                timeout=30,
                max_bytes=MAX_MEDIA_SIZE_BYTES,
                headers={"User-Agent": "4DPocket/0.2"},
            )
            media_bytes = response.content
            url_hash = hashlib.sha256(media_url.encode()).hexdigest()[:12]
            parsed_url = urlparse(media_url)
            ext = parsed_url.path.rsplit(".", 1)[-1] if "." in parsed_url.path else "bin"
            filename = f"{item_id}_{url_hash}.{ext[:10]}"
            relative_path = storage.save_file(uid, "media", filename, media_bytes)
            downloaded.append({
                "original_url": media_url,
                "local_path": relative_path,
                "type": media_info.get("type", "unknown"),
                "role": media_info.get("role", ""),
                "size_bytes": len(media_bytes),
            })
        except Exception as e:
            logger.warning("Media download failed (%s)", type(e).__name__)

    # Update item with local media paths (update existing entries, don't duplicate)
    if downloaded:
        engine = get_engine()
        with Session(engine) as db:
            item = db.get(KnowledgeItem, uuid.UUID(item_id))
            if item:
                existing_media = list(item.media) if item.media else []
                for dl in downloaded:
                    # Find existing entry by matching original URL or role
                    matched = False
                    for i, em in enumerate(existing_media):
                        if em.get("url") == dl.get("original_url") or (
                            em.get("role") == dl["role"] and em.get("role") in ("thumbnail",)
                        ):
                            existing_media[i] = {**em, **dl, "url": em.get("url", dl.get("original_url", ""))}
                            matched = True
                            break
                    if not matched:
                        existing_media.append(dl)
                item.media = existing_media
                db.add(item)
                db.commit()

    logger.info("Downloaded %d/%d media for item %s", len(downloaded), len(media_urls), item_id)
    return {"status": "success", "downloaded": len(downloaded), "total": len(media_urls)}


def download_video(url: str, output_dir: str, max_quality: str = "720") -> str | None:
    """Download video using yt-dlp. Returns output file path or None."""
    import subprocess
    from pathlib import Path

    if not _is_safe_media_url(url):
        logger.warning("SSRF blocked video download: %s", url)
        return None

    # Third-party extractors are restricted to supported platform origins.
    if not supported_video_url(url):
        return None

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    output_template = str(Path(output_dir) / "%(title)s.%(ext)s")

    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "--no-playlist",
                "-f", f"bestvideo[height<={max_quality}]+bestaudio/best[height<={max_quality}]",
                "--merge-output-format", "mp4",
                "-o", output_template,
                "--max-filesize", "500M",
                "--", url,
            ],
            capture_output=True, text=True, timeout=600,
        )
        if result.returncode == 0:
            for f in Path(output_dir).glob("*.mp4"):
                return str(f)
        return None
    except Exception:
        return None

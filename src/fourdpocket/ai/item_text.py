"""Select source text for bookmark enrichment."""

import re

from fourdpocket.models.item import KnowledgeItem

_URL = re.compile(r"https?://\S+", re.IGNORECASE)
_SECTION_ORDER = {
    "transcript_segment": 0, "ocr_text": 1, "post": 2, "paragraph": 2,
    "visual_caption": 3,
}
_PLACEHOLDERS = {"(no caption)", "no caption", "instagram post", "youtube"}


def _source_text(value: str | None) -> str:
    if not isinstance(value, str):
        return ""
    text = _URL.sub("", value).strip()
    return text if re.search(r"[^\W\d_]", text) and text.casefold() not in _PLACEHOLDERS else ""


def item_prompt_fields(item: KnowledgeItem) -> tuple[str, str, str] | None:
    """Give transcripts and post text priority, omitting platform notices and URLs."""
    if not item.url:
        return item.title or "", item.content or "", item.description or ""

    title = _source_text(item.title)
    description = _source_text(item.description)
    media_post = item.source_platform in {"youtube", "instagram", "tiktok"}
    sections = (item.item_metadata or {}).get("_sections") or []
    if media_post and isinstance(sections, list) and sections:
        source_sections = (
            section for section in sections
            if isinstance(section, dict) and section.get("kind") in _SECTION_ORDER
        )
        ordered = sorted(source_sections, key=lambda section: _SECTION_ORDER[section["kind"]])
        content = "\n\n".join(dict.fromkeys(
            text for section in ordered if (text := _source_text(section.get("text")))
        ))
    else:
        content = _source_text(item.content)

    if content == title:
        title = ""
    if description == title or (description and description in content):
        description = ""
    if media_post and item.source_platform == "instagram" and len(title) > 130:
        # Open Graph titles may contain the entire original caption.
        if not content and not description:
            content = title
        title = ""
    if not content and not description:
        return None
    if len(content) > 8000:
        # A long transcript's conclusions often come near the end.
        middle = len(content) // 2
        content = "\n\n".join((content[:2600], content[middle - 1300:middle + 1300], content[-2600:]))
    return title, content, description

"""Static QA helpers for generated HTML artifacts."""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

IMG_RE = re.compile(r"<img\b[^>]*?\bsrc\s*=\s*(['\"])(.*?)\1", re.I | re.S)
CSS_IMAGE_URL_RE = re.compile(r"(?:background(?:-image)?|mask(?:-image)?|content)\s*:[^;{}]*?url\(\s*(['\"]?)(.*?)\1\s*\)", re.I | re.S)
PLACEHOLDER_HOSTS = {"example.com", "example.org", "example.net", "via.placeholder.com", "placehold.co"}
YEAR_RE = re.compile(r"\b(?:19|20|21)\d{2}\b")
CURRENT_CUE_RE = re.compile(r"\b(current|currently|today|latest|this year|now|sekarang|terkini|hari ini)\b", re.I)
TAG_RE = re.compile(r"<[^>]+>")


def _is_remote(value: str) -> bool:
    return urlparse(value).scheme.lower() in {"http", "https"}


def _is_non_file(value: str) -> bool:
    return value.startswith(("data:", "blob:", "#", "mailto:", "tel:"))


def audit_html_file(path: str | Path, prompt: str = "") -> list[str]:
    file = Path(path)
    try:
        html = file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        return [f"cannot read {file}: {exc}"]
    issues: list[str] = []
    visible = TAG_RE.sub(" ", html)
    text_context = f"{prompt} {visible}"
    current_year = datetime.now().year
    if CURRENT_CUE_RE.search(text_context):
        for match in YEAR_RE.finditer(text_context):
            year = int(match.group())
            nearby = text_context[max(0, match.start() - 70):match.end() + 70]
            if year != current_year and CURRENT_CUE_RE.search(nearby):
                issues.append(f"current-date claim uses year {year}; verify against {current_year}")
                break
    for raw in [*IMG_RE.findall(html), *list(CSS_IMAGE_URL_RE.findall(html))]:
        value = raw[1].strip()
        if not value or _is_non_file(value):
            if not value:
                issues.append("empty image asset URL")
            continue
        if _is_remote(value):
            host = (urlparse(value).hostname or "").lower()
            if host in PLACEHOLDER_HOSTS:
                issues.append(f"placeholder image URL is not allowed: {value}")
            continue
        local = Path(value)
        if value.startswith("/"):
            candidate = Path(value)
        else:
            candidate = (file.parent / local).resolve()
        if not candidate.is_file():
            issues.append(f"missing local image asset: {value}")
    return issues

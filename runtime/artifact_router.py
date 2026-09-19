"""Post-write routing for standalone LazyDev deliverables."""
from __future__ import annotations

import os
import re
import shutil
from pathlib import Path
from typing import Any

from .platform_paths import platform_paths, ensure_artifact_directory

STANDALONE_EXTENSIONS = {
    ".html", ".htm", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".csv", ".md", ".txt",
}
ARTIFACT_INTENT_RE = re.compile(
    r"\b(save|export|download|generate|create|produce|write|artifact|deliverable|make|build|simpan|menyimpan|unduh|hasilkan|buat|bikin|buatin|buatkan|bikinin)\b",
    re.I,
)
PROJECT_MARKERS = {
    ".git", "package.json", "pyproject.toml", "go.mod", "go.work", "Cargo.toml",
    "pom.xml", "build.gradle", "settings.gradle", "tsconfig.json", "vite.config.js",
    "vite.config.ts", "next.config.js", "next.config.mjs", "requirements.txt",
}


def canonical_artifact_dir() -> Path:
    configured = str(os.environ.get("LAZYDEV_ARTIFACT_DIR", "")).strip()
    canonical = Path(platform_paths()["artifactDirectory"])
    if configured:
        candidate = Path(configured).expanduser()
        # Ignore stale defaults from older LazyDev builds when they disagree with
        # the current platform. Explicit custom directories remain supported.
        stale_desktop = candidate.name == "artifacts" and candidate.parent.name == "LazyDev"
        stale_linux = candidate.name == "artifacts" and candidate.parent.name == "lazydev" and candidate.parent.parent.name == ".local"
        stale_termux = platform_paths().get("termux") and not str(candidate).replace("\\", "/").startswith("/storage/emulated/0/")
        if not (stale_desktop or stale_linux or stale_termux):
            return candidate
    return canonical


def _is_inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (OSError, ValueError):
        return False


def _has_project_markers(cwd: Path) -> bool:
    try:
        return any((cwd / marker).exists() for marker in PROJECT_MARKERS)
    except OSError:
        return False


def should_route(prompt: str, target: Path, cwd: Path) -> bool:
    if target.suffix.lower() not in STANDALONE_EXTENSIONS:
        return False
    out = canonical_artifact_dir().resolve()
    try:
        target = target.resolve()
    except OSError:
        target = target.absolute()
    if _is_inside(target, out):
        return False
    # Strongly prefer fixing legacy/wrong lazydevfile aliases immediately.
    if "lazydevfile" in {part.lower() for part in target.parts}:
        return True
    if not ARTIFACT_INTENT_RE.search(str(prompt or "")):
        return False
    try:
        cwd = cwd.resolve()
        # Keep normal repository source files in project roots untouched.
        if target.parent == cwd and _has_project_markers(cwd):
            return False
    except OSError:
        pass
    return target.parent == cwd or target.parent == Path.home()


def route_written_artifact(target: str, prompt: str, cwd: str | None = None) -> tuple[Path, Path] | None:
    src = Path(str(target)).expanduser()
    if not src.is_absolute():
        src = (Path(cwd or os.getcwd()) / src).resolve()
    else:
        src = src.resolve()
    if not src.is_file():
        return None
    work = Path(cwd or os.getcwd()).resolve()
    if not should_route(prompt, src, work):
        return None
    out = canonical_artifact_dir().resolve()
    out.mkdir(parents=True, exist_ok=True)
    destination = out / src.name
    if destination.exists():
        stem, suffix = src.stem, src.suffix
        index = 1
        while (out / f"{stem}-{index}{suffix}").exists():
            index += 1
        destination = out / f"{stem}-{index}{suffix}"
    try:
        shutil.move(str(src), str(destination))
    except OSError:
        try:
            shutil.copy2(src, destination)
            src.unlink()
        except OSError:
            return None
    return src, destination

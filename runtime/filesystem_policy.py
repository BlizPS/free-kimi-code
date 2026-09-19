"""Shared filesystem-tool validation for LazyDev's native Kimi integration."""
from __future__ import annotations

import os
import re
from pathlib import Path

READ_MIN_CHARS = 1
WILDCARD_RE = re.compile(r"[*?\[\]{}]")
WINDOWS_SYSTEM_RE = re.compile(
    r"^(?:[A-Za-z]:[\\/](?:Windows|Program Files(?: \(x86\))?|ProgramData|\$Recycle\.Bin|System Volume Information)(?:[\\/]|$)|\\\\[^\\]+\\(?:Windows|Program Files(?: \(x86\))?|ProgramData)(?:[\\/]|$))",
    re.I,
)
POSIX_SYSTEM_ROOTS = {
    "/",
    "/bin",
    "/sbin",
    "/etc",
    "/usr",
    "/var",
    "/opt",
    "/System",
    "/Library",
    "/private",
}


def is_system_path(raw: object) -> bool:
    value = str(raw or "")
    if not value:
        return False
    if os.name == "nt":
        return bool(WINDOWS_SYSTEM_RE.match(value.replace("/", "\\")))
    normalized = os.path.normpath(value)
    return normalized in POSIX_SYSTEM_ROOTS or any(
        normalized.startswith(root.rstrip("/") + "/")
        for root in POSIX_SYSTEM_ROOTS
        if root != "/"
    )


def _message(tool_name: str, tool_input: dict) -> str | None:
    if tool_name == "Read":
        raw_max = tool_input.get("max_chars")
        if raw_max is not None:
            try:
                max_chars = int(raw_max)
            except (TypeError, ValueError):
                return "max_chars must be a positive integer when provided."
            if max_chars < READ_MIN_CHARS:
                return "max_chars must be a positive integer when provided."
        if is_system_path(tool_input.get("path")):
            return "do not read operating-system directories. Read the project workspace or a specific user file instead."

    if tool_name == "Glob":
        pattern = str(tool_input.get("pattern") or "")
        directory = str(tool_input.get("directory") or tool_input.get("path") or "")
        if WILDCARD_RE.search(directory):
            return "Glob directory must not contain wildcards. Put wildcards in pattern and keep directory as a real directory path."
        if (Path(pattern).is_absolute() or re.match(r"^[A-Za-z]:[\\/]", pattern)) and WILDCARD_RE.search(pattern):
            return "Glob pattern must be relative, e.g. pattern=*.html with directory=<folder>; do not use an absolute wildcard path."
        if is_system_path(directory):
            return "do not Glob operating-system directories. Scope the search to the project directory."
        if not directory and WILDCARD_RE.search(pattern) and ("/" in pattern or "\\" in pattern):
            return "Glob absolute paths are disabled. Use a real directory plus a relative pattern."

    if tool_name == "Grep" and is_system_path(tool_input.get("path")):
        return "do not Grep operating-system directories. Scope the search to the project workspace."
    return None


def validate_tool_event(tool_name: object, tool_input: object) -> str | None:
    """Return a correction message, or None when the file-tool call is safe."""
    name = str(tool_name or "")
    args = tool_input if isinstance(tool_input, dict) else {}
    return _message(name, args)

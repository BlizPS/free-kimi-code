"""Shared filesystem-tool validation for LazyDev's native Kimi integration."""
from __future__ import annotations

import os
import re
import json
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



FOCUS_HTML_RE = re.compile(r"\.html?$", re.I)
BROAD_HTML_RE = re.compile(r"\b(all|every|each|multiple|entire|all pages|all html|every page)\b", re.I)

def _load_prompt_focus() -> tuple[list[str], str]:
    home = Path(os.getenv("KIMI_CODE_HOME", Path.home() / ".kimi-code"))
    try:
        data = json.loads((home / "lazydev-last-prompt.json").read_text(encoding="utf-8"))
        focus = data.get("task", {}).get("focusFiles", [])
        prompt = str(data.get("prompt") or "")
        return [str(item) for item in focus if str(item).strip()], prompt
    except Exception:
        return [], ""

def _is_same_focus_html(target: str, focus_files: list[str]) -> bool:
    target_norm = target.replace("\\", "/").lower().rstrip("/")
    target_base = target_norm.split("/")[-1]
    for item in focus_files:
        focus = item.replace("\\", "/").lower().rstrip("/")
        if target_norm == focus or target_base == focus.split("/")[-1]:
            return True
    return False


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
        target = str(tool_input.get("path") or "")
        if is_system_path(target):
            return "do not read operating-system directories. Read the project workspace or a specific user file instead."
        focus_files, prompt = _load_prompt_focus()
        if focus_files and FOCUS_HTML_RE.search(target) and not BROAD_HTML_RE.search(prompt) and not _is_same_focus_html(target, focus_files):
            return "focus guard: this HTML file is outside the files named by the current task; do not read unrelated HTML. Read the focused file or a directly referenced dependency instead."

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

    if tool_name == "Grep":
        target = str(tool_input.get("path") or "")
        if is_system_path(target):
            return "do not Grep operating-system directories. Scope the search to the project workspace."
        focus_files, prompt = _load_prompt_focus()
        if focus_files and FOCUS_HTML_RE.search(target) and not BROAD_HTML_RE.search(prompt) and not _is_same_focus_html(target, focus_files):
            return "focus guard: this HTML file is outside the current task scope; do not inspect unrelated HTML."
    return None


def validate_tool_event(tool_name: object, tool_input: object) -> str | None:
    """Return a correction message, or None when the file-tool call is safe."""
    name = str(tool_name or "")
    args = tool_input if isinstance(tool_input, dict) else {}
    return _message(name, args)

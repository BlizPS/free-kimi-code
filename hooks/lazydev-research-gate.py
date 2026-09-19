#!/usr/bin/env python3
"""Native Kimi research gate for 3D and SEO tasks.

A qualifying search/fetch tool call records research evidence. Before the first
write/edit for a qualifying task, the gate blocks the operation until evidence
exists. The state is session-scoped and resets on every user prompt.
"""
from __future__ import annotations
import json
import os
import re
import sys
import time
from pathlib import Path

SEARCH_TOOLS = {
    "WebSearch", "WebSearchTool", "search_web", "browser_search",
    "browser_open", "FetchURL", "fetch_url", "open_url", "Search",
}
WRITE_TOOLS = {"Write", "WriteFile", "Edit", "StrReplaceFile", "MultiEdit", "NotebookEdit"}
DOMAIN_PATTERNS = {
    "3d": re.compile(r"\b(3d|three(?:\.js)?|webgl|webgpu|gltf|glb|shader|babylon)\b", re.I),
    "seo": re.compile(r"\b(seo|search engine|indexing|crawl|sitemap|robots\.txt|canonical|structured data|schema\.org|meta description|title tag|open graph|og:)\b", re.I),
}


def load(state: Path) -> dict:
    try:
        data = json.loads(state.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save(state: Path, state_dir: Path, data: dict) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    tmp = state.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(state)


def handle(payload: dict, state_dir: str | Path | None = None) -> tuple[int, str]:
    root = Path(state_dir or os.getenv("LAZYDEV_CONTEXT_DIR", Path.home() / ".lazydev"))
    state_file = root / "research-gate.json"
    event = str(payload.get("hook_event_name") or payload.get("event") or "")
    session = str(payload.get("session_id") or "")
    prompt = str(payload.get("prompt") or payload.get("message") or "")

    if event == "UserPromptSubmit":
        domains = [name for name, pattern in DOMAIN_PATTERNS.items() if pattern.search(prompt)]
        save(state_file, root, {
            "session": session,
            "domains": domains,
            "researched": False,
            "sources": [],
            "timestamp": int(time.time()),
        })
        return 0, ""

    state = load(state_file)
    if state.get("session") and session and state.get("session") != session:
        return 0, ""
    domains = state.get("domains") or []

    if event in {"PostToolUse", "PostToolUseSuccess"}:
        tool = str(payload.get("tool_name") or payload.get("name") or "")
        if tool in SEARCH_TOOLS or any(token.lower() == tool.lower() for token in SEARCH_TOOLS):
            output = payload.get("tool_output") or payload.get("output") or ""
            source_text = str(output)[:2000]
            state["researched"] = True
            state.setdefault("sources", []).append({"tool": tool, "sample": source_text[:500]})
            state["sources"] = state["sources"][-6:]
            state["timestamp"] = int(time.time())
            save(state_file, root, state)
        return 0, ""

    if event == "PreToolUse":
        tool = str(payload.get("tool_name") or payload.get("name") or "")
        if domains and tool in WRITE_TOOLS and not state.get("researched"):
            domain = " + ".join(domains)
            return 2, (
                f"Research gate: this {domain} task requires concrete external research before the first code write. "
                "Use WebSearch/search_web (or another configured search tool) to inspect at least one working example "
                "or current authoritative source, then continue."
            )
        return 0, ""

    return 0, ""


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except Exception:
        return 0
    code, message = handle(payload)
    if message:
        print(message, file=sys.stderr)
    return code


if __name__ == "__main__":
    raise SystemExit(main())

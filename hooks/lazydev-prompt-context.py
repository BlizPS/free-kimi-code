#!/usr/bin/env python3
"""Kimi/agent prompt hook for the native LazyDev runtime."""
from __future__ import annotations
import json, os, re, sys, time
from pathlib import Path

text = sys.stdin.read()
try:
    data = json.loads(text or "{}")
except Exception:
    raise SystemExit(0)
prompt = data.get("prompt") or data.get("message") or data.get("user_prompt") or ""
if isinstance(prompt, list):
    prompt = " ".join(str(x.get("text", "")) for x in prompt if isinstance(x, dict) and x.get("type") == "text")
prompt = str(prompt).strip()
PATH_RES = [
    re.compile(r"(?:/storage/emulated/0/|storage/emulated/0/|lazydevfile/)[^\s<>\"']+", re.I),
    re.compile(r"(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.(?:html?|css|js|mjs|json|md|txt|py|ts|tsx|jsx|vue|svelte|astro)\b", re.I),
]

focus_files = []
for pattern in PATH_RES:
    for match in pattern.finditer(prompt):
        value = match.group(0).strip(" \t\r\n(),")
        if value and value not in focus_files:
            focus_files.append(value)

checks = {
    "debug": r"\b(error|bug|crash|fail|broken|hang|timeout|regression)\b",
    "ui": r"\b(ui|ux|frontend|responsive|landing page|design system)\b",
    "artifact": r"\b(save|export|download|artifact|deliverable|generate|create|write|simpan|menyimpan|unduh|hasilkan|buat|bikin|buatin|buatkan|bikinin)\b",
    "review": r"\b(review|audit|code review|inspect)\b",
    "test": r"\b(test|verify|validation|coverage|smoke)\b",
    "research": r"\b(latest|current|documentation|docs|research|search|sejarah|historical|history|tahun|year|statistik|data|biography|biografi)\b",
    "security": r"\b(auth|credential|secret|xss|csrf|permission|sandbox)\b",
    "3d": r"\b(3d|three(?:\.js)?|webgl|webgpu|gltf|glb|shader)\b",
    "seo": r"\b(seo|search engine|indexing|crawl|sitemap|robots\.txt|canonical|structured data|schema\.org|meta description|title tag|open graph)\b",
}
scores = {name: len(re.findall(pattern, prompt, re.I)) for name, pattern in checks.items()}
priority = ["debug", "security", "review", "artifact", "3d", "seo", "ui", "test", "research"]
primary = next((name for name in priority if scores[name]), "implementation")
complexity = min(100, 18 + min(30, len(prompt) // 160 * 4) + sum(6 for v in scores.values() if v))
record = {"event": data.get("hook_event_name", "UserPromptSubmit"), "sessionId": data.get("session_id"), "cwd": data.get("cwd") or os.getcwd(), "prompt": prompt, "model": data.get("model") or os.getenv("LAZYDEV_MODEL", ""), "task": {"primary": primary, "scores": scores, "complexity": complexity, "verify": True, "researchRequired": bool(scores.get("3d") or scores.get("seo") or scores.get("research")), "focusFiles": focus_files[:12]}, "at": int(time.time() * 1000)}
dir_path = Path(os.getenv("LAZYDEV_CONTEXT_DIR", Path.home() / ".lazydev"))
dir_path.mkdir(parents=True, exist_ok=True)
(dir_path / "last-prompt.json").write_text(json.dumps(record), encoding="utf-8")

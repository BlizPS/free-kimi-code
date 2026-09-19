#!/usr/bin/env python3
"""Verify that all shipped LazyDev manifests remain on version 1.0.0."""
from __future__ import annotations
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPECTED = "1.0.0"
JSON_FILES = [
    "package.json",
    "kimi.plugin.json",
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    ".cursor-plugin/plugin.json",
    ".devin-plugin/plugin.json",
]
TEXT_FILES = ["plugin.yaml"]


def main() -> None:
    for rel in JSON_FILES:
        data = json.loads((ROOT / rel).read_text(encoding="utf-8"))
        assert str(data.get("version")) == EXPECTED, f"{rel}: version mismatch"
    for rel in TEXT_FILES:
        text = (ROOT / rel).read_text(encoding="utf-8")
        assert re.search(r"(?m)^version:\s*1\.0\.0\s*$", text), f"{rel}: version mismatch"
    print("PASS: LazyDev version audit 1.0.0")


if __name__ == "__main__":
    main()

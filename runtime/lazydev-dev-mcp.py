#!/usr/bin/env python3
"""LazyDev project MCP server.

Dependency-free, read-only developer tools intended to start instantly under
Codex/Kimi/Antigravity/Claude Code. No package-install or network dependency is required.
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

VERSION = "1.0.3"
MAX_TEXT = 120_000
MAX_RESULTS = 80
IGNORE_DIRS = {
    ".git", ".hg", ".svn", "node_modules", ".pnpm-store", "__pycache__",
    ".cache", "Cache", "target", "dist", "build", ".next", ".turbo",
    "sessions", "logs", ".idea", ".gradle", "coverage",
}


def reply(request_id: Any, result: Any = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {"jsonrpc": "2.0", "id": request_id}
    if error is not None:
        payload["error"] = error
    else:
        payload["result"] = result
    return payload


def text_result(text: str, structured: dict[str, Any], is_error: bool = False) -> dict[str, Any]:
    out = {"content": [{"type": "text", "text": text}], "structuredContent": structured}
    if is_error:
        out["isError"] = True
    return out


def safe_root() -> Path:
    raw = os.environ.get("LAZYDEV_PROJECT_ROOT") or os.getcwd()
    root = Path(raw).expanduser().resolve()
    return root if root.is_dir() else Path.cwd().resolve()


def within_root(root: Path, candidate: Path) -> bool:
    try:
        candidate.relative_to(root)
        return True
    except ValueError:
        return False


def resolve_relative(path: str) -> tuple[Path, Path]:
    root = safe_root()
    rel = Path(str(path or "."))
    target = (root / rel).resolve()
    if not within_root(root, target):
        raise ValueError("Path must stay inside the active project root.")
    return root, target


def git(args: list[str], root: Path, timeout: float = 8.0) -> str:
    try:
        proc = subprocess.run(
            ["git", *args], cwd=root, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            encoding="utf-8", errors="replace", timeout=timeout,
        )
    except FileNotFoundError:
        raise RuntimeError("git is not installed or not available on PATH.")
    except subprocess.TimeoutExpired:
        raise RuntimeError("git command timed out.")
    if proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip() or f"git exited with {proc.returncode}"
        raise RuntimeError(detail[:4000])
    return proc.stdout


def list_files(path: str = ".", pattern: str = "*", max_results: int = 60) -> dict[str, Any]:
    root, base = resolve_relative(path)
    if not base.exists():
        raise ValueError(f"Path does not exist: {path}")
    if not base.is_dir():
        raise ValueError("list_files requires a directory.")
    limit = max(1, min(MAX_RESULTS, int(max_results or 60)))
    results: list[str] = []
    stack = [base]
    while stack and len(results) < limit:
        current = stack.pop()
        try:
            entries = sorted(current.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except OSError:
            continue
        for entry in entries:
            if entry.name in IGNORE_DIRS or entry.name.startswith(".") and entry.name not in {".env.example"}:
                continue
            rel = entry.relative_to(root).as_posix()
            if fnmatch.fnmatch(rel, pattern) or fnmatch.fnmatch(entry.name, pattern):
                results.append(rel + ("/" if entry.is_dir() else ""))
                if len(results) >= limit:
                    break
            if entry.is_dir():
                stack.append(entry)
    return {"status": "ok", "root": str(root), "path": str(base.relative_to(root) or "."), "files": results, "truncated": bool(stack)}


def read_file(path: str, start_line: int = 1, max_lines: int = 160) -> dict[str, Any]:
    root, target = resolve_relative(path)
    if not target.is_file():
        raise ValueError(f"Not a file: {path}")
    size = target.stat().st_size
    if size > MAX_TEXT:
        raise ValueError(f"File is too large to read directly ({size} bytes).")
    raw = target.read_text(encoding="utf-8", errors="replace")
    lines = raw.splitlines()
    start = max(1, int(start_line or 1))
    limit = max(1, min(500, int(max_lines or 160)))
    selected = lines[start - 1:start - 1 + limit]
    numbered = "\n".join(f"{i}: {line}" for i, line in enumerate(selected, start))
    return {"status": "ok", "path": str(target.relative_to(root).as_posix()), "start_line": start, "lines": len(selected), "content": numbered}


def search_code(query: str, path: str = ".", glob: str = "*", max_results: int = 50, case_sensitive: bool = False) -> dict[str, Any]:
    root, base = resolve_relative(path)
    needle = str(query or "").strip()
    if not needle:
        raise ValueError("query is required")
    limit = max(1, min(MAX_RESULTS, int(max_results or 50)))
    flags = 0 if case_sensitive else re.I
    try:
        rx = re.compile(needle, flags)
        matcher = lambda line: bool(rx.search(line))
    except re.error:
        cmp = needle if case_sensitive else needle.lower()
        matcher = lambda line: (cmp in line if case_sensitive else cmp in line.lower())
    results: list[dict[str, Any]] = []
    stack = [base]
    while stack and len(results) < limit:
        current = stack.pop()
        try:
            entries = current.iterdir()
        except OSError:
            continue
        for entry in entries:
            if entry.name in IGNORE_DIRS or entry.name.startswith(".") and entry.name not in {".env.example"}:
                continue
            if entry.is_dir():
                stack.append(entry)
                continue
            rel = entry.relative_to(root).as_posix()
            if not (fnmatch.fnmatch(rel, glob) or fnmatch.fnmatch(entry.name, glob)):
                continue
            try:
                if entry.stat().st_size > MAX_TEXT:
                    continue
                lines = entry.read_text(encoding="utf-8", errors="replace").splitlines()
            except (OSError, UnicodeError):
                continue
            for line_no, line in enumerate(lines, 1):
                if matcher(line):
                    results.append({"path": rel, "line": line_no, "text": line[:400]})
                    if len(results) >= limit:
                        break
            if len(results) >= limit:
                break
    return {"status": "ok", "query": needle, "results": results, "truncated": len(results) >= limit}


def main() -> None:
    for raw in sys.stdin.buffer:
        raw = raw.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw.decode("utf-8", "replace"))
            rid = req.get("id")
            method = req.get("method")
            params = req.get("params") if isinstance(req.get("params"), dict) else {}
            if method == "initialize":
                response = reply(rid, {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "lazydev-dev", "version": VERSION},
                })
            elif method in {"notifications/initialized", "notifications/cancelled"}:
                continue
            elif method == "ping":
                response = reply(rid, {})
            elif method == "tools/list":
                response = reply(rid, {"tools": [
                    {"name": "project_tree", "description": "List project files without entering generated/cache/session directories.", "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}, "pattern": {"type": "string"}, "max_results": {"type": "integer"}}}},
                    {"name": "read_file", "description": "Read a text file inside the active project root with line numbers.", "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}, "start_line": {"type": "integer"}, "max_lines": {"type": "integer"}}, "required": ["path"]}},
                    {"name": "search_code", "description": "Search project source text with a regex or literal query.", "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}, "path": {"type": "string"}, "glob": {"type": "string"}, "max_results": {"type": "integer"}, "case_sensitive": {"type": "boolean"}}, "required": ["query"]}},
                    {"name": "git_status", "description": "Show concise git working-tree status.", "inputSchema": {"type": "object", "properties": {}}},
                    {"name": "git_diff", "description": "Show a bounded git diff for the active project.", "inputSchema": {"type": "object", "properties": {"staged": {"type": "boolean"}, "stat_only": {"type": "boolean"}}}},
                ]})
            elif method == "tools/call":
                name = str(params.get("name") or "")
                args = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
                root = safe_root()
                if name == "project_tree":
                    result = list_files(str(args.get("path") or "."), str(args.get("pattern") or "*"), int(args.get("max_results") or 60))
                    response = reply(rid, text_result("\n".join(result["files"]), result))
                elif name == "read_file":
                    result = read_file(str(args.get("path") or ""), int(args.get("start_line") or 1), int(args.get("max_lines") or 160))
                    response = reply(rid, text_result(result["content"], result))
                elif name == "search_code":
                    result = search_code(str(args.get("query") or ""), str(args.get("path") or "."), str(args.get("glob") or "*"), int(args.get("max_results") or 50), bool(args.get("case_sensitive")))
                    body = "\n".join(f"{x['path']}:{x['line']}: {x['text']}" for x in result["results"])
                    response = reply(rid, text_result(body or "No matches.", result))
                elif name == "git_status":
                    out = git(["status", "--short", "--branch"], root)
                    response = reply(rid, text_result(out.strip() or "Clean working tree.", {"status": "ok", "output": out}))
                elif name == "git_diff":
                    cmd = ["diff", "--no-ext-diff", "--unified=3"]
                    if bool(args.get("staged")):
                        cmd.append("--cached")
                    if bool(args.get("stat_only")):
                        cmd.append("--stat")
                    out = git(cmd, root)
                    out = out[:MAX_TEXT]
                    response = reply(rid, text_result(out or "No changes.", {"status": "ok", "output": out, "truncated": len(out) >= MAX_TEXT}))
                else:
                    response = reply(rid, error={"code": -32602, "message": f"Unknown tool: {name}"})
            else:
                response = reply(rid, error={"code": -32601, "message": f"Method not found: {method}"})
            sys.stdout.buffer.write((json.dumps(response, ensure_ascii=False) + "\n").encode("utf-8"))
            sys.stdout.buffer.flush()
        except Exception as exc:
            rid = None
            try:
                rid = req.get("id")
            except Exception:
                pass
            if rid is not None:
                sys.stdout.buffer.write((json.dumps(reply(rid, error={"code": -32000, "message": str(exc)}), ensure_ascii=False) + "\n").encode("utf-8"))
                sys.stdout.buffer.flush()


if __name__ == "__main__":
    main()

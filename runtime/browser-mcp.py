#!/usr/bin/env python3
"""Dependency-free native-Python MCP adapter for LazyDev browser tools.

This is the default Kimi/no-Node path. It mirrors runtime/browser.mjs so
LazyDev can expose browser MCP tools without requiring Node.js.
"""

from __future__ import annotations

import html
import ipaddress
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

VERSION = "1.0.0"
USER_AGENT = os.environ.get("LAZYDEV_BROWSER_USER_AGENT", f"LazyDev-Browser/{VERSION}")
TIMEOUT = max(3, min(60, int(os.environ.get("LAZYDEV_BROWSER_TIMEOUT_MS", "15000")) / 1000))
MAX_CHARS = max(2048, min(200000, int(os.environ.get("LAZYDEV_BROWSER_MAX_CHARS", "50000"))))
MAX_RESULTS = max(1, min(20, int(os.environ.get("LAZYDEV_BROWSER_MAX_RESULTS", "8"))))
ALLOW_PRIVATE = os.environ.get("LAZYDEV_BROWSER_ALLOW_PRIVATE") == "1"
CACHE: dict[tuple[str, str], tuple[float, Any]] = {}


@dataclass(frozen=True)
class SearchEngine:
    name: str
    url_template: str


ENGINES = (
    SearchEngine("duckduckgo-html", "https://html.duckduckgo.com/html/?q={}"),
    SearchEngine("duckduckgo-lite", "https://lite.duckduckgo.com/lite/?q={}"),
    SearchEngine("bing", "https://www.bing.com/search?q={}"),
)


def safe_json(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def reply(request_id: Any, result: Any = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id}
    if error is not None:
        payload["error"] = error
    else:
        payload["result"] = result
    return payload


def tool_result(text: str, structured: dict[str, Any], is_error: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {"content": [{"type": "text", "text": text}], "structuredContent": structured}
    if is_error:
        result["isError"] = True
    return result


def unavailable(message: str, diagnostics: list[str] | None = None) -> dict[str, Any]:
    return tool_result(
        f"[LazyDev browser] {message}",
        {"status": "unavailable", "retryable": True, "diagnostics": (diagnostics or [])[:3]},
        True,
    )


def normalize_url(value: str) -> str:
    parsed = urllib.parse.urlparse(str(value or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Invalid URL. Use an absolute http:// or https:// URL.")
    return parsed.geturl()


def host_is_private(host: str) -> bool:
    if ALLOW_PRIVATE:
        return False
    lower = host.lower().strip("[]")
    if lower == "localhost" or lower.endswith(".localhost"):
        return True
    try:
        addr = ipaddress.ip_address(lower)
        return addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_unspecified
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(lower, None)
    except OSError:
        return False
    return any(ipaddress.ip_address(item[4][0]).is_private or ipaddress.ip_address(item[4][0]).is_loopback or ipaddress.ip_address(item[4][0]).is_link_local for item in infos)


def fetch(url: str) -> tuple[str, int, str, str]:
    current = normalize_url(url)
    for _ in range(5):
        parsed = urllib.parse.urlparse(current)
        if host_is_private(parsed.hostname or ""):
            raise ValueError("Private/local hosts are disabled by default. Set LAZYDEV_BROWSER_ALLOW_PRIVATE=1 to allow them.")
        req = urllib.request.Request(current, headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,text/plain,text/markdown,application/json;q=0.9,*/*;q=0.5",
        })
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
                body = response.read().decode("utf-8", "replace")
                return response.geturl(), int(response.status), str(response.headers.get("Content-Type", "")), body
        except urllib.error.HTTPError as exc:
            location = exc.headers.get("Location")
            if location and exc.code in {301, 302, 303, 307, 308}:
                current = urllib.parse.urljoin(current, location)
                continue
            raise RuntimeError(f"HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(str(exc.reason)) from exc
    raise RuntimeError("Too many redirects")


def cached(kind: str, key: str, ttl: float) -> Any | None:
    value = CACHE.get((kind, key))
    if value and value[0] > time.time():
        return value[1]
    CACHE.pop((kind, key), None)
    return None


def put_cache(kind: str, key: str, value: Any, ttl: float) -> None:
    CACHE[(kind, key)] = (time.time() + ttl, value)


def fetch_retry(url: str) -> tuple[str, int, str, str]:
    last: Exception | None = None
    for attempt in range(2):
        try:
            return fetch(url)
        except Exception as exc:  # network faults are deliberately recoverable
            last = exc
            if attempt == 0:
                time.sleep(0.25)
    raise last or RuntimeError("fetch unavailable")


def strip_html(value: str) -> str:
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def parse_links(body: str, base_url: str) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    for match in re.finditer(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)</a>", body, flags=re.I):
        try:
            target = urllib.parse.urljoin(base_url, html.unescape(match.group(1)))
            text = strip_html(match.group(2))[:300]
            if urllib.parse.urlparse(target).scheme in {"http", "https"}:
                links.append({"text": text, "url": target})
        except Exception:
            continue
        if len(links) >= 100:
            break
    return links


def parse_document(body: str, content_type: str, base_url: str) -> tuple[str, str, list[dict[str, str]]]:
    if re.search(r"text/plain|text/markdown|application/json", content_type, flags=re.I):
        return "", body[:MAX_CHARS], []
    match = re.search(r"<title[^>]*>([\s\S]*?)</title>", body, flags=re.I)
    title = strip_html(match.group(1)) if match else ""
    text = strip_html(body)[:MAX_CHARS]
    return title, text, parse_links(body, base_url)


def parse_search(engine: SearchEngine, body: str) -> list[dict[str, str]]:
    patterns = {
        "duckduckgo-html": r"<a[^>]+class=[\"'][^\"']*result__a[^\"']*[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)</a>",
        "duckduckgo-lite": r"<a[^>]+class=[\"']result-link[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)</a>",
        "bing": r"<li[^>]+class=[\"'][^\"']*b_algo[^\"']*[\"'][\s\S]*?<h2[^>]*>\s*<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)</a>",
    }
    results: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in re.finditer(patterns[engine.name], body, flags=re.I):
        raw_url = html.unescape(match.group(1))
        title = strip_html(match.group(2))
        parsed = urllib.parse.urlparse(raw_url)
        target = urllib.parse.parse_qs(parsed.query).get("uddg", [raw_url])[0]
        if target not in seen and target and title:
            results.append({"title": title, "url": target})
            seen.add(target)
    return results


def search(query: str) -> dict[str, Any]:
    if os.environ.get("LAZYDEV_BROWSER_TEST_UNAVAILABLE") == "1":
        return unavailable("Web search is temporarily unavailable in test mode.", ["simulated network outage"])
    q = str(query or "").strip()
    if not q:
        return unavailable("Search query is required.")
    cached_result = cached("search", q.lower(), 120)
    if cached_result is not None:
        return cached_result
    failures: list[str] = []
    for engine in ENGINES:
        try:
            page_url, _, content_type, body = fetch_retry(engine.url_template.format(urllib.parse.quote(q)))
            del page_url, content_type
            results = parse_search(engine, body)[:MAX_RESULTS]
            if not results:
                raise RuntimeError("no results parsed")
            result = tool_result(
                f"Search results for: {q}\nSource: {engine.name}\n" + "\n".join(f"{i}. {item['title']}\n   {item['url']}" for i, item in enumerate(results, 1)),
                {"status": "ok", "query": q, "source": engine.name, "results": results},
            )
            put_cache("search", q.lower(), result, 120)
            return result
        except Exception as exc:
            failures.append(f"{engine.name}: {exc}")
    return unavailable("Web search is temporarily unavailable. Continue with native WebSearch/FetchURL or local project context.", failures)


def open_url(url: str) -> dict[str, Any]:
    try:
        final_url, status, content_type, body = fetch_retry(url)
        title, text, links = parse_document(body, content_type, final_url)
        return tool_result(
            f"{f'Title: {title}\n' if title else ''}URL: {final_url}\n\n{text}",
            {"status": "ok", "url": final_url, "statusCode": status, "contentType": content_type, "title": title, "text": text, "links": links, "truncated": len(body) > MAX_CHARS},
        )
    except Exception as exc:
        return unavailable(f"Unable to open URL: {exc}")


def links_url(url: str) -> dict[str, Any]:
    result = open_url(url)
    if result.get("structuredContent", {}).get("status") != "ok":
        return result
    links = result["structuredContent"].get("links", [])
    text = "\n".join(f"{i}. {item.get('text') or '(no text)'}\n   {item['url']}" for i, item in enumerate(links, 1)) or "(no links found)"
    return tool_result(f"Links from {result['structuredContent']['url']}\n{text}", {"status": "ok", "url": result['structuredContent']['url'], "links": links})


def tools() -> dict[str, Any]:
    def spec(name: str, description: str, prop: str, label: str) -> dict[str, Any]:
        return {"name": name, "description": description, "inputSchema": {"type": "object", "properties": {prop: {"type": "string", "description": label}}, "required": [prop], "additionalProperties": False}}
    return {"tools": [
        spec("search_web", "Search the public web. Network failures return a normal tool result.", "query", "Web search query"),
        spec("browser_open", "Fetch a public HTTP(S) URL and extract readable text, title, and links.", "url", "Absolute HTTP(S) URL"),
        spec("browser_links", "Extract links from a public HTTP(S) URL.", "url", "Absolute HTTP(S) URL"),
    ]}


def handle(request: dict[str, Any]) -> dict[str, Any] | None:
    request_id = request.get("id")
    method = request.get("method")
    params = safe_json(request.get("params"))
    if method == "initialize":
        return reply(request_id, {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "serverInfo": {"name": "lazydev-browser", "version": VERSION}})
    if method in {"notifications/initialized", "notifications/cancelled"}:
        return None
    if method == "ping":
        return reply(request_id, {})
    if method == "tools/list":
        return reply(request_id, tools())
    if method == "tools/call":
        name = str(params.get("name") or "")
        args = safe_json(params.get("arguments"))
        if name == "search_web":
            return reply(request_id, search(str(args.get("query") or "")))
        if name == "browser_open":
            return reply(request_id, open_url(str(args.get("url") or "")))
        if name == "browser_links":
            return reply(request_id, links_url(str(args.get("url") or "")))
        return reply(request_id, error={"code": -32602, "message": f"Unknown tool: {name}"})
    return reply(request_id, error={"code": -32601, "message": f"Method not found: {method}"})


def write_json_line(payload: dict[str, Any]) -> None:
    # MCP JSON-RPC is UTF-8. Writing encoded bytes avoids Windows cp1252/charmap
    # failures when fetched pages contain Japanese, emoji, or other Unicode.
    data = (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
    stream = getattr(sys.stdout, "buffer", None)
    if stream is not None:
        stream.write(data)
        stream.flush()
    else:
        sys.stdout.write(data.decode("utf-8"))
        sys.stdout.flush()


def main() -> None:
    stream = getattr(sys.stdin, "buffer", None)
    iterator = stream if stream is not None else sys.stdin
    for raw in iterator:
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", "replace")
        raw = raw.strip()
        if not raw:
            continue
        try:
            request = json.loads(raw)
            response = handle(request)
            if response is not None:
                write_json_line(response)
        except Exception as exc:
            request_id = None
            try:
                request_id = json.loads(raw).get("id")
            except Exception:
                pass
            if request_id is not None:
                write_json_line(reply(request_id, error={"code": -32000, "message": str(exc)}))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Lazy Developer native CLI.

The installer uses this Python entrypoint so the LazyDev CLI does not require
Node.js. The existing JavaScript systems remain bundled for plugin hosts and
legacy development tooling; this CLI consumes the same project data directly.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import secrets
import shutil
import subprocess
import threading
import time
import http.server
import http.client
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

VERSION = "1.0.0"
KIMI_VERSION = "2.0.0"
ROOT = Path(__file__).resolve().parents[1]
HOME = Path.home()
IS_WINDOWS = os.name == "nt"
IS_MAC = sys.platform == "darwin"

if IS_WINDOWS:
    CONFIG_DIR = Path(os.environ.get("APPDATA", HOME)) / "lazydev"
    KIMI_HOME = CONFIG_DIR / "kimi-code"
    ARTIFACT_DIR = Path(os.environ.get("LOCALAPPDATA", HOME)) / "LazyDev" / "artifacts"
else:
    CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", HOME / ("Library/Application Support" if IS_MAC else ".config"))) / "lazydev"
    KIMI_HOME = CONFIG_DIR / "kimi-code"
    ARTIFACT_DIR = Path(os.environ.get("LAZYDEV_ARTIFACT_DIR", HOME / ("Library/Application Support/lazydev/artifacts" if IS_MAC else ".local/share/lazydev/artifacts")))

PROVIDERS: list[dict[str, Any]] = [
    {"id": "openrouter", "label": "OpenRouter", "kind": "openai", "models": "https://openrouter.ai/api/v1/models", "base": "https://openrouter.ai/api/v1", "env": "OPENROUTER_API_KEY"},
    {"id": "gemini", "label": "Gemini", "kind": "openai", "models": "https://generativelanguage.googleapis.com/v1beta/models", "base": "https://generativelanguage.googleapis.com/v1beta/openai", "env": "GEMINI_API_KEY"},
    {"id": "nvidia", "label": "NVIDIA", "kind": "openai", "models": "https://integrate.api.nvidia.com/v1/models", "base": "https://integrate.api.nvidia.com/v1", "env": "NVIDIA_API_KEY"},
    {"id": "openai", "label": "OpenAI", "kind": "openai", "models": "https://api.openai.com/v1/models", "base": "https://api.openai.com/v1", "env": "OPENAI_API_KEY"},
    {"id": "ollama", "label": "Ollama Local", "kind": "ollama", "models": None, "base": "http://127.0.0.1:11434", "env": None},
    {"id": "llm7", "label": "LLM7", "kind": "openai", "models": "https://api.llm7.io/v1/models", "base": "https://api.llm7.io/v1", "env": "LLM7_API_KEY"},
    {"id": "groq", "label": "Groq", "kind": "openai", "models": "https://api.groq.com/openai/v1/models", "base": "https://api.groq.com/openai/v1", "env": "GROQ_API_KEY"},
    {"id": "codebuddy", "label": "CodeBuddy", "kind": "openai", "models": ["https://copilot.tencent.com/v3/config", "https://api.codebuddy.ai/v1/models"], "base": "https://api.codebuddy.ai/v1", "env": "CODEBUDDY_API_KEY"},
    {"id": "anthropic", "label": "Anthropic", "kind": "anthropic", "models": "https://api.anthropic.com/v1/models", "base": "https://api.anthropic.com", "env": "ANTHROPIC_API_KEY"},
]

SKILLS = [
    ("lazy-developer", "Build and ship with focused engineering workflow"),
    ("lazy-debug", "Diagnose bugs with evidence-first debugging"),
    ("lazy-review", "Review code for correctness, risks, and regressions"),
    ("lazy-test", "Verify behavior and coverage"),
]

EXTENSIONS = {"html", "htm", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "png", "jpg", "jpeg", "webp", "gif", "svg", "csv", "md", "txt"}

# Kimi Code 2.x may attach OpenAI-only request hints to every OpenAI-compatible
# request. Several compatible gateways reject those fields with HTTP 400 even
# though the core chat payload is valid. Keep these disabled unless an upstream
# explicitly accepts them; the local proxy also learns additional rejected
# parameters from an upstream 400 response and retries without them.
KNOWN_UNSUPPORTED_REQUEST_FIELDS = {
    "prompt_cache_key",
    "safety_identifier",
}
PROXY_MAX_RETRIES = 2
PROXY_MAX_400_REPAIRS = 4


def ansi(code: str, value: str) -> str:
    return f"\x1b[{code}m{value}\x1b[0m" if sys.stdout.isatty() else value


def title(value: str) -> None:
    print(f"\n{ansi('1;36', value)}\n")


def json_load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def config_file() -> Path:
    return CONFIG_DIR / "config.json"


def read_config() -> dict[str, Any]:
    value = json_load(config_file(), {})
    return value if isinstance(value, dict) else {}


def write_config(value: dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    temp = config_file().with_suffix(f".tmp-{os.getpid()}")
    temp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temp.replace(config_file())


def provider_config(config: dict[str, Any], provider_id: str) -> dict[str, Any]:
    value = config.get("providers", {}).get(provider_id, {})
    return value if isinstance(value, dict) else {}


def active_provider(config: dict[str, Any]) -> dict[str, Any]:
    selected = config.get("activeProvider")
    for provider in PROVIDERS:
        if provider["id"] == selected:
            return provider
    return PROVIDERS[1]


def request_json(url: str, *, headers: dict[str, str] | None = None, timeout: float = 15) -> Any:
    req = urllib.request.Request(url, headers={"Accept": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            data = response.read()
        return json.loads(data.decode("utf-8")) if data else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:500]
        try:
            detail = json.loads(body).get("error", {}).get("message") or body
        except Exception:
            detail = body
        raise RuntimeError(f"{exc.code}: {detail}") from exc
    except TimeoutError as exc:
        raise RuntimeError(f"Request timed out after {int(timeout * 1000)}ms.") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc


def normalize_model(item: dict[str, Any], provider: dict[str, Any]) -> dict[str, Any]:
    pid = provider["id"]
    if pid == "gemini":
        raw = str(item.get("name") or "").replace("models/", "", 1)
        return {
            "id": raw,
            "name": item.get("displayName") or raw,
            "context": item.get("inputTokenLimit"),
            "output": item.get("outputTokenLimit"),
            "toolUse": True,
        }
    if pid == "ollama":
        raw = str(item.get("name") or item.get("model") or item.get("id") or "").strip()
        return {"id": raw, "name": raw, "toolUse": True, "local": True}
    raw = str(item.get("id") or item.get("name") or item.get("slug") or "").strip()
    pricing = item.get("pricing") if isinstance(item.get("pricing"), dict) else {}
    supported = item.get("supported_parameters") if isinstance(item.get("supported_parameters"), list) else []
    free = pid == "openrouter" and (raw == "openrouter/free" or raw.lower().endswith(":free") or (str(pricing.get("prompt", "")) == "0" and str(pricing.get("completion", "")) == "0"))
    top_provider = item.get("top_provider") if isinstance(item.get("top_provider"), dict) else {}
    output_limit = item.get("max_completion_tokens") or top_provider.get("max_completion_tokens")
    return {"id": raw, "name": item.get("name") or raw, "toolUse": True if not supported else "tools" in supported, "free": free, "context": item.get("context_length"), "output": output_limit}


def _extract_model_records(data: Any) -> list[Any]:
    if not isinstance(data, dict):
        return []
    for key in ("data", "models", "modelList", "model_list", "items"):
        value = data.get(key)
        if isinstance(value, list):
            return value
    return []


def fetch_models(provider: dict[str, Any], api_key: str = "", base_url: str = "") -> list[dict[str, Any]]:
    pid = provider["id"]
    if pid == "ollama":
        base = normalize_url(base_url or provider["base"]).rstrip("/")
        data = request_json(f"{base}/api/tags")
        raw = data.get("models", []) if isinstance(data, dict) else []
        return [normalize_model(item, provider) for item in raw if isinstance(item, dict)]
    if pid == "gemini":
        url = f"{provider['models']}?key={urllib.parse.quote(api_key, safe='')}"
        data = request_json(url)
        raw = data.get("models", []) if isinstance(data, dict) else []
    elif pid == "anthropic":
        data = request_json(provider["models"], headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "User-Agent": f"lazydev/{VERSION}"})
        raw = data.get("data", []) if isinstance(data, dict) else []
    elif pid == "codebuddy":
        urls = provider["models"] if isinstance(provider.get("models"), list) else [provider.get("models")]
        last_error = None
        raw = []
        for url in urls:
            try:
                data = request_json(str(url), headers={"Authorization": f"Bearer {api_key}", "x-api-key": api_key, "User-Agent": f"lazydev/{VERSION}"})
                raw = _extract_model_records(data)
                if raw:
                    break
            except Exception as exc:
                last_error = exc
        if not raw and last_error:
            raise last_error
    else:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        data = request_json(provider["models"], headers=headers)
        raw = _extract_model_records(data)
    models = [normalize_model(item if isinstance(item, dict) else {"id": str(item)}, provider) for item in raw]
    models = [m for m in models if m.get("id")]
    if pid == "openrouter":
        synthetic = {"id": "openrouter/free", "name": "Free Models Router · openrouter/free", "toolUse": True, "free": True, "context": 200000, "output": 8192}
        if not any(m["id"] == synthetic["id"] for m in models):
            models.insert(0, synthetic)
        models.sort(key=lambda m: (0 if m["id"] == "openrouter/free" else 1, 0 if m.get("free") else 1, str(m.get("name", "")).lower()))
    else:
        models.sort(key=lambda m: str(m.get("name", "")).lower())
    return models


def normalize_url(value: str) -> str:
    value = str(value or "").strip()
    if not re.match(r"^[a-z][a-z0-9+.-]*://", value, re.I):
        value = "http://" + value
    return value.rstrip("/")


def prompt(text: str, default: str = "") -> str:
    try:
        answer = input(text)
    except (EOFError, KeyboardInterrupt):
        print()
        raise SystemExit(130)
    return answer.strip() or default


def choose_model(models: list[dict[str, Any]], current: str = "") -> dict[str, Any]:
    if not models:
        raise RuntimeError("No compatible models returned.")
    index = next((i for i, item in enumerate(models) if item["id"] == current), 0)
    shown = models[:40]
    print("\nChoose a live model:\n")
    for i, item in enumerate(shown, 1):
        suffix = " · free" if item.get("free") else ""
        marker = "›" if i - 1 == index else " "
        print(f"{marker} {i:>2}. {item.get('name') or item['id']}{suffix}")
    choice = prompt(f"\nModel [1-{len(shown)}] (current {index + 1}): ", str(index + 1))
    try:
        picked = max(1, min(len(shown), int(choice)))
    except ValueError:
        picked = index + 1
    return shown[picked - 1]


def setup() -> int:
    config = read_config()
    config.setdefault("providers", {})
    title(f"Lazy Developer {VERSION}")
    print("Provider setup · live model catalog\n")
    for i, provider in enumerate(PROVIDERS, 1):
        saved = provider_config(config, provider["id"])
        configured = bool(saved.get("model")) and (provider["id"] == "ollama" or bool(saved.get("apiKey")))
        state = ansi("32", "saved") if configured else ansi("2", "not configured")
        print(f"{i}. {provider['label']} · {state}{(' · ' + str(saved['model'])) if saved.get('model') else ''}")
    number = prompt(f"\nProvider [1-{len(PROVIDERS)}]: ")
    try:
        provider = PROVIDERS[int(number) - 1]
    except (ValueError, IndexError):
        print(ansi("31", "Invalid provider number."))
        return 1
    saved = provider_config(config, provider["id"])
    if provider["id"] == "ollama":
        base = prompt("Ollama API URL [http://127.0.0.1:11434]: ", saved.get("baseUrl") or provider["base"])
        key = "ollama"
    else:
        key = str(saved.get("apiKey", ""))
        if key and prompt(f"{provider['label']} key saved. Keep it? [Y/n]: ", "y").lower() not in {"y", "yes"}:
            key = ""
        if not key:
            key = prompt(f"{provider['label']} API key: ")
        if not key:
            print(ansi("33", "Skipped: no API key entered."))
            return 0
        base = provider["base"]
    print(f"{provider['label']} · loading live models ... ", end="", flush=True)
    try:
        models = fetch_models(provider, key, base)
        print(ansi("32", f"{len(models)} found"))
        chosen = choose_model(models, str(saved.get("model", "")))
    except Exception as exc:
        print(ansi("31", str(exc)))
        return 1
    config["providers"][provider["id"]] = {"apiKey": key, "model": chosen["id"], "modelInfo": chosen, **({"baseUrl": normalize_url(base)} if provider["id"] == "ollama" else {})}
    config["activeProvider"] = provider["id"]
    write_config(config)
    print(ansi("32", f"✓ {provider['label']} · {chosen['id']} saved"))
    return 0


def find_kimi() -> str | None:
    candidates = []
    if IS_WINDOWS:
        candidates += [str(HOME / ".kimi-code/bin/kimi.exe"), str(HOME / ".local/bin/kimi.exe"), str(HOME / ".local/bin/kimi.cmd")]
    else:
        candidates += [str(HOME / ".kimi-code/bin/kimi"), str(HOME / ".local/bin/kimi")]
    for candidate in candidates:
        if Path(candidate).is_file():
            return candidate
    for name in ("kimi.exe", "kimi.cmd", "kimi") if IS_WINDOWS else ("kimi",):
        found = shutil.which(name)
        if found:
            return found
    return None


def toml_quote(value: str) -> str:
    return json.dumps(str(value))


def model_context_size(provider: dict[str, Any], pc: dict[str, Any]) -> int:
    info = pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}
    candidates = (
        info.get("context"),
        info.get("contextLimit"),
        info.get("context_length"),
        info.get("inputTokenLimit"),
        info.get("inputLimit"),
    )
    for value in candidates:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            continue
        if parsed > 0:
            return max(1024, parsed)
    # Kimi Code requires a positive model context declaration.
    # Keep the unknown-model fallback conservative so providers without
    # context metadata (notably Ollama) still start reliably.
    return 32768


def model_output_size(pc: dict[str, Any]) -> int:
    info = pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}
    for value in (info.get("output"), info.get("outputLimit"), info.get("max_completion_tokens")):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            continue
        if parsed > 0:
            return max(256, parsed)
    return 8192


def is_antigravity_model_name(model: str) -> bool:
    return bool(re.search(r"antigravity|gemini.*preview", str(model), re.I))


def model_supports_tools(pc: dict[str, Any]) -> bool:
    info = pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}
    value = info.get("toolUse")
    if value is None:
        return True
    return bool(value)


def clear_terminal() -> None:
    if not sys.stdout.isatty():
        return
    try:
        # Clear the visible screen and scrollback before every fresh chat.
        sys.stdout.write("\x1b[2J\x1b[3J\x1b[H")
        sys.stdout.flush()
    except Exception:
        command = "cls" if IS_WINDOWS else "clear"
        try:
            subprocess.run(command, shell=True, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass


def _strip_request_fields(body: dict[str, Any], fields: set[str]) -> tuple[dict[str, Any], set[str]]:
    cleaned = dict(body)
    removed: set[str] = set()
    for field in fields:
        if field in cleaned:
            cleaned.pop(field, None)
            removed.add(field)
    extra = cleaned.get("extra_body")
    if isinstance(extra, dict):
        extra_clean = dict(extra)
        for field in fields:
            if field in extra_clean:
                extra_clean.pop(field, None)
                removed.add(field)
        if extra_clean:
            cleaned["extra_body"] = extra_clean
        else:
            cleaned.pop("extra_body", None)
    return cleaned, removed


def _unsupported_fields_from_error(detail: str) -> set[str]:
    text = str(detail or "")
    found = set(re.findall(r"[`\"]([A-Za-z_][A-Za-z0-9_]*)[`\"]", text))
    lower = text.lower()
    if not found and ("unsupported parameter" in lower or "unrecognized request argument" in lower or "unknown parameter" in lower):
        match = re.search(r"(?:supplied|parameter(?:s)?\s*[:=]?)\s*([A-Za-z_][A-Za-z0-9_]*)", text, re.I)
        if match:
            found.add(match.group(1))
    return {name for name in found if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", name)}


def _retry_after_seconds(headers: dict[str, str]) -> float:
    value = str(headers.get("Retry-After", "") or "").strip()
    try:
        return max(0.0, min(30.0, float(value))) if value else 0.0
    except ValueError:
        return 0.0


class _ProviderProxy:
    def __init__(self, provider: dict[str, Any], pc: dict[str, Any]):
        self.provider = provider
        self.pc = pc
        self.token = secrets.token_hex(24)
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self.thread = threading.Thread(target=self.server.serve_forever, name="lazydev-provider-proxy", daemon=True)
        self.thread.start()

    @property
    def port(self) -> int:
        return int(self.server.server_address[1])

    def close(self) -> None:
        try:
            self.server.shutdown()
        finally:
            self.server.server_close()
            self.thread.join(timeout=1.0)

    def _handler(self):
        outer = self

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"
            server_version = "LazyDevProviderProxy/1.0"

            def log_message(self, fmt: str, *args: Any) -> None:
                return

            def _send_json(self, status: int, payload: Any) -> None:
                data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(data)
                self.close_connection = True

            def _relay(self, status: int, headers: dict[str, str], response: Any, is_stream: bool) -> None:
                self.send_response(status)
                hop = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"}
                for key, value in headers.items():
                    if key.lower() in hop or key.lower() == "content-length":
                        continue
                    self.send_header(key, value)
                self.send_header("X-LazyDev-Provider-Proxy", "1")
                if is_stream:
                    self.send_header("Connection", "close")
                    self.end_headers()
                    try:
                        while True:
                            chunk = response.read(64 * 1024)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            self.wfile.flush()
                    finally:
                        try:
                            response.close()
                        except Exception:
                            pass
                else:
                    payload = response.read()
                    self.send_header("Content-Length", str(len(payload)))
                    self.send_header("Connection", "close")
                    self.end_headers()
                    self.wfile.write(payload)
                self.close_connection = True

            def do_POST(self) -> None:
                if self.headers.get("Authorization", "") != f"Bearer {outer.token}":
                    return self._send_json(401, {"error": {"message": "Unauthorized"}})
                if self.path.split("?", 1)[0] != "/v1/chat/completions":
                    return self._send_json(404, {"error": {"message": "Not found"}})
                try:
                    size = int(self.headers.get("Content-Length", "0") or "0")
                except ValueError:
                    size = 0
                if size <= 0 or size > 8 * 1024 * 1024:
                    return self._send_json(400, {"error": {"message": "Invalid request body size"}})
                try:
                    body = json.loads(self.rfile.read(size).decode("utf-8"))
                except Exception:
                    return self._send_json(400, {"error": {"message": "Invalid JSON"}})
                if not isinstance(body, dict):
                    return self._send_json(400, {"error": {"message": "Request body must be an object"}})
                body["model"] = str(outer.pc.get("model") or body.get("model") or "")
                removed_fields = set(KNOWN_UNSUPPORTED_REQUEST_FIELDS)
                repair_count = 0
                transient_attempt = 0
                while True:
                    outbound, removed_now = _strip_request_fields(body, removed_fields)
                    removed_fields |= removed_now
                    try:
                        connection, response = outer._open_upstream(outbound)
                    except Exception as exc:
                        if transient_attempt < PROXY_MAX_RETRIES:
                            time.sleep(min(4.0, 0.6 * (2 ** transient_attempt)))
                            transient_attempt += 1
                            continue
                        return self._send_json(502, {"error": {"message": f"Provider request failed: {exc}"}})
                    status = int(response.status)
                    headers = {k: v for k, v in response.getheaders()}
                    is_stream = bool(outbound.get("stream"))
                    if status == 400 and repair_count < PROXY_MAX_400_REPAIRS:
                        error_payload = response.read()
                        try:
                            detail = json.loads(error_payload.decode("utf-8", "replace")).get("error", {}).get("message", "")
                        except Exception:
                            detail = error_payload.decode("utf-8", "replace")
                        try:
                            response.close()
                            connection.close()
                        except Exception:
                            pass
                        newly_rejected = _unsupported_fields_from_error(detail) - removed_fields
                        if newly_rejected:
                            removed_fields |= newly_rejected
                            repair_count += 1
                            continue
                        return self._send_json(400, {"error": {"message": detail or "Provider rejected the request."}})
                    if status in {429, 500, 502, 503, 504} and transient_attempt < PROXY_MAX_RETRIES:
                        retry_after = _retry_after_seconds(headers)
                        delay = retry_after or min(4.0, 0.6 * (2 ** transient_attempt))
                        try:
                            response.close()
                            connection.close()
                        except Exception:
                            pass
                        time.sleep(delay)
                        transient_attempt += 1
                        continue
                    if status >= 400:
                        payload = response.read()
                        try:
                            response.close()
                            connection.close()
                        except Exception:
                            pass
                        self.send_response(status)
                        self.send_header("Content-Type", headers.get("Content-Type", "application/json"))
                        self.send_header("Content-Length", str(len(payload)))
                        self.send_header("X-LazyDev-Provider-Proxy", "1")
                        self.send_header("Connection", "close")
                        self.end_headers()
                        self.wfile.write(payload)
                        self.close_connection = True
                        return
                    try:
                        self._relay(status, headers, response, is_stream)
                    finally:
                        try:
                            connection.close()
                        except Exception:
                            pass
                    return

        return Handler

    def upstream_url(self) -> str:
        base = normalize_url(self.pc.get("baseUrl") or self.provider.get("base") or "")
        lowered = base.lower()
        if lowered.endswith("/v1") or lowered.endswith("/openai"):
            return base + "/chat/completions"
        return base + "/v1/chat/completions"

    def _open_upstream(self, body: dict[str, Any]):
        from urllib.parse import urlsplit
        target = urlsplit(self.upstream_url())
        if target.scheme not in {"http", "https"} or not target.hostname:
            raise RuntimeError(f"Invalid provider API URL: {self.upstream_url()}")
        timeout = 120
        if target.scheme == "https":
            connection = http.client.HTTPSConnection(target.hostname, target.port or 443, timeout=timeout)
        else:
            connection = http.client.HTTPConnection(target.hostname, target.port or 80, timeout=timeout)
        headers = {
            "Accept": "text/event-stream" if body.get("stream") else "application/json",
            "Content-Type": "application/json",
            "User-Agent": f"lazydev/{VERSION}",
            "Content-Length": str(len(json.dumps(body, separators=(",", ":")).encode("utf-8"))),
        }
        key = str(self.pc.get("apiKey", "") or "")
        if key and self.provider.get("id") != "ollama":
            headers["Authorization"] = f"Bearer {key}"
        payload = json.dumps(body, separators=(",", ":")).encode("utf-8")
        path = target.path or "/"
        if target.query:
            path += "?" + target.query
        connection.request("POST", path, body=payload, headers=headers)
        return connection, connection.getresponse()



def write_kimi_files(provider: dict[str, Any], cfg: dict[str, Any], proxy: _ProviderProxy | None = None) -> tuple[Path, Path]:
    KIMI_HOME.mkdir(parents=True, exist_ok=True)
    pc = provider_config(cfg, provider["id"])
    model = str(pc.get("model", ""))
    base = normalize_url(pc.get("baseUrl") or provider["base"])
    provider_type = "anthropic" if provider["id"] == "anthropic" else "openai"
    context = model_context_size(provider, pc)
    output = model_output_size(pc)
    tool_use = model_supports_tools(pc)
    capabilities = []
    if tool_use:
        capabilities.append("tool_use")
    if provider["id"] == "gemini" and not is_antigravity_model_name(model):
        capabilities.append("thinking")
    if provider["id"] == "ollama":
        base = normalize_url(pc.get("baseUrl") or provider["base"]) + "/v1"
    elif provider["id"] == "gemini":
        base = "https://generativelanguage.googleapis.com/v1beta/openai"
    lines = [
        f"default_model = {toml_quote('lazydev/' + model)}",
        'default_permission_mode = "manual"',
        'default_plan_mode = false',
        'merge_all_available_skills = true',
        'builtin_product_skills = false',
        'telemetry = false',
        'show_thinking_stream = false',
        '',
        'database.base = true',
        'database.search = true',
        f'extra_skill_dirs = [{toml_quote(str(ROOT / "skills"))}]',
        f'extra_agent_dirs = [{toml_quote(str(ROOT / "agents"))}]',
        '',
        '[providers.lazydev]',
        f'type = {toml_quote(provider_type)}',
        f'base_url = {toml_quote(f"http://127.0.0.1:{proxy.port}/v1" if proxy else base)}',
        f'api_key = {toml_quote(proxy.token if proxy else str(pc.get("apiKey", "")))}',
        '',
        f'[models.{json.dumps("lazydev/" + model)}]',
        'provider = "lazydev"',
        f'model = {toml_quote(model)}',
        f'max_context_size = {context}',
        f'max_input_size = {max(1024, context - min(output, max(256, context // 4)))}',
        f'max_output_size = {min(output, max(256, context // 4))}',
        f'capabilities = {json.dumps(capabilities)}',
        f'display_name = {toml_quote(provider["label"] + " · " + model)}',
        '',
        '[thinking]',
        f'enabled = {"true" if provider["id"] == "gemini" else "false"}',
        'effort = "low"' if provider["id"] == "gemini" else '',
        '',
        '[loop_control]',
        'max_attempts_per_step = 10',
        'max_steps_per_turn = 0',
        'compaction_trigger_ratio = 0.88',
        'compaction_max_attempts = 2',
        '',
        '[mcp.client]',
        'tool_call_timeout_ms = 60000',
        '',
    ]
    lines = [line for line in lines if line is not None]
    config_path = KIMI_HOME / "config.toml"
    tui_path = KIMI_HOME / "tui.toml"
    config_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    tui_path.write_text(textwrap.dedent('''\
        theme = "dark"
        render_latex = true
        disable_paste_burst = false
        cache_expiry_hint = false
        disable_feedback_survey = true

        [upgrade]
        auto_install = false

        [notifications]
        enabled = true
        notification_condition = "unfocused"

        [status_line]
        items = ["mode", "model", "tasks", "cwd", "git", "tips"]
    ''').strip() + "\n", encoding="utf-8")
    write_runtime_system(provider, model)
    return config_path, tui_path


def write_runtime_system(provider: dict[str, Any], model: str) -> None:
    system_source = ROOT / "runtime" / "SYSTEM.md"
    base = system_source.read_text(encoding="utf-8") if system_source.is_file() else ""
    additions = [
        "## LazyDev Native CLI Runtime",
        "- Keep simple requests simple; avoid unrelated files, abstractions, and prose.",
        "- Inspect before changing and verify the smallest meaningful result before claiming completion.",
        "- Use bundled LazyDev skills when materially relevant.",
        f"- Active provider: {provider['label']}; model: {model}.",
        f"- Standalone artifacts must be written under {ARTIFACT_DIR}.",
    ]
    (KIMI_HOME / "SYSTEM.md").write_text(base.rstrip() + "\n\n" + "\n".join(additions) + "\n", encoding="utf-8")


def chat(sessions: bool = False, continue_session: bool = False) -> int:
    clear_terminal()
    kimi = find_kimi()
    if not kimi:
        print("Kimi Code launcher not found. Install Kimi Code 2.0.0 with the LazyDev installer.", file=sys.stderr)
        return 1
    cfg = read_config()
    provider = active_provider(cfg)
    pc = provider_config(cfg, provider["id"])
    if not pc.get("model"):
        print("No active provider is configured. Run: lazydev setup", file=sys.stderr)
        return 1
    proxy = None
    if provider["id"] != "anthropic":
        proxy = _ProviderProxy(provider, pc)
    try:
        write_kimi_files(provider, cfg, proxy)
    except Exception:
        proxy and proxy.close()
        raise
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    args = ["--add-dir", str(ARTIFACT_DIR)]
    if sessions:
        args.append("--session")
    elif continue_session:
        args.append("--continue")
    else:
        args += ["--agent", "default"]
    env = os.environ.copy()
    env["KIMI_CODE_HOME"] = str(KIMI_HOME)
    env["KIMI_LOOP_MAX_STEPS_PER_TURN"] = "0"
    env["LAZYDEV_ARTIFACT_DIR"] = str(ARTIFACT_DIR)
    env["LAZYDEV_VERSION"] = VERSION
    env["LAZYDEV_MODEL"] = str(pc.get("model"))
    for name in list(env):
        if name.startswith("KIMI_MODEL_"):
            env.pop(name, None)
    try:
        return subprocess.call([kimi, *args], cwd=os.getcwd(), env=env)
    except KeyboardInterrupt:
        return 130
    finally:
        if proxy is not None:
            proxy.close()


def detect_languages(cwd: Path) -> list[dict[str, Any]]:
    ts = (cwd / "tsconfig.json").exists() or any(cwd.rglob("*.ts")) or any(cwd.rglob("*.tsx"))
    go = (cwd / "go.mod").exists() or (cwd / "go.work").exists() or any(cwd.rglob("*.go"))
    result = []
    if ts:
        evidence = [name for name in ("tsconfig.json", "*.ts", "*.tsx") if (cwd / name).exists()] if (cwd / "tsconfig.json").exists() else ["TypeScript source"]
        result.append({"id": "typescript", "confidence": 0.98 if (cwd / "tsconfig.json").exists() else 0.84, "evidence": evidence})
    if go:
        evidence = [x for x in ("go.mod", "go.work") if (cwd / x).exists()] or ["Go source"]
        result.append({"id": "go", "confidence": 0.98 if (cwd / "go.mod").exists() else 0.86, "evidence": evidence})
    return result


def language_command(cwd: Path, as_json: bool) -> int:
    detected = detect_languages(cwd)
    contracts = []
    for item in detected:
        if item["id"] == "typescript":
            commands = {"typecheck": "tsc --noEmit", "format": "prettier --check .", "test": "npm test"}
        else:
            commands = {"format": "gofmt -w .", "test": "go test ./...", "vet": "go vet ./...", "build": "go build ./..."}
        contracts.append({"id": item["id"], "commands": commands})
    report = {"cwd": str(cwd), "languages": detected, "primary": detected[0] if detected else {"id": "unknown", "confidence": 0, "evidence": []}, "contracts": contracts}
    if as_json:
        print(json.dumps(report, indent=2))
        return 0
    title("LazyDev language systems")
    print(f"Workspace     {cwd}")
    print(f"Primary       {report['primary']['id']}")
    for item in detected:
        print(f"◆ {item['id']} · {item['confidence'] * 100:.0f}% · evidence: {', '.join(item['evidence'])}")
    for contract in contracts:
        print(f"\n{contract['id']} checks:")
        for key, command in contract["commands"].items():
            print(f"  {key}: {command}")
    return 0


def load_design_data(name: str) -> list[dict[str, Any]]:
    return json_load(ROOT / "systems" / "ui" / "pro" / "data" / name, [])


def pick_design(items: list[dict[str, Any]], query: str, default_index: int = 0) -> dict[str, Any]:
    words = set(re.findall(r"[a-z0-9]+", query.lower()))
    best = None
    best_score = -1
    for item in items:
        hay = " ".join([str(item.get("id", "")), *map(str, item.get("aliases", [])), *map(str, item.get("keywords", [])), *map(str, item.get("bestFor", []))]).lower()
        score = sum(2 if word in str(item.get("id", "")).lower() else 1 for word in words if word in hay)
        if score > best_score:
            best, best_score = item, score
    return best or items[default_index]


def ui_command(query: str, as_json: bool = False) -> int:
    products = load_design_data("products.json")
    styles = load_design_data("styles.json")
    patterns = load_design_data("patterns.json")
    palettes = load_design_data("palettes.json")
    typography = load_design_data("typography.json")
    motion = load_design_data("motion.json")
    components = load_design_data("components.json")
    ux = load_design_data("ux.json")
    product = pick_design(products, query)
    style = next((x for x in styles if x.get("id") == product.get("style")), pick_design(styles, query))
    pattern = next((x for x in patterns if x.get("id") == product.get("pattern")), pick_design(patterns, query))
    palette = next((x for x in palettes if x.get("id") == product.get("palette")), pick_design(palettes, query))
    typeface = next((x for x in typography if x.get("id") == product.get("type")), pick_design(typography, query))
    motion_profile = min(motion, key=lambda x: abs(int(x.get("intensity", 3)) - int(product.get("motion", 3)))) if motion else {}
    component_hits = []
    q = query.lower()
    for item in components:
        if any(k.lower() in q for k in item.get("keywords", [])):
            component_hits.append(item)
    if not component_hits:
        component_hits = components[:4]
    result = {
        "query": query,
        "product": product,
        "pattern": pattern,
        "style": style,
        "palette": palette,
        "typography": typeface,
        "motion": motion_profile,
        "density": product.get("density", 6),
        "components": [{"id": x.get("id"), "rules": x.get("rules", [])[:4]} for x in component_hits[:6]],
        "uxRules": [x for x in ux[:8]],
        "antiSlop": ["card soup", "decorative gradient", "hero oversized for app workflows", "icon-only controls", "fake loading/activity states"],
    }
    if as_json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Design system · {query}\n")
        print(f"Product    {product.get('id')}")
        print(f"Pattern    {pattern.get('id')}")
        print(f"Style      {style.get('id')}")
        print(f"Palette    {palette.get('id')}")
        print(f"Typography {typeface.get('heading')} / {typeface.get('body')}")
        print(f"Density    {result['density']}/10")
        print(f"Motion     {motion_profile.get('id')}")
        print("\nUX priorities")
        for item in result["uxRules"]:
            print(f"- {item.get('rule')}")
        print("\nAvoid")
        for item in result["antiSlop"]:
            print(f"- {item}")
    return 0


def doctor() -> int:
    cfg = read_config()
    title(f"Lazy Developer doctor · {VERSION}")
    py = platform.python_version()
    print(f"Runtime       {platform.system()} · {platform.machine()} · Python {py}")
    print(f"Agent CLI     {find_kimi() or 'not detected'}")
    print(f"Skills        {len(SKILLS)} bundled")
    print(f"Artifacts     {ARTIFACT_DIR}")
    provider = active_provider(cfg)
    print(f"Provider      {provider['label']} · {provider_config(cfg, provider['id']).get('model') or 'not configured'}")
    print(f"Node.js       not used by native LazyDev CLI")
    return 0


def env_info(as_json: bool) -> int:
    cfg = read_config()
    data = {
        "version": VERSION,
        "platform": sys.platform,
        "arch": platform.machine(),
        "python": platform.python_version(),
        "node": None,
        "workspace": os.getcwd(),
        "artifactDirectory": str(ARTIFACT_DIR),
        "configDirectory": str(CONFIG_DIR),
        "kimiHome": str(KIMI_HOME),
        "skillsRoot": str(ROOT / "skills"),
        "packageRoot": str(ROOT),
        "activeProvider": active_provider(cfg)["id"],
        "nativeCliRuntime": "python",
    }
    print(json.dumps(data, indent=2) if as_json else "\n".join(f"{k}: {v}" for k, v in data.items()))
    return 0


def artifact_command(name: str | None) -> int:
    if not name:
        print(str(ARTIFACT_DIR))
        return 0
    raw = Path(name)
    if raw.is_absolute() or raw.name != name or name in {".", ".."}:
        print("Artifact filename must be a single filename.", file=sys.stderr)
        return 1
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    target = ARTIFACT_DIR / name
    if target.exists():
        stem, suffix = raw.stem, raw.suffix
        i = 1
        while (ARTIFACT_DIR / f"{stem}-{i}{suffix}").exists():
            i += 1
        target = ARTIFACT_DIR / f"{stem}-{i}{suffix}"
    print(str(target))
    return 0


def help_command() -> int:
    title(f"Lazy Developer {VERSION}")
    print("Build · debug · review · test · ship\n")
    rows = [
        ("lazydev chat", "Start the LazyDev + Kimi Code session"),
        ("lazydev setup", "Choose provider, API key, and live model"),
        ("lazydev sessions", "Open saved Kimi sessions"),
        ("lazydev skills", "Browse bundled LazyDev skills"),
        ("lazydev artifact", "Show the standalone artifact directory"),
        ("lazydev env", "Inspect the native CLI environment"),
        ("lazydev ui <brief>", "Generate a data-driven UI design system"),
        ("lazydev lang", "Detect TypeScript/Go and show coding contracts"),
        ("lazydev doctor", "Check installation and configuration"),
        ("lazydev version", "Show installed version"),
    ]
    for command, description in rows:
        print(f"  {ansi('36', command.ljust(26))} {description}")
    return 0


def list_skills() -> int:
    for name, description in SKILLS:
        print(f"{name}: {description}")
    return 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] in {"help", "--help", "-h"}:
        return help_command()
    cmd = argv[0]
    if cmd in {"version", "--version", "-v"}:
        print(VERSION)
        return 0
    if cmd == "path":
        print(ROOT)
        return 0
    if cmd == "skills":
        return list_skills()
    if cmd == "doctor":
        return doctor()
    if cmd in {"env", "info", "universal"}:
        return env_info("--json" in argv)
    if cmd in {"artifact", "artifacts"}:
        return artifact_command(argv[1] if len(argv) > 1 else None)
    if cmd in {"lang", "languages"}:
        cwd = Path(argv[argv.index("--project") + 1]).resolve() if "--project" in argv and argv.index("--project") + 1 < len(argv) else Path.cwd()
        return language_command(cwd, "--json" in argv)
    if cmd == "ui":
        parts = [x for x in argv[1:] if x not in {"--json"}]
        return ui_command(" ".join(parts).strip(), "--json" in argv)
    if cmd == "setup":
        return setup()
    if cmd == "chat":
        return chat()
    if cmd == "sessions":
        return chat(sessions=True)
    if cmd == "continue":
        return chat(continue_session=True)
    print(f"Unknown command: {cmd}", file=sys.stderr)
    return help_command() or 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

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
import io
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

VERSION = "1.0.0"
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runtime.platform_paths import platform_paths, ensure_artifact_directory
HOME = Path.home()
IS_WINDOWS = os.name == "nt"
IS_MAC = sys.platform == "darwin"
_PLATFORM_PATHS = platform_paths()
IS_TERMUX = bool(_PLATFORM_PATHS["termux"])
CONFIG_DIR = Path(_PLATFORM_PATHS["configDirectory"])
KIMI_HOME = Path(_PLATFORM_PATHS["kimiHome"])
# Standalone deliverables use one visible, predictable directory. The CLI
# intentionally owns this path rather than inheriting stale environment values
# from older LazyDev releases.
ARTIFACT_DIR = Path(_PLATFORM_PATHS["artifactDirectory"])

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
    {"id": "huggingface", "label": "Hugging Face", "kind": "openai", "models": "https://router.huggingface.co/v1/models", "base": "https://router.huggingface.co/v1", "chat": "https://router.huggingface.co/v1/chat/completions", "env": "HF_TOKEN"},
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
PROXY_MAX_RETRIES = 8
PROXY_MAX_400_REPAIRS = 4
DEFAULT_MODEL_CONTEXT = 16384
DEFAULT_MODEL_OUTPUT = 8192
CONTEXT_SAFETY_MARGIN = 1024
CONTEXT_UNKNOWN_OUTPUT_FRACTION = 0.25
CONTEXT_ABSOLUTE_OUTPUT_CAP = 32768
CONTEXT_EXTRA_MULTIPLIER = max(1.25, min(4.0, float(os.environ.get("LAZYDEV_CONTEXT_EXTRA_MULTIPLIER", "1.6") or 1.6)))
CONTEXT_FIT_RATIO = 1.0
CONTEXT_RECENT_MESSAGES = max(4, min(20, int(os.environ.get("LAZYDEV_CONTEXT_RECENT_MESSAGES", "10") or 10)))
CONTEXT_ARCHIVE_SNIPPET_CHARS = max(80, min(800, int(os.environ.get("LAZYDEV_CONTEXT_ARCHIVE_SNIPPET_CHARS", "240") or 240)))
CONTEXT_TOOL_RESULT_CHARS = max(400, min(6000, int(os.environ.get("LAZYDEV_CONTEXT_TOOL_RESULT_CHARS", "1200") or 1200)))
PROVIDER_OUTPUT_HARD_CAPS = {
    "nvidia": 32768,
    "gemini": 65536,
    "groq": 32768,
    "llm7": 32768,
    "codebuddy": 32768,
    "openrouter": 32768,
    "openai": 32768,
    "ollama": 32768,
    "anthropic": 65536,
    "huggingface": 32768,
}
MODEL_LIMIT_RULES = (
    # These rules provide numeric limits only. Tool capability is deliberately
    # never hardcoded here; it must come from live provider metadata or a
    # runtime capability probe.
    (re.compile(r"^nvidia/nemotron-3-super-120b-a12b$", re.I), 1048576, 32768, True, "none"),
    (re.compile(r"^gemini-3\.1-flash-image(?:-.+)?$", re.I), 131072, 32768, True, None),
    (re.compile(r"^gemini-3\.1-flash-lite(?:-.+)?$", re.I), 1048576, 65536, True, None),
    (re.compile(r"^gemini-3\.1-pro(?:-.+)?$", re.I), 1048576, 65536, True, None),
    (re.compile(r"^gemini-3-flash(?:-.+)?$", re.I), 1048576, 65536, True, None),
)


def _positive_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def known_model_limits(provider: dict[str, Any], model: str) -> dict[str, Any]:
    pid = str(provider.get("id", ""))
    model_id = str(model or "").strip()
    for pattern, context, output, thinking, off_effort in MODEL_LIMIT_RULES:
        if pattern.search(model_id):
            if pattern.pattern.startswith("^nvidia/") and pid != "nvidia":
                continue
            return {
                "context": context,
                "output": output,
                "toolUse": None,
                "thinking": thinking,
                "offEffort": off_effort,
                "source": "catalog-rule",
            }
    return {}


def apply_model_limits(model_info: dict[str, Any], provider: dict[str, Any], model: str) -> dict[str, Any]:
    info = dict(model_info or {})
    known = known_model_limits(provider, model)
    live_context = (_positive_int(info.get("context"))
                   or _positive_int(info.get("contextLimit"))
                   or _positive_int(info.get("context_length"))
                   or _positive_int(info.get("contextWindow"))
                   or _positive_int(info.get("context_window"))
                   or _positive_int(info.get("max_context_size"))
                   or _positive_int(info.get("inputTokenLimit"))
                   or _positive_int(info.get("inputLimit")))
    live_output = _positive_int(info.get("output")) or _positive_int(info.get("outputLimit")) or _positive_int(info.get("max_completion_tokens"))
    if live_context:
        info["context"] = live_context
        info["contextSource"] = "live"
    elif known.get("context"):
        info["context"] = known["context"]
        info["contextSource"] = known["source"]
    else:
        info["context"] = DEFAULT_MODEL_CONTEXT
        info["contextSource"] = "fallback"
    if live_output:
        info["output"] = live_output
        info["outputSource"] = "live"
    elif known.get("output"):
        info["output"] = known["output"]
        info["outputSource"] = known["source"]
    else:
        provider_cap = PROVIDER_OUTPUT_HARD_CAPS.get(str(provider.get("id")), DEFAULT_MODEL_OUTPUT)
        info["output"] = provider_cap
        info["outputSource"] = "provider-default"
    if known.get("toolUse") is not None:
        info["toolUse"] = bool(known["toolUse"])
    if known.get("offEffort"):
        info["offEffort"] = known["offEffort"]
    info["context"] = max(1024, int(info["context"]))
    output_value = min(max(256, int(info["output"])), CONTEXT_ABSOLUTE_OUTPUT_CAP)
    # Live model metadata and exact model rules are authoritative. Provider
    # defaults are only a safety fallback when the upstream catalog omits a
    # per-model output ceiling. This avoids truncating providers such as
    # Gemini models that legitimately expose larger output windows.
    if info.get("outputSource") == "provider-default":
        output_value = min(output_value, PROVIDER_OUTPUT_HARD_CAPS.get(str(provider.get("id")), 65536))
    info["output"] = output_value
    return info


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
    if not isinstance(value, dict):
        return {}
    providers_value = value.get("providers") if isinstance(value.get("providers"), dict) else {}
    known_ids = {provider["id"] for provider in PROVIDERS}
    for provider_id in list(providers_value):
        if provider_id not in known_ids:
            providers_value.pop(provider_id, None)
    value["providers"] = providers_value
    selected = value.get("activeProvider")
    if selected is not None and selected not in known_ids:
        value["activeProvider"] = "huggingface"
    return value


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


def provider_requires_api_key(provider: dict[str, Any]) -> bool:
    return provider.get("auth") != "none" and provider.get("id") != "ollama"


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
        info = {
            "id": raw,
            "name": item.get("displayName") or raw,
            "context": item.get("inputTokenLimit"),
            "output": item.get("outputTokenLimit"),
            "toolUse": None,
            "toolUseSource": "unknown",
        }
        return apply_model_limits(info, provider, raw) | {"id": raw, "name": item.get("displayName") or raw, "live": True}
    if pid == "huggingface":
        raw = str(item.get("id") or item.get("name") or item.get("model") or "").strip()
        records = item.get("providers") if isinstance(item.get("providers"), list) else []
        records = [entry for entry in records if isinstance(entry, dict)]
        live_records = [entry for entry in records if not entry.get("status") or str(entry.get("status")).lower() == "live"]
        contexts = [_positive_int(entry.get("context_length")) for entry in live_records if _positive_int(entry.get("context_length"))]
        outputs = [_positive_int(entry.get("max_completion_tokens")) or _positive_int(entry.get("max_output_tokens")) or _positive_int(entry.get("max_tokens")) for entry in live_records]
        outputs = [value for value in outputs if value]
        flags = [True if entry.get("supports_tools") is True else False if entry.get("supports_tools") is False else None for entry in live_records]
        supported = item.get("supported_parameters") if isinstance(item.get("supported_parameters"), list) else []
        tool_use = False if any(flag is False for flag in flags) else True if flags and all(flag is True for flag in flags) else (True if "tools" in supported else None)
        context = min(contexts) if contexts else _positive_int(item.get("context_length"))
        output = min(outputs) if outputs else (_positive_int(item.get("max_completion_tokens")) or _positive_int(item.get("max_output_tokens")))
        info = {
            "id": raw, "name": item.get("name") or raw, "description": str(item.get("description") or ""),
            "context": context, "output": output, "toolUse": tool_use,
            "toolUseSource": "live-provider-map" if tool_use is not None else "unknown",
            "supportedParameters": supported,
            "capabilities": item.get("capabilities") if isinstance(item.get("capabilities"), list) else [],
            "inputModalities": ((item.get("architecture") or {}).get("input_modalities") if isinstance((item.get("architecture") or {}).get("input_modalities"), list) else []),
            "outputModalities": ((item.get("architecture") or {}).get("output_modalities") if isinstance((item.get("architecture") or {}).get("output_modalities"), list) else []),
            "providers": [
                {"provider": entry.get("provider"), "status": entry.get("status"), "contextLength": _positive_int(entry.get("context_length")),
                 "maxCompletionTokens": _positive_int(entry.get("max_completion_tokens")) or _positive_int(entry.get("max_output_tokens")) or _positive_int(entry.get("max_tokens")),
                 "supportsTools": True if entry.get("supports_tools") is True else False if entry.get("supports_tools") is False else None,
                 "throughput": entry.get("throughput") if isinstance(entry.get("throughput"), (int, float)) else None,
                 "latencyMs": entry.get("first_token_latency_ms") if isinstance(entry.get("first_token_latency_ms"), (int, float)) else None,
                 "isFree": entry.get("is_free") is True}
                for entry in live_records
            ],
            "pricing": item.get("pricing") if isinstance(item.get("pricing"), dict) else {},
        }
        return apply_model_limits(info, provider, raw) | {"id": raw, "name": item.get("name") or raw, "live": True}
    if pid == "ollama":

        raw = str(item.get("name") or item.get("model") or item.get("id") or "").strip()
        info = apply_model_limits({"id": raw, "name": raw, "toolUse": None, "toolUseSource": "unknown", "local": True}, provider, raw)
        return info | {"live": True}
    raw = str(item.get("id") or item.get("name") or item.get("slug") or "").strip()
    pricing = item.get("pricing") if isinstance(item.get("pricing"), dict) else {}
    supported_present = isinstance(item.get("supported_parameters"), list)
    supported = item.get("supported_parameters") if supported_present else []
    free = pid == "openrouter" and (raw == "openrouter/free" or raw.lower().endswith(":free") or (str(pricing.get("prompt", "")) == "0" and str(pricing.get("completion", "")) == "0"))
    top_provider = item.get("top_provider") if isinstance(item.get("top_provider"), dict) else {}
    output_limit = item.get("max_completion_tokens") or top_provider.get("max_completion_tokens")
    tool_use = ("tools" in supported) if supported_present else None
    info = {"id": raw, "name": item.get("name") or raw, "toolUse": tool_use, "toolUseSource": "live" if supported_present else "unknown", "free": free, "context": item.get("context_length"), "output": output_limit}
    return apply_model_limits(info, provider, raw) | {"live": True}


def _extract_model_records(data: Any) -> list[Any]:
    if not isinstance(data, dict):
        return []
    for key in ("data", "models", "modelList", "model_list", "items"):
        value = data.get(key)
        if isinstance(value, list):
            return value
    return []


def fetch_openrouter_endpoint_limits(model_id: str, api_key: str = "") -> dict[str, Any]:
    model_id = str(model_id or "").strip()
    if not model_id or "/" not in model_id or model_id == "openrouter/free":
        return {}
    author, slug = model_id.split("/", 1)
    url = f"https://openrouter.ai/api/v1/models/{urllib.parse.quote(author, safe='')}/{urllib.parse.quote(slug, safe='')}/endpoints"
    try:
        data = request_json(url, headers={"Authorization": f"Bearer {api_key}"} if api_key else {}, timeout=10)
    except Exception:
        return {}
    payload = data.get("data") if isinstance(data, dict) else None
    endpoints = payload.get("endpoints") if isinstance(payload, dict) else None
    if not isinstance(endpoints, list) or not endpoints:
        return {}
    contexts = [_positive_int(e.get("context_length")) for e in endpoints if isinstance(e, dict)]
    outputs = [_positive_int(e.get("max_completion_tokens")) for e in endpoints if isinstance(e, dict)]
    contexts = [x for x in contexts if x]
    outputs = [x for x in outputs if x]
    result = {}
    if contexts:
        result["endpointMinContext"] = min(contexts)
        result["endpointContextSource"] = "endpoint-min"
    if outputs:
        result["output"] = min(outputs)
        result["outputSource"] = "endpoint-min"
    # The model-level capability remains separate; endpoint tool support is used
    # to determine whether native tools are safe when routing across providers.
    tool_flags = []
    for endpoint in endpoints:
        if not isinstance(endpoint, dict):
            continue
        supported = endpoint.get("supported_parameters")
        if isinstance(supported, list):
            tool_flags.append("tools" in supported)
    if tool_flags:
        result["toolUse"] = all(tool_flags)
        result["toolUseSource"] = "endpoint"
    return result


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
        if isinstance(data, list):
            raw = data
        elif isinstance(data, dict):
            raw = data.get("models", data.get("data", []))
        else:
            raw = []
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
        configured = bool(saved.get("model")) and (provider["id"] == "ollama" or not provider_requires_api_key(provider) or bool(saved.get("apiKey")))
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
    elif not provider_requires_api_key(provider):
        base = provider.get("base", "")
        key = ""
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
    info = apply_model_limits(pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}, provider, str(pc.get("model", "")))
    return max(1024, int(info.get("context") or DEFAULT_MODEL_CONTEXT))


def model_output_size(provider: dict[str, Any], pc: dict[str, Any]) -> int:
    info = apply_model_limits(pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}, provider, str(pc.get("model", "")))
    return max(256, int(info.get("output") or DEFAULT_MODEL_OUTPUT))


def _estimate_request_tokens(body: dict[str, Any]) -> int:
    """Conservative token estimate for the serialized request sent upstream."""
    try:
        payload = {k: v for k, v in body.items() if k not in {"max_tokens", "max_completion_tokens"}}
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        # JSON-over-wire / 4 is a useful baseline for mixed English/code. Bias
        # slightly upward so tiny-context providers fail less often at the edge.
        return max(1, int((len(raw) + 2) / 3.6))
    except Exception:
        return 0


def _context_limit_from_error(detail: str) -> int | None:
    text = str(detail or "")
    patterns = [
        r"maximum context length (?:is|of)\s*(\d+)",
        r"context (?:window|length)\s*(?:is|of)\s*(\d+)",
        r"max(?:imum)?_prompt_tokens\D+(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            value = _positive_int(match.group(1))
            if value:
                return value
    return None


def _output_limit_from_error(detail: str) -> int | None:
    text = str(detail or "")
    patterns = [
        r"maximum output tokens\D+(\d+)",
        r"max(?:imum)?\s*(?:completion|output)\s*tokens\D+(\d+)",
        r"max_tokens[^\d]{0,24}(?:maximum|limit|allowed)[^\d]{0,24}(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            value = _positive_int(match.group(1))
            if value:
                return value
    return None


def _request_output_cap(body: dict[str, Any], provider: dict[str, Any], pc: dict[str, Any]) -> int:
    info = apply_model_limits(pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}, provider, str(pc.get("model", "")))
    context = max(1024, int(info.get("context") or DEFAULT_MODEL_CONTEXT))
    declared_output = max(256, int(info.get("output") or DEFAULT_MODEL_OUTPUT))
    provider_cap = PROVIDER_OUTPUT_HARD_CAPS.get(str(provider.get("id")), 32768)
    model_cap = min(declared_output, provider_cap, CONTEXT_ABSOLUTE_OUTPUT_CAP)
    input_tokens = _estimate_request_tokens(body)
    remaining = max(256, context - input_tokens - CONTEXT_SAFETY_MARGIN)
    # Never let a request reserve most/all of a small context window for output.
    safe_fraction_cap = max(256, int(context * CONTEXT_UNKNOWN_OUTPUT_FRACTION))
    return max(256, min(model_cap, safe_fraction_cap, remaining))


def refresh_selected_model(config: dict[str, Any], provider: dict[str, Any], pc: dict[str, Any]) -> dict[str, Any]:
    model = str(pc.get("model", "")).strip()
    current = apply_model_limits(pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}, provider, model)
    # Older LazyDev versions stored guessed limits without a live marker. Refresh
    # those records once so stale context/output values cannot survive upgrades.
    # Capability metadata is dynamic and must not be trusted from older LazyDev
    # config snapshots. Refresh remote catalogs so a model that changed from
    # tool-capable to no-tools (or vice versa) is detected without any model-id
    # special case. Local Ollama models use the lazy runtime probe instead.
    needs_live_refresh = provider.get("id") != "ollama"
    if not needs_live_refresh:
        return current
    try:
        key = str(pc.get("apiKey", "") or "")
        base = str(pc.get("baseUrl", "") or provider.get("base", ""))
        models = fetch_models(provider, key, base)
        selected = next((item for item in models if str(item.get("id", "")).strip() == model), None)
        if selected is None:
            selected = next((item for item in models if str(item.get("id", "")).strip().lower() == model.lower()), None)
        if selected:
            canonical_model = str(selected.get("id") or model).strip()
            if canonical_model and canonical_model != model:
                model = canonical_model
                pc["model"] = canonical_model
            current = apply_model_limits(selected, provider, model)
            if provider.get("id") == "openrouter" and current.get("id") != "openrouter/free":
                endpoint_limits = fetch_openrouter_endpoint_limits(model, key)
                if endpoint_limits:
                    current = {**current, **{k: v for k, v in endpoint_limits.items() if v is not None}}
            current["live"] = True
            pc["modelInfo"] = current
            config.setdefault("providers", {})[provider["id"]] = pc
            write_config(config)
    except Exception:
        pass
    return current


def is_antigravity_model_name(model: str) -> bool:
    return bool(re.search(r"antigravity|gemini.*preview", str(model), re.I))


def native_tool_capability(pc: dict[str, Any]) -> bool | None:
    """Return native tool capability without hardcoding a model identifier."""
    info = pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}
    value = info.get("toolUse")
    if value is False:
        return False
    if value is True:
        return True
    return None


SYNTHETIC_TOOL_OPEN = "<lazydev_tool_call>"
SYNTHETIC_TOOL_CLOSE = "</lazydev_tool_call>"
SYNTHETIC_TOOL_MAX_SCHEMA_CHARS = 12000
SYNTHETIC_TOOL_MAX_RESULT_CHARS = 8000

def _tool_definitions(body: dict[str, Any]) -> list[dict[str, Any]]:
    raw = body.get("tools")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        fn = item.get("function") if isinstance(item.get("function"), dict) else item
        name = str(fn.get("name") or "").strip()
        if not name:
            continue
        out.append({
            "name": name,
            "description": str(fn.get("description") or "")[:2000],
            "parameters": fn.get("parameters") if isinstance(fn.get("parameters"), dict) else {"type": "object", "properties": {}},
        })
    return out


def _tool_path_alias(args: dict[str, Any]) -> str | None:
    for key in ("path", "file", "filepath", "file_path", "filename", "target"):
        value = args.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _canonical_tool_path(value: str) -> str:
    text = str(value or "").strip().strip('"\'')
    if not text:
        return text
    if text.startswith("file://"):
        text = urllib.parse.unquote(text[7:])
    text = os.path.expanduser(text)
    normalized = text.replace("\\", "/")
    if normalized.startswith("storage/emulated/0/"):
        normalized = "/" + normalized
    elif normalized == "storage/emulated/0":
        normalized = "/storage/emulated/0"
    artifact = str(ARTIFACT_DIR).replace("\\", "/").rstrip("/")
    if normalized == "lazydevfile":
        normalized = artifact
    elif normalized.startswith("lazydevfile/"):
        normalized = artifact + "/" + normalized[len("lazydevfile/"):]
    return normalized


def _remember_tool_path(path_hints: list[str], tool_name: str, args: dict[str, Any]) -> None:
    name = str(tool_name or "").lower()
    if name not in {"read", "readfile", "readmediafile", "write", "writefile", "edit", "strreplacefile", "grep", "notebookedit"}:
        return
    path = _tool_path_alias(args)
    if not path:
        return
    canonical = _canonical_tool_path(path)
    if canonical and canonical not in path_hints:
        path_hints.append(canonical)
    elif canonical:
        path_hints.remove(canonical)
        path_hints.append(canonical)
    del path_hints[:-12]


def _infer_recent_path(messages: list[Any], path_hints: list[str]) -> str | None:
    if path_hints:
        return path_hints[-1]
    pattern = re.compile(r"(?:/storage/emulated/0/|storage/emulated/0/|(?:^|[\\s])lazydevfile/)[^\\s<>\"']+|[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*\\.(?:html?|css|js|mjs|json|md|txt|py|ts|tsx|jsx)", re.I)
    for message in reversed(messages):
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if isinstance(content, list):
            content = "\n".join(str(block.get("text") or block.get("content") or "") for block in content if isinstance(block, dict))
        text = str(content or "")
        matches = pattern.findall(text)
        if matches:
            return _canonical_tool_path(matches[-1])
    return None


def _normalize_synthetic_call_args(name: str, args: dict[str, Any], tool_defs: list[dict[str, Any]], messages: list[Any], path_hints: list[str]) -> dict[str, Any] | None:
    normalized = dict(args or {})
    tool = next((item for item in tool_defs if item.get("name") == name), None)
    parameters = tool.get("parameters") if isinstance(tool, dict) and isinstance(tool.get("parameters"), dict) else {}
    required = parameters.get("required") if isinstance(parameters.get("required"), list) else []
    properties = parameters.get("properties") if isinstance(parameters.get("properties"), dict) else {}
    aliases = {
        "path": ("file", "filepath", "file_path", "filename", "target"),
        "content": ("text", "body", "data"),
        "pattern": ("query",),
    }
    for required_name in required:
        if required_name in normalized and normalized[required_name] not in (None, ""):
            continue
        for alias in aliases.get(required_name, ()):
            if alias in normalized and normalized[alias] not in (None, ""):
                normalized[required_name] = normalized[alias]
                break
        if required_name == "path" and required_name not in normalized:
            inferred = _infer_recent_path(messages, path_hints)
            if inferred:
                normalized[required_name] = inferred
    if "path" in normalized and isinstance(normalized["path"], str):
        normalized["path"] = _canonical_tool_path(normalized["path"])
    if re.match(r"^(read|readfile|readmediafile)$", str(name or ""), re.I) and "max_chars" in normalized:
        configured_max = max(100000, min(500000, int(os.environ.get("LAZYDEV_READ_MAX_CHARS", "500000") or 500000)))
        try:
            requested = int(normalized["max_chars"])
        except (TypeError, ValueError):
            requested = 0
        normalized["max_chars"] = min(max(100000, requested), configured_max) if requested > 0 else configured_max
    # A malformed synthetic call must never reach Kimi's strict tool validator.
    for required_name in required:
        if required_name not in normalized or normalized[required_name] in (None, ""):
            return None
    # Keep only declared properties when a schema is strict enough to expose them.
    if properties:
        known = set(properties)
        normalized = {key: value for key, value in normalized.items() if key in known}
    return normalized


def _message_content_text(message: dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                value = block.get("text") if block.get("text") is not None else block.get("content")
                if value is not None:
                    parts.append(str(value))
        return "\n".join(parts)
    if content is None:
        return ""
    try:
        return json.dumps(content, ensure_ascii=False)
    except Exception:
        return str(content)


def _compact_message_text(text: str, max_chars: int) -> str:
    text = str(text or "")
    if len(text) <= max_chars:
        return text
    head = max(80, max_chars // 2)
    tail = max(40, max_chars - head - 32)
    return text[:head].rstrip() + "\n… [LazyDev archived] …\n" + text[-tail:].lstrip()


def _estimate_messages_tokens(messages: list[Any]) -> int:
    try:
        raw = json.dumps(messages, ensure_ascii=False, separators=(",", ":"))
        return max(1, int((len(raw) + 2) / 3.6))
    except Exception:
        return 0


def _fit_messages_to_context(messages: list[Any], context: int, output_cap: int) -> tuple[list[Any], dict[str, Any]]:
    source = [dict(item) if isinstance(item, dict) else item for item in (messages or [])]
    if not source:
        return source, {"changed": False, "before": 0, "after": 0, "virtualMultiplier": CONTEXT_EXTRA_MULTIPLIER}
    physical = max(1024, int(context or DEFAULT_MODEL_CONTEXT))
    safe_output = max(256, min(int(output_cap or DEFAULT_MODEL_OUTPUT), max(256, int(physical * 0.25)), CONTEXT_ABSOLUTE_OUTPUT_CAP))
    # Keep the model's full declared context window. Only reserve space for the
    # optimized response and a small serialization margin.
    target = max(1024, physical - safe_output - 512)
    before = _estimate_messages_tokens(source)
    if before <= target:
        return source, {"changed": False, "before": before, "after": before, "virtualMultiplier": CONTEXT_EXTRA_MULTIPLIER}

    working = source
    recent_cut = max(0, len(working) - CONTEXT_RECENT_MESSAGES)
    for idx in range(recent_cut):
        msg = working[idx]
        if not isinstance(msg, dict):
            continue
        text = _message_content_text(msg)
        if not text:
            continue
        limit = CONTEXT_TOOL_RESULT_CHARS if msg.get("role") in {"tool", "function"} else max(700, CONTEXT_ARCHIVE_SNIPPET_CHARS * 3)
        compacted = _compact_message_text(text, limit)
        if compacted != text:
            msg["content"] = compacted
        if _estimate_messages_tokens(working) <= target:
            break

    if _estimate_messages_tokens(working) > target:
        recent = working[-CONTEXT_RECENT_MESSAGES:]
        older = working[:-CONTEXT_RECENT_MESSAGES]
        archive_lines = []
        for msg in older:
            if not isinstance(msg, dict):
                continue
            role = str(msg.get("role") or "message")
            text = _message_content_text(msg)
            if not text:
                continue
            paths = re.findall(r"(?:/storage/emulated/0/|storage/emulated/0/|lazydevfile/)[^\s<>\"']+", text, re.I)
            hint = f" files={', '.join(paths[-3:])}" if paths else ""
            archive_lines.append(f"[{role}]{hint} {_compact_message_text(text, CONTEXT_ARCHIVE_SNIPPET_CHARS)}")
        archive = "[LazyDev context archive — older conversation kept outside the physical model window]\n" + "\n".join(archive_lines)
        # Archive capacity scales with the physical window, while never becoming the majority of it.
        archive_chars = max(600, int(max(600, target * 3.6 * 0.18)))
        archive = _compact_message_text(archive, archive_chars)
        system_msgs = [m for m in working if isinstance(m, dict) and m.get("role") == "system"]
        candidate = system_msgs + ([{"role": "user", "content": archive}] if archive_lines else []) + recent
        working = candidate

    while _estimate_messages_tokens(working) > target:
        removable = [i for i, m in enumerate(working) if isinstance(m, dict) and m.get("role") != "system"]
        if len(removable) <= 3:
            break
        working.pop(removable[0])

    while _estimate_messages_tokens(working) > target:
        changed = False
        for idx, msg in enumerate(working):
            if not isinstance(msg, dict) or msg.get("role") == "system":
                continue
            text = _message_content_text(msg)
            if len(text) <= 240:
                continue
            msg["content"] = _compact_message_text(text, max(240, len(text) // 2))
            changed = True
            if _estimate_messages_tokens(working) <= target:
                break
        if not changed:
            break

    after = _estimate_messages_tokens(working)
    return working, {"changed": working != source, "before": before, "after": after, "virtualMultiplier": CONTEXT_EXTRA_MULTIPLIER}


def _synthetic_tool_prompt(tools: list[dict[str, Any]], max_chars: int = SYNTHETIC_TOOL_MAX_SCHEMA_CHARS) -> str:
    if not tools:
        return ""
    catalog = [{"name": t["name"], "description": t["description"], "parameters": t["parameters"]} for t in tools]
    schema = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
    max_chars = max(2048, int(max_chars))
    if len(schema) > max_chars:
        trimmed: list[dict[str, Any]] = []
        size = 2
        for item in catalog:
            encoded = json.dumps(item, ensure_ascii=False, separators=(",", ":"))
            if size + len(encoded) + 1 > max_chars:
                break
            trimmed.append(item)
            size += len(encoded) + 1
        schema = json.dumps(trimmed, ensure_ascii=False, separators=(",", ":"))
    return (
        "\n\n[LazyDev Synthetic Tool Bridge]\n"
        "Native function/tool calling is unavailable for this model, but the agent tools remain available through LazyDev. "
        "Do not say that tools are unavailable. When a tool is needed, emit exactly one or more calls with valid JSON inside "
        f"{SYNTHETIC_TOOL_OPEN} and {SYNTHETIC_TOOL_CLOSE}. The JSON must contain `name` and an object-valued `arguments`. "
        "The name must exactly match an available tool. Do not use Markdown fences around the envelope. After a tool result, continue normally. For large files, prefer bounded WriteFile/Write chunks with append mode instead of emitting the complete file in one response.\n"
        "Available tools: " + schema
    )


def _inject_synthetic_tool_prompt(messages: list[Any], prompt_text: str) -> list[Any]:
    out = [dict(m) if isinstance(m, dict) else m for m in messages]
    if not prompt_text:
        return out
    for idx, msg in enumerate(out):
        if isinstance(msg, dict) and msg.get("role") == "system":
            content = str(msg.get("content") or "")
            out[idx] = {**msg, "content": content.rstrip() + prompt_text}
            return out
    return [{"role": "system", "content": prompt_text.strip()}, *out]


def _prepare_synthetic_messages(messages: list[Any]) -> list[Any]:
    out: list[Any] = []
    call_names: dict[str, str] = {}
    for item in messages:
        if not isinstance(item, dict):
            out.append(item)
            continue
        msg = dict(item)
        role = str(msg.get("role") or "")
        if role == "assistant" and isinstance(msg.get("tool_calls"), list):
            summaries = []
            for call in msg["tool_calls"]:
                if not isinstance(call, dict):
                    continue
                call_id = str(call.get("id") or "").strip()
                fn = call.get("function") if isinstance(call.get("function"), dict) else {}
                name = str(fn.get("name") or "").strip()
                if call_id and name:
                    call_names[call_id] = name
                    summaries.append(f"{name}({str(fn.get('arguments') or '{}')[:4000]})")
            msg.pop("tool_calls", None)
            msg.pop("function_call", None)
            content = str(msg.get("content") or "").strip()
            marker = f"[LazyDev synthetic tool call executed: {'; '.join(summaries)}]" if summaries else ""
            msg["content"] = "\n".join(part for part in (content, marker) if part)
            out.append(msg)
            continue
        if role == "tool":
            call_id = str(msg.get("tool_call_id") or "").strip()
            name = call_names.get(call_id) or str(msg.get("name") or "tool")
            value = msg.get("content")
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False)
            out.append({"role": "user", "content": f"[LazyDev synthetic tool result: {name}]\n{str(value or '')[:SYNTHETIC_TOOL_MAX_RESULT_CHARS]}"})
            continue
        if role == "assistant" and isinstance(msg.get("function_call"), dict):
            fn = msg.pop("function_call")
            msg["content"] = f"[LazyDev synthetic tool call executed: {str(fn.get('name') or 'tool')}({str(fn.get('arguments') or '{}')[:4000]})]"
        out.append(msg)
    return out


def _extract_synthetic_tool_calls(content: str, tool_defs: list[dict[str, Any]], messages: list[Any] | None = None, path_hints: list[str] | None = None) -> list[dict[str, Any]]:
    text = str(content or "")
    if SYNTHETIC_TOOL_OPEN not in text:
        return []
    allowed = {tool["name"] for tool in tool_defs}
    pattern = re.compile(re.escape(SYNTHETIC_TOOL_OPEN) + r"\s*(\{.*?\})\s*" + re.escape(SYNTHETIC_TOOL_CLOSE), re.S)
    found: list[dict[str, Any]] = []
    for match in pattern.finditer(text):
        try:
            payload = json.loads(match.group(1))
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue
        name = str(payload.get("name") or "").strip()
        args = payload.get("arguments", payload.get("args"))
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = None
        if name in allowed and isinstance(args, dict):
            normalized = _normalize_synthetic_call_args(name, args, tool_defs, messages or [], path_hints or [])
            if normalized is not None:
                _remember_tool_path(path_hints if path_hints is not None else [], name, normalized)
                found.append({"name": name, "arguments": normalized})
    return found


def _synthetic_tool_completion(model: str, completion: dict[str, Any], calls: list[dict[str, Any]], stream: bool) -> tuple[dict[str, str], bytes]:
    response_id = str(completion.get("id") or f"chatcmpl-lazydev-{secrets.token_hex(6)}")
    created = int(completion.get("created") or time.time())
    entries = []
    for index, call in enumerate(calls):
        entries.append({"index": index, "id": f"call_lazydev_{secrets.token_hex(8)}", "type": "function", "function": {"name": call["name"], "arguments": json.dumps(call["arguments"], ensure_ascii=False, separators=(",", ":"))}})
    if not calls:
        content = str((((completion.get("choices") or [{}])[0].get("message") or {}).get("content")) or "")
        entries = []
        chunks = [
            {"id": response_id, "object": "chat.completion.chunk", "created": created, "model": model, "choices": [{"index": 0, "delta": {"role": "assistant", "content": content}, "finish_reason": None}]},
            {"id": response_id, "object": "chat.completion.chunk", "created": created, "model": model, "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]},
        ]
    else:
        chunks = [
            {"id": response_id, "object": "chat.completion.chunk", "created": created, "model": model, "choices": [{"index": 0, "delta": {"role": "assistant", "tool_calls": [{k: v for k, v in entry.items() if k != "index"} | {"index": entry["index"]} for entry in entries]}, "finish_reason": None}]},
            {"id": response_id, "object": "chat.completion.chunk", "created": created, "model": model, "choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}]},
        ]
    if not stream:
        message = {"role": "assistant", "content": None if calls else str((((completion.get("choices") or [{}])[0].get("message") or {}).get("content")) or "")}
        if calls:
            message["tool_calls"] = [{k: v for k, v in entry.items() if k != "index"} for entry in entries]
        payload = {"id": response_id, "object": "chat.completion", "created": created, "model": model, "choices": [{"index": 0, "message": message, "finish_reason": "tool_calls" if calls else "stop"}]}
        if isinstance(completion.get("usage"), dict):
            payload["usage"] = completion["usage"]
        return {"content-type": "application/json"}, json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    data = "".join(f"data: {json.dumps(chunk, ensure_ascii=False, separators=(',', ':'))}\n\n" for chunk in chunks) + "data: [DONE]\n\n"
    return {"content-type": "text/event-stream", "cache-control": "no-cache"}, data.encode("utf-8")


def _tool_error_is_unsupported(status: int, detail: str) -> bool:
    text = str(detail or "").lower()
    if int(status) == 404 and "no endpoints found" in text and "tool" in text:
        return True
    if int(status) not in (400, 404, 422):
        return False
    return bool(re.search(r"(?:unsupported|unknown|unrecognized|not supported|does not support|cannot|can't).*?(?:tool|function)|(?:tool|function).*?(?:unsupported|unknown|unrecognized|not supported|does not support)", text, re.I))


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


def _is_openrouter_tool_endpoint_error(status: int, detail: str) -> bool:
    if str(detail or "").strip() == "":
        return False
    text = str(detail).lower()
    return (
        str(status) == "404"
        and "no endpoints found" in text
        and "tool use" in text
    )


def _strip_tool_request_fields(body: dict[str, Any]) -> dict[str, Any]:
    cleaned = dict(body)
    for field in ("tools", "tool_choice", "parallel_tool_calls", "functions", "function_call"):
        cleaned.pop(field, None)
    return cleaned


def _looks_like_npm_error(text: str) -> bool:
    value = str(text or "")
    return bool(re.search(r"(?:npm\s+(?:ERR!|error)|ERR_NPM|ERESOLVE|EAI_AGAIN|ELIFECYCLE|ENOENT.*npm|command failed.*npm)", value, re.I))


def _normalize_provider_request(body: dict[str, Any], provider: dict[str, Any], pc: dict[str, Any]) -> dict[str, Any]:
    normalized, _ = _strip_request_fields(body, KNOWN_UNSUPPORTED_REQUEST_FIELDS)
    pid = str(provider.get("id", ""))
    model = str(pc.get("model", normalized.get("model", "")))
    hard_cap = PROVIDER_OUTPUT_HARD_CAPS.get(pid, 32768)
    info = apply_model_limits(pc.get("modelInfo") if isinstance(pc.get("modelInfo"), dict) else {}, provider, model)
    requested_cap = _request_output_cap(normalized, provider, pc)
    # Kimi can calculate a large remaining-context completion budget. Third-party
    # providers may have smaller context/output ceilings, so clamp the request to
    # the model's declared limit AND the space actually left in this request.
    for key in ("max_tokens", "max_completion_tokens"):
        if key in normalized:
            try:
                normalized[key] = max(1, min(int(normalized[key]), requested_cap))
            except (TypeError, ValueError):
                normalized.pop(key, None)
    if "max_tokens" not in normalized and "max_completion_tokens" not in normalized:
        normalized["max_tokens"] = requested_cap
    if pid == "openrouter":
        provider_options = normalized.get("provider")
        if not isinstance(provider_options, dict):
            provider_options = {}
        normalized["provider"] = {**provider_options, "require_parameters": False, "allow_fallbacks": True}
    if pid == "nvidia":
        # NVIDIA Nemotron 3 Super controls reasoning through chat-template kwargs,
        # not OpenAI's generic reasoning_effort field. Strip the generic field and
        # use the documented low-effort thinking mode for agent/tool requests.
        normalized.pop("reasoning_effort", None)
        normalized.pop("reasoning", None)
        extra = dict(normalized.get("extra_body")) if isinstance(normalized.get("extra_body"), dict) else {}
        kwargs = dict(extra.get("chat_template_kwargs")) if isinstance(extra.get("chat_template_kwargs"), dict) else {}
        kwargs["enable_thinking"] = True
        kwargs["low_effort"] = True
        kwargs["force_nonempty_content"] = True
        extra["chat_template_kwargs"] = kwargs
        normalized["extra_body"] = extra
    return normalized


def _stream_has_visible_output(payload: bytes) -> bool:
    text = payload.decode("utf-8", "replace")
    for raw in re.split(r"\r?\n\r?\n", text):
        data_lines = [line[5:].lstrip() for line in raw.splitlines() if line.startswith("data:")]
        if not data_lines:
            continue
        data = "\n".join(data_lines).strip()
        if not data or data == "[DONE]":
            continue
        try:
            chunk = json.loads(data)
        except Exception:
            continue
        choices = chunk.get("choices") if isinstance(chunk, dict) else None
        choice = choices[0] if isinstance(choices, list) and choices else {}
        delta = choice.get("delta") if isinstance(choice, dict) else {}
        if isinstance(delta, dict) and (delta.get("content") or delta.get("tool_calls") or delta.get("function_call")):
            return True
        message = choice.get("message") if isinstance(choice, dict) else {}
        if isinstance(message, dict) and (message.get("content") or message.get("tool_calls") or message.get("function_call")):
            return True
    return False


def _stream_finish_reason(payload: bytes) -> str:
    text = payload.decode("utf-8", "replace")
    found = ""
    for raw in re.split(r"\r?\n\r?\n", text):
        data_lines = [line[5:].lstrip() for line in raw.splitlines() if line.startswith("data:")]
        if not data_lines:
            continue
        data = "\n".join(data_lines).strip()
        if not data or data == "[DONE]":
            continue
        try:
            chunk = json.loads(data)
        except Exception:
            continue
        choices = chunk.get("choices") if isinstance(chunk, dict) else None
        choice = choices[0] if isinstance(choices, list) and choices else {}
        reason = choice.get("finish_reason") if isinstance(choice, dict) else ""
        if reason:
            found = str(reason).lower()
    return found


class _ProviderProxy:
    def __init__(self, provider: dict[str, Any], pc: dict[str, Any]):
        self.provider = provider
        self.pc = pc
        self.learned_no_tools = False
        self.path_hints: list[str] = []
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
                original_model = str(outer.pc.get("model") or body.get("model") or "")
                attempt_model = original_model
                synthetic_tools_active = (outer.learned_no_tools or native_tool_capability(outer.pc) is False) and bool(_tool_definitions(body))
                synthetic_tools_learned = outer.learned_no_tools
                downstream_stream = bool(body.get("stream"))
                body["model"] = original_model
                removed_fields = set(KNOWN_UNSUPPORTED_REQUEST_FIELDS)
                repair_count = 0
                transient_attempt = 0
                while True:
                    body["model"] = attempt_model
                    request_body = dict(body)
                    tool_defs = _tool_definitions(request_body)
                    if synthetic_tools_active and tool_defs:
                        raw_messages = request_body.get("messages") if isinstance(request_body.get("messages"), list) else []
                        prepared_messages = _prepare_synthetic_messages(raw_messages)
                        schema_budget = max(4096, min(SYNTHETIC_TOOL_MAX_SCHEMA_CHARS, int((model_context_size(outer.provider, outer.pc) * 3.6) * 0.10)))
                        request_body["messages"] = _inject_synthetic_tool_prompt(prepared_messages, _synthetic_tool_prompt(tool_defs, schema_budget))
                        request_body = _strip_tool_request_fields(request_body)
                        request_body["stream"] = False
                    physical_context = model_context_size(outer.provider, outer.pc)
                    physical_output = model_output_size(outer.provider, outer.pc)
                    request_body["messages"], fit_stats = _fit_messages_to_context(
                        request_body.get("messages") if isinstance(request_body.get("messages"), list) else [],
                        physical_context,
                        physical_output,
                    )
                    normalized_body = _normalize_provider_request(request_body, outer.provider, outer.pc)
                    normalized_body["model"] = attempt_model
                    outbound, removed_now = _strip_request_fields(normalized_body, removed_fields)
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
                    if status in {400, 404} and (status == 404 or repair_count < PROXY_MAX_400_REPAIRS):
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

                        if (not synthetic_tools_active) and _tool_error_is_unsupported(status, detail) and _tool_definitions(body):
                            outer.learned_no_tools = True
                            outer.pc.setdefault("modelInfo", {})["toolUse"] = False
                            outer.pc.setdefault("modelInfo", {})["toolUseSource"] = "probe"
                            outer.pc["toolUse"] = False
                            synthetic_tools_active = True
                            synthetic_tools_learned = True
                            transient_attempt = 0
                            continue

                        if status == 400:
                            learned_context = _context_limit_from_error(detail)
                            learned_output = _output_limit_from_error(detail)
                            learned = False
                            if learned_context:
                                current_context = _positive_int((outer.pc.get("modelInfo") or {}).get("context")) if isinstance(outer.pc.get("modelInfo"), dict) else None
                                if not current_context or learned_context < current_context:
                                    outer.pc.setdefault("modelInfo", {})["context"] = learned_context
                                    outer.pc.setdefault("modelInfo", {})["contextSource"] = "error"
                                    learned = True
                            if learned_output:
                                current_output = _positive_int((outer.pc.get("modelInfo") or {}).get("output")) if isinstance(outer.pc.get("modelInfo"), dict) else None
                                if not current_output or learned_output < current_output:
                                    outer.pc.setdefault("modelInfo", {})["output"] = learned_output
                                    outer.pc.setdefault("modelInfo", {})["outputSource"] = "error"
                                    learned = True
                            if learned and repair_count < PROXY_MAX_400_REPAIRS:
                                repair_count += 1
                                continue
                            newly_rejected = _unsupported_fields_from_error(detail) - removed_fields
                            if newly_rejected:
                                removed_fields |= newly_rejected
                                repair_count += 1
                                continue
                        return self._send_json(status, {"error": {"message": detail or "Provider rejected the request."}})
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
                        if synthetic_tools_active:
                            payload = response.read()
                            try:
                                completion = json.loads(payload.decode("utf-8", "replace"))
                            except Exception as exc:
                                return self._send_json(502, {"error": {"message": f"Synthetic tool bridge received invalid upstream JSON: {exc}"}})
                            choices = completion.get("choices") if isinstance(completion, dict) else []
                            message = choices[0].get("message") if choices and isinstance(choices[0], dict) else {}
                            content = message.get("content") if isinstance(message, dict) else ""
                            calls = _extract_synthetic_tool_calls(str(content or ""), tool_defs, request_body.get("messages", []), outer.path_hints)
                            response_headers, raw_response = _synthetic_tool_completion(attempt_model, completion if isinstance(completion, dict) else {}, calls, downstream_stream)
                            self.send_response(200)
                            for key, value in response_headers.items():
                                self.send_header(key, value)
                            self.send_header("Content-Length", str(len(raw_response)))
                            self.send_header("X-LazyDev-Synthetic-Tools", "1")
                            if synthetic_tools_learned:
                                self.send_header("X-LazyDev-Tool-Capability", "detected-unsupported")
                            self.send_header("Connection", "close")
                            self.end_headers()
                            self.wfile.write(raw_response)
                            self.close_connection = True
                            return
                        if is_stream and isinstance(outbound.get("tools"), list) and outbound.get("tools") and outer.provider.get("id") == "nvidia":
                            payload = response.read()
                            reason = _stream_finish_reason(payload)
                            visible = _stream_has_visible_output(payload)
                            if not visible and reason in {"length", "max_tokens", "truncated"} and repair_count < 1:
                                repair_count += 1
                                body = _normalize_provider_request(body, outer.provider, outer.pc)
                                extra = dict(body.get("extra_body")) if isinstance(body.get("extra_body"), dict) else {}
                                kwargs = dict(extra.get("chat_template_kwargs")) if isinstance(extra.get("chat_template_kwargs"), dict) else {}
                                kwargs["enable_thinking"] = False
                                kwargs.pop("low_effort", None)
                                kwargs["force_nonempty_content"] = True
                                extra["chat_template_kwargs"] = kwargs
                                body["extra_body"] = extra
                                try:
                                    response.close()
                                    connection.close()
                                except Exception:
                                    pass
                                continue
                            relay_headers = dict(headers)
                            self._relay(status, relay_headers, io.BytesIO(payload), is_stream)
                        else:
                            relay_headers = dict(headers)
                            self._relay(status, relay_headers, response, is_stream)
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




def _hook_command(script: Path) -> str:
    """Build a portable hook command for the active Python interpreter."""
    executable = str(Path(sys.executable).resolve())
    target = str(script.resolve())
    if IS_WINDOWS:
        return f'"{executable}" "{target}"'
    import shlex
    return f'{shlex.quote(executable)} {shlex.quote(target)}'

def write_kimi_files(provider: dict[str, Any], cfg: dict[str, Any], proxy: _ProviderProxy | None = None) -> tuple[Path, Path]:
    KIMI_HOME.mkdir(parents=True, exist_ok=True)
    pc = provider_config(cfg, provider["id"])
    model = str(pc.get("model", ""))
    base = normalize_url(pc.get("baseUrl") or provider["base"])
    provider_type = "google-genai" if provider["id"] == "gemini" else "anthropic" if provider["id"] == "anthropic" else "openai"
    context = model_context_size(provider, pc)
    output = model_output_size(provider, pc)
    output_fraction = 0.20 if context <= 8192 else 0.25 if context <= 131072 else 0.20
    safe_output = max(256, min(output, max(256, int(context * output_fraction)), CONTEXT_ABSOLUTE_OUTPUT_CAP))
    dynamic_ratio = 0.07 if context <= 16384 else 0.06 if context <= 32768 else 0.05 if context <= 65536 else 0.04
    reserve = max(768, min(int(context * 0.10), int(context * dynamic_ratio)))
    input_limit = max(1024, context - reserve)
    compaction_trigger = 0.52 if context <= 16384 else 0.60 if context <= 32768 else 0.68 if context <= 65536 else 0.76
    native_tools = native_tool_capability(pc)
    tool_use = True if proxy is not None else native_tools is not False
    capabilities = []
    if tool_use:
        capabilities.append("tool_use")
    if provider["id"] == "gemini" and not is_antigravity_model_name(model):
        capabilities.append("thinking")
    known = known_model_limits(provider, model)
    if provider["id"] == "ollama":
        base = normalize_url(pc.get("baseUrl") or provider["base"]) + "/v1"
    elif provider["id"] == "gemini":
        base = "https://generativelanguage.googleapis.com"
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
        *( [
            '',
            '[tools]',
            'disabled = ' + json.dumps([
                'Agent','AskUserQuestion','SetTodoList','Shell','ReadFile','ReadMediaFile',
                'Glob','Grep','WriteFile','StrReplaceFile','SearchWeb','FetchURL',
                'EnterPlanMode','ExitPlanMode','TaskList','TaskOutput','TaskStop','Skill',
                'mcp__*__*',
            ]),
        ] if not tool_use else [] ),
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
        f'max_input_size = {input_limit}',
        f'max_output_size = {safe_output}',
        f'capabilities = {json.dumps(capabilities)}',
        f'display_name = {toml_quote(provider["label"] + " · " + model)}',
        *( [f'off_effort = {toml_quote(known["offEffort"])}'] if known.get("offEffort") else [] ),
        '',
        '[read]',
        'default_max_chars = 100000',
        'max_chars = 500000',
        '',
        '[thinking]',
        f'enabled = {"true" if provider["id"] == "gemini" else "false"}',
        'effort = "low"' if provider["id"] == "gemini" else '',
        '',
        '[loop_control]',
        'max_attempts_per_step = 10',
        'max_steps_per_turn = 0',
        f'reserved_context_size = {reserve}',
        f'compaction_trigger_ratio = {compaction_trigger:.2f}',
        'compaction_max_attempts = 2',
        '',
        '[token_counting]',
        'strategy = "measured+estimated"',
        '',
        '[mcp.client]',
        'tool_call_timeout_ms = 60000',
        '',
        '[[hooks]]',
        'event = "UserPromptSubmit"',
        f'command = {toml_quote(_hook_command(ROOT / "hooks" / "lazydev-research-gate.py"))}',
        'timeout = 3',
        '',
        '[[hooks]]',
        'event = "UserPromptSubmit"',
        f'command = {toml_quote(_hook_command(ROOT / "hooks" / "lazydev-prompt-context.py"))}',
        'timeout = 3',
        '',
        '[[hooks]]',
        'event = "PreToolUse"',
        'matcher = "Write|WriteFile|Edit|StrReplaceFile|MultiEdit|NotebookEdit"',
        f'command = {toml_quote(_hook_command(ROOT / "hooks" / "lazydev-research-gate.py"))}',
        'timeout = 3',
        '',
        '[[hooks]]',
        'event = "PreToolUse"',
        'matcher = "Read|Glob|Grep"',
        f'command = {toml_quote(_hook_command(ROOT / "hooks" / "lazydev-fs-guard.py"))}',
        'timeout = 3',
        '',
        '[[hooks]]',
        'event = "PreToolUse"',
        'matcher = "Write|WriteFile|StrReplaceFile"',
        f'command = {toml_quote(_hook_command(ROOT / "hooks" / "lazydev-path-guard.py"))}',
        'timeout = 3',
        '',
        '[[hooks]]',
        'event = "PostToolUse"',
        'matcher = "Write|WriteFile"',
        f'command = {toml_quote(_hook_command(ROOT / "hooks" / "lazydev-artifact-router.py"))}',
        'timeout = 3',
        '',
        '[[hooks]]',
        'event = "PostToolUse"',
        'matcher = "Write|WriteFile|Edit|StrReplaceFile"',
        f'command = {toml_quote(_hook_command(ROOT / "hooks" / "lazydev-ui-audit.py"))}',
        'timeout = 3',
        '',
        '[[hooks]]',
        'event = "PostToolUse"',
        'matcher = "WebSearch|FetchURL|browser_open|search_web"',
        f'command = {toml_quote(_hook_command(ROOT / "hooks" / "lazydev-research-gate.py"))}',
        'timeout = 3',
        '',
    ]
    lines = [line for line in lines if line is not None]
    config_path = KIMI_HOME / "config.toml"
    tui_path = KIMI_HOME / "tui.toml"
    config_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    node_exe = shutil.which("node") or "node"
    if IS_WINDOWS:
        status_command = toml_quote(f'"{node_exe}" "{ROOT / "hooks" / "lazydev-statusline.mjs"}"')
    else:
        import shlex
        status_command = toml_quote(f'{shlex.quote(node_exe)} {shlex.quote(str(ROOT / "hooks" / "lazydev-statusline.mjs"))}')
    tui_text = textwrap.dedent(f'''\
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
        command = {status_command}
    ''').strip() + "\n"
    tui_path.write_text(tui_text, encoding="utf-8")
    write_runtime_system(provider, model)
    return config_path, tui_path


def write_kimi_mcp_config() -> Path:
    """Register the dependency-free Python browser/search MCP without Node.js."""
    KIMI_HOME.mkdir(parents=True, exist_ok=True)
    mcp_file = KIMI_HOME / "mcp.json"
    try:
        data = json.loads(mcp_file.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}
    servers = data.get("mcpServers")
    if not isinstance(servers, dict):
        servers = {}
    servers["lazydev-search"] = {
        "command": str(Path(sys.executable).resolve()),
        "args": [str((ROOT / "runtime" / "browser-mcp.py").resolve())],
        "cwd": str(ROOT),
        "startupTimeoutMs": 30000,
        "toolTimeoutMs": 60000,
    }
    data["mcpServers"] = servers
    temp = mcp_file.with_suffix(f".tmp-{os.getpid()}")
    temp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    temp.replace(mcp_file)
    return mcp_file


def write_runtime_system(provider: dict[str, Any], model: str) -> None:
    system_source = ROOT / "runtime" / "SYSTEM.md"
    base = system_source.read_text(encoding="utf-8") if system_source.is_file() else ""
    today = time.strftime("%Y-%m-%d")
    additions = [
        "## LazyDev Native CLI Runtime",
        "- Keep simple requests simple; avoid unrelated files, abstractions, and prose.",
        "- Inspect before changing and verify the smallest meaningful result before claiming completion.",
        "- Use bundled LazyDev skills when materially relevant.",
        f"- Current date: {today}. Treat this only as the current calendar date; never use it as a historical event year.",
        f"- Active provider: {provider['label']}; model: {model}.",
        f"- Standalone artifacts must be saved under the exact canonical directory: {ARTIFACT_DIR}.",
        f"- Local context archive: retain older history outside the physical model window; send only the fitted messages required for the current request.",
        "- File search: Glob uses path=<real directory> and pattern=<relative glob>; never put an absolute path or wildcard into pattern, and never scan OS/system roots.",
        "- Read: max_chars is optional and may be small; use the configured default for normal source files and pagination for large files. Do not emit an artificial minimum-max_chars error.",
        "- Large files: create or edit them through file tools instead of pasting the whole file into normal assistant output; split large writes into bounded chunks and use append mode when the tool supports it.",
        f"- Factual UI content: research historical/current facts, years, statistics, names, and dates before writing. For current/latest/today claims, a displayed current year must match {today[:4]}; historical years require a source.",
        "- UI images: never guess URLs. Prefer inline SVG/CSS or verified local assets; use remote images only after checking the URL. A saved standalone UI must not depend on placeholder/broken image references.",
        "- After UI writes, inspect image src/background-image URLs, check local assets exist, and recheck date-sensitive copy before finishing.",
    ]
    (KIMI_HOME / "SYSTEM.md").write_text(base.rstrip() + "\n\n" + "\n".join(additions) + "\n", encoding="utf-8")


def chat(sessions: bool = False, continue_session: bool = False) -> int:
    clear_terminal()
    kimi = find_kimi()
    if not kimi:
        print("Kimi Code launcher not found. Install Kimi Code with the LazyDev installer.", file=sys.stderr)
        return 1
    cfg = read_config()
    provider = active_provider(cfg)
    pc = dict(provider_config(cfg, provider["id"]))
    if provider.get("auth") == "none":
        pc["apiKey"] = ""
        cfg.setdefault("providers", {})[provider["id"]] = {**pc, "apiKey": ""}
        write_config(cfg)
    if not pc.get("model"):
        print("No active provider is configured. Run: lazydev setup", file=sys.stderr)
        return 1
    pc["modelInfo"] = refresh_selected_model(cfg, provider, pc)
    if pc.get("modelInfo", {}).get("toolUse") is False:
        print(f"Synthetic tool mode: {pc.get('model')} has no native tool calling; LazyDev keeps this model and bridges tools locally.")
    proxy = None
    if provider["id"] not in {"anthropic", "gemini"}:
        proxy = _ProviderProxy(provider, pc)
    try:
        write_kimi_files(provider, cfg, proxy)
        write_kimi_mcp_config()
    except Exception:
        proxy and proxy.close()
        raise
    ensure_artifact_directory()
    workspace = _workspace_for_chat()
    # Kimi Code uses the child process working directory as its workspace root.
    # Do not pass --work-dir: that flag is not supported by every standalone Kimi Code build.
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
    env["LAZYDEV_CONTEXT_DIR"] = str(HOME / ".lazydev")
    env["LAZYDEV_MODEL"] = str(pc.get("model"))
    env["LAZYDEV_CONTEXT_EXTRA_MULTIPLIER"] = str(CONTEXT_EXTRA_MULTIPLIER)
    env["LAZYDEV_TRANSIENT_RETRIES"] = str(PROXY_MAX_RETRIES)
    env["LAZYDEV_READ_MAX_CHARS"] = os.environ.get("LAZYDEV_READ_MAX_CHARS", "500000")
    env["LAZYDEV_CONTEXT_FIT_RATIO"] = str(CONTEXT_FIT_RATIO)
    env["LAZYDEV_CONTEXT_RECENT_MESSAGES"] = str(CONTEXT_RECENT_MESSAGES)
    for name in list(env):
        if name.startswith("KIMI_MODEL_"):
            env.pop(name, None)
    context = model_context_size(provider, pc)
    output = model_output_size(provider, pc)
    output_fraction = 0.20 if context <= 8192 else 0.25 if context <= 131072 else 0.20
    safe_output = max(256, min(output, max(256, int(context * output_fraction)), CONTEXT_ABSOLUTE_OUTPUT_CAP))
    env["KIMI_MODEL_MAX_CONTEXT_SIZE"] = str(context)
    env["KIMI_MODEL_MAX_COMPLETION_TOKENS"] = str(safe_output)
    env["KIMI_MODEL_MAX_TOKENS"] = str(safe_output)
    try:
        return subprocess.call([kimi, *args], cwd=str(workspace), env=env)
    except KeyboardInterrupt:
        return 130
    finally:
        if proxy is not None:
            proxy.close()



def _safe_walk_files(root: Path, suffixes: set[str], *, max_entries: int = 20000) -> set[str]:
    """Collect file suffix evidence without failing on protected directories."""
    found: set[str] = set()
    seen = 0
    try:
        root = root.resolve()
    except OSError:
        return found
    if not root.is_dir():
        return found
    for base, dirs, files in os.walk(root, topdown=True, onerror=lambda _error: None):
        # Skip common dependency/build trees to keep detection bounded and quiet.
        dirs[:] = [
            name for name in dirs
            if name not in {".git", "node_modules", "vendor", "dist", "build", ".venv", "venv", "target", ".gradle"}
        ]
        for filename in files:
            seen += 1
            suffix = Path(filename).suffix.lower()
            if suffix in suffixes:
                found.add(suffix)
            if seen >= max_entries:
                return found
    return found


def _workspace_for_chat() -> Path:
    """Return a stable writable working directory for Kimi file tools."""
    try:
        cwd = Path.cwd().resolve()
    except OSError:
        cwd = Path.home().resolve()
    return cwd if cwd.is_dir() else Path.home().resolve()

def detect_languages(cwd: Path) -> list[dict[str, Any]]:
    suffixes = _safe_walk_files(cwd, {".ts", ".tsx", ".go"})
    ts = (cwd / "tsconfig.json").is_file() or bool(suffixes & {".ts", ".tsx"})
    go = (cwd / "go.mod").is_file() or (cwd / "go.work").is_file() or ".go" in suffixes
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
    taste = {
        "integrated": True,
        "mode": "landing" if any(w in query.lower() for w in ["landing", "portfolio", "marketing", "homepage"]) else "redesign" if "redesign" in query.lower() else "product",
        "dials": {
            "designVariance": 5 if any(w in query.lower() for w in ["minimal", "clean", "calm", "editorial"]) else 9 if any(w in query.lower() for w in ["wild", "experimental", "awwwards", "creative"]) else 7,
            "motionIntensity": 8 if any(w in query.lower() for w in ["kinetic", "cinematic", "gsap"]) else 2 if "reduced motion" in query.lower() else 6,
            "visualDensity": 7 if any(w in query.lower() for w in ["dense", "dashboard", "analytics", "cockpit"]) else 3 if any(w in query.lower() for w in ["airy", "editorial", "portfolio", "premium"]) else 4,
        },
        "gates": ["brief inference", "one visual family", "anti-slop", "real states", "responsive stress", "asset verification", "pre-flight"],
    }
    three_d = any(re.search(r"\b(3d|three(?:\.js)?|webgl|webgpu|gltf|glb|shader)\b", query, re.I) for _ in [0])
    seo = bool(re.search(r"\b(seo|search engine|indexing|crawl|sitemap|robots\.txt|canonical|structured data|schema\.org|meta description)\b", query, re.I))
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
        "tasteSystem": taste,
        "3dPolicy": {"enabled": three_d, "researchRequired": three_d, "reference": "working example + current API docs before implementation"},
        "seoPolicy": {"enabled": seo, "researchRequired": seo, "checks": ["title/meta", "canonical", "semantic crawlable links", "indexability", "structured data", "sitemap/robots", "rendered HTML", "performance"]},
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
        print(f"Taste      integrated · variance {taste['dials']['designVariance']} · motion {taste['dials']['motionIntensity']} · density {taste['dials']['visualDensity']}")
        if three_d:
            print("3D         research required: working example + current API docs")
        if seo:
            print("SEO        research required: metadata + crawlability + indexability + structured data + performance")
        print("\nUX priorities")
        for item in result["uxRules"]:
            print(f"- {item.get('rule')}")
        print("\nAvoid")
        for item in result["antiSlop"]:
            print(f"- {item}")
    return 0


def seo_command(query: str, as_json: bool = False, project: Path | None = None) -> int:
    source = ''
    if project and project.exists():
        candidates = [project / 'index.html', project / 'src' / 'index.html', project / 'app' / 'page.tsx', project / 'app' / 'page.jsx']
        for candidate in candidates:
            if candidate.is_file():
                try:
                    source = candidate.read_text(encoding='utf-8', errors='ignore')
                    break
                except Exception:
                    pass
    checks = [
        ('title', bool(re.search(r'<title\b[^>]*>\s*[^<\n]+\s*</title>', source, re.I)) if source else None),
        ('meta description', bool(re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=', source, re.I)) if source else None),
        ('canonical', bool(re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=', source, re.I)) if source else None),
        ('document lang', bool(re.search(r'<html[^>]+lang=', source, re.I)) if source else None),
        ('semantic main', bool(re.search(r'<main\b', source, re.I)) if source else None),
        ('crawlable links', bool(re.search(r'<a\b[^>]+href=', source, re.I)) if source else None),
        ('image alt', bool(re.search(r'<img\b[^>]+alt=["\']', source, re.I)) if source else None),
        ('structured data', bool(re.search(r'application/ld\+json', source, re.I)) if source else None),
    ]
    result = {
        'query': query,
        'researchRequired': True,
        'project': str(project) if project else None,
        'rules': ['unique title/meta', 'single canonical intent', 'semantic crawlable links', 'explicit indexability', 'accurate structured data', 'sitemap/robots verification', 'rendered JS content', 'mobile performance'],
        'checks': [{'id': name, 'status': 'pass' if value is True else 'fail' if value is False else 'not-inspected'} for name, value in checks],
        'sources': ['Google Search Central SEO Starter Guide', 'Google Search Central JavaScript SEO Basics', 'Google Search Central sitemaps', 'Google Search Central structured data'],
    }
    if as_json:
        print(json.dumps(result, indent=2))
    else:
        title('LazyDev SEO system')
        print('Research   required before implementation')
        print('Target     crawlable, understandable, indexable when intended')
        if project:
            for item in result['checks']:
                print(f"{item['id'].ljust(20)} {item['status']}")
    return 0


def three_d_command(query: str, as_json: bool = False) -> int:
    result = {
        'query': query,
        'researchRequired': True,
        'referenceGate': ['working example', 'current official docs', 'exact library version'],
        'performanceGate': ['draw calls', 'geometry/triangles', 'DPR', 'resource disposal', 'mobile', 'reduced motion'],
        'implementationOrder': ['inspect', 'research', 'extract patterns', 'implement', 'profile', 'verify'],
    }
    if as_json:
        print(json.dumps(result, indent=2))
    else:
        title('LazyDev 3D system')
        print('Research   mandatory')
        print('Reference  working example + current API/version docs')
        print('Performance draw calls · geometry · DPR · disposal · mobile')
        print('Order      inspect → research → extract → implement → profile → verify')
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
    npm = shutil.which("npm")
    if npm:
        try:
            npm_version = subprocess.run([npm, "--version"], capture_output=True, text=True, timeout=5, check=False)
            npm_text = (npm_version.stdout or npm_version.stderr or "").strip()
            print(f"npm           {npm_text or 'detected; version unavailable'}")
            if npm_version.returncode != 0 or _looks_like_npm_error(npm_version.stderr):
                print("npm status    ERROR detected; native LazyDev does not require npm and will continue without it")
        except Exception as exc:
            print(f"npm status    ERROR detected ({exc}) · native LazyDev does not require npm")
    else:
        print("npm           not installed · native LazyDev does not require npm")
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
    ensure_artifact_directory()
    if not name:
        print(str(ARTIFACT_DIR))
        return 0
    raw = Path(name)
    if raw.is_absolute() or raw.name != name or name in {".", ".."}:
        print("Artifact filename must be a single filename.", file=sys.stderr)
        return 1
    ensure_artifact_directory()
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
        ("lazydev 3d <brief>", "Show the mandatory 3D reference/performance contract"),
        ("lazydev seo <brief>", "Show the SEO research and verification contract"),
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
    if cmd == "3d":
        parts = [x for x in argv[1:] if x not in {"--json"}]
        return three_d_command(" ".join(parts).strip(), "--json" in argv)
    if cmd == "seo":
        project = Path(argv[argv.index("--project") + 1]).resolve() if "--project" in argv and argv.index("--project") + 1 < len(argv) else None
        parts = [x for x in argv[1:] if x not in {"--json"} and x != "--project" and not ("--project" in argv and argv.index("--project") + 1 < len(argv) and x == argv[argv.index("--project") + 1])]
        return seo_command(" ".join(parts).strip(), "--json" in argv, project)
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

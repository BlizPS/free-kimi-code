#!/usr/bin/env python3
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []


def fail(msg):
    errors.append(msg)


def read(path):
    try:
        return path.read_text(encoding="utf-8")
    except Exception as exc:
        fail(f"{path}: unreadable: {exc}")
        return ""


def parse_skill(path):
    text = read(path)
    m = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    if not m:
        fail(f"{path}: malformed/missing frontmatter")
        return
    front = m.group(1)
    name = re.search(r"^name:\s*(\S+)\s*$", front, re.M)
    desc = re.search(r"^description:\s*(.+)$", front, re.M)
    version = re.search(r'^\s+version:\s+["\']1\.0\.0["\']\s*$', front, re.M)
    if not name:
        fail(f"{path}: missing name")
    else:
        n = name.group(1)
        if n != path.parent.name:
            fail(f"{path}: name/dir mismatch")
        if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?", n) or "--" in n:
            fail(f"{path}: invalid skill name")
    if not desc:
        fail(f"{path}: missing description")
    elif not 1 <= len(desc.group(1).strip()) <= 1024:
        fail(f"{path}: description length invalid")
    if not version:
        fail(f"{path}: metadata.version must be 1.0.0")


# Source skills and bundled mirrors.
source_dirs = [p for p in (ROOT / "skills").iterdir() if p.is_dir()]
mirror_roots = [
    ".agents/skills", ".claude/skills", ".codex/skills", ".cursor/skills",
    ".devin/skills", ".grok/skills", ".kiro/skills", ".opencode/skills",
    ".qoder/skills", ".github/skills", ".gemini/skills", ".blackbox/skills",
    ".agents/plugins/lazy-developer/skills", ".grok/plugins/lazy-developer/skills",
    "plugins/lazy-developer/skills",
]
for d in source_dirs:
    parse_skill(d / "SKILL.md")
    for root in mirror_roots:
        p = ROOT / root / d.name / "SKILL.md"
        if not p.is_file():
            fail(f"missing {p.relative_to(ROOT)}")
        else:
            parse_skill(p)
        ui = ROOT / root / d.name / "agents/openai.yaml"
        if not ui.is_file():
            fail(f"missing {ui.relative_to(ROOT)}")


def json_file(rel):
    p = ROOT / rel
    if not p.is_file():
        fail(f"missing {rel}")
        return None
    try:
        return json.loads(read(p))
    except Exception as exc:
        fail(f"{rel}: invalid JSON: {exc}")
        return None

root_plugin = json_file("plugin.json")
if root_plugin is not None:
    if root_plugin.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json":
        fail("plugin.json: wrong Agent Plugins 1.0 schema")
    if root_plugin.get("name") != "lazy-developer":
        fail("plugin.json: wrong name")
    if root_plugin.get("version") != "1.0.0":
        fail("plugin.json: version is not 1.0.0")
    allowed = {"$schema", "name", "version", "description", "author", "repository", "license", "keywords"}
    extra = sorted(set(root_plugin) - allowed)
    if extra:
        fail(f"plugin.json: unsupported top-level keys: {', '.join(extra)}")
    if not isinstance(root_plugin.get("author", {}).get("name"), str):
        fail("plugin.json: author.name missing")
    if not isinstance(root_plugin.get("keywords"), list) or not all(isinstance(x, str) for x in root_plugin["keywords"]):
        fail("plugin.json: keywords must be a string array")

# Codex product metadata is kept outside the portable hot path.
for p in sorted(ROOT.rglob("agents/openai.yaml")):
    text = read(p)
    skill = p.parent.parent.name
    for needle in ["display_name: \"", "short_description: \"", f'default_prompt: "Use ${skill} ', "allow_implicit_invocation: true"]:
        if needle not in text:
            fail(f"{p.relative_to(ROOT)}: missing Codex metadata signal: {needle}")

for rel in [".claude-plugin/plugin.json", ".codex-plugin/plugin.json", ".cursor-plugin/plugin.json", "plugins/lazy-developer/.claude-plugin/plugin.json", "plugins/lazy-developer/.codex-plugin/plugin.json", "plugins/lazy-developer/.cursor-plugin/plugin.json", "plugins/lazy-developer/plugin.json"]:
    data = json_file(rel)
    if data is not None:
        if data.get("name") != "lazy-developer":
            fail(f"{rel}: wrong name")
        if data.get("version") != "1.0.0":
            fail(f"{rel}: version is not 1.0.0")

oc = json_file("openclaw.plugin.json")
if oc is not None:
    if oc.get("id") != "lazy-developer" or oc.get("version") != "1.0.0":
        fail("openclaw.plugin.json: id/version mismatch")
    if oc.get("skills") != ["./skills"]:
        fail("openclaw.plugin.json: expected skills=[\"./skills\"]")

mp = json_file(".agents/plugins/marketplace.json")
cm = json_file(".claude-plugin/marketplace.json")
if cm is not None:
    if cm.get("name") != "lazy-developer-marketplace": fail("Claude marketplace: wrong name")
    if not cm.get("plugins"): fail("Claude marketplace: no plugins")
    else:
        ce=cm["plugins"][0]
        if ce.get("source") != "./plugins/lazy-developer": fail("Claude marketplace: bad source path")
        if ce.get("version") != "1.0.0": fail("Claude marketplace: version is not 1.0.0")

cu = json_file(".cursor-plugin/marketplace.json")
if cu is not None:
    if cu.get("name") != "lazy-developer-marketplace": fail("Cursor marketplace: wrong name")
    if cu.get("metadata", {}).get("pluginRoot") != "plugins": fail("Cursor marketplace: wrong pluginRoot")
    if not cu.get("plugins"): fail("Cursor marketplace: no plugins")

if mp is not None:
    entries = mp.get("plugins", [])
    if not entries:
        fail("Codex marketplace: no plugin entries")
    else:
        e = entries[0]
        if e.get("name") != "lazy-developer":
            fail("Codex marketplace: wrong plugin name")
        if e.get("source", {}).get("path") != "./plugins/lazy-developer":
            fail("Codex marketplace: bad source path")

ge = json_file("gemini-extension.json")
if ge is not None:
    if ge.get("name") != "lazy-developer" or ge.get("version") != "1.0.0":
        fail("gemini-extension.json: name/version mismatch")
    if ge.get("contextFileName") != "GEMINI.md":
        fail("gemini-extension.json: contextFileName must be GEMINI.md")
    if "skills" in ge:
        fail("gemini-extension.json: keep skill discovery in skills/; do not invent a custom skills field")

for rel in ["plugins/lazy-developer/openclaw.plugin.json"]:
    data = json_file(rel)
    if data is not None and (data.get("id") != "lazy-developer" or data.get("version") != "1.0.0"):
        fail(f"{rel}: id/version mismatch")

for forbidden in [".qoder-plugin/plugin.json"]:
    if (ROOT / forbidden).exists():
        fail(f"undocumented plugin manifest should not ship: {forbidden}")

for rel in ["README.md", "LICENSE", "AGENTS.md", "CLAUDE.md", "GEMINI.md", "SECURITY.md", "CONTRIBUTING.md", "COMPATIBILITY.md", "SUPPORT.md", ".gitignore", ".github/copilot-instructions.md", "scripts/doctor.py", "scripts/compat_smoke.py"]:
    if not (ROOT / rel).is_file():
        fail(f"missing {rel}")

readme = read(ROOT / "README.md")
for target in re.findall(r"\]\(([^)]+)\)", readme):
    if target.startswith(("http://", "https://", "#", "mailto:")):
        continue
    target = target.split("#", 1)[0]
    if target and not (ROOT / target).exists():
        fail(f"README link target missing: {target}")

# Detect accidental version drift in JSON manifests that explicitly declare one.
for p in ROOT.rglob("*.json"):
    if ".git" in p.parts:
        continue
    try:
        data = json.loads(read(p))
    except Exception:
        continue
    if isinstance(data, dict) and "version" in data and data["version"] != "1.0.0":
        fail(f"{p.relative_to(ROOT)}: version drift ({data['version']!r})")

# Catch obvious embedded credentials.
secret_re = re.compile(r'''(?i)(api[_-]?key|secret|private[_-]?key|access[_-]?token)\s*[:=]\s*[\"'][^\"']{16,}[\"']''')
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts:
        continue
    if p.suffix.lower() not in {".md", ".mdc", ".json", ".yml", ".yaml", ".py", ".toml", ".txt"}:
        continue
    if secret_re.search(read(p)):
        fail(f"possible secret-like literal in {p.relative_to(ROOT)}")

if errors:
    print("\n".join("ERROR: " + e for e in errors))
    raise SystemExit(1)
print("PASS: package structure, frontmatter, mirrors, manifests, docs, and secret scan")

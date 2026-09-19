#!/usr/bin/env python3
"""Validate the unified GitHub source package."""
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[1]
errors = []

def load(rel):
    p = ROOT / rel
    if not p.is_file():
        errors.append(f"missing {rel}")
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        errors.append(f"invalid JSON {rel}: {e}")
        return None

rp = load("plugin.json")

# Keep the npm executable outside the plugin root's reserved `bin/` directory.
# Claude hosted plugin archives reject top-level bin/ executables, while npm
# supports any relative executable path declared through package.json.
package_data = load("package.json")
if (ROOT / "bin").exists():
    errors.append("top-level bin/ directory is not allowed; keep the npm launcher under cli/")
if package_data:
    if package_data.get("bin", {}).get("lazydev") != "./cli/lazydev.py":
        errors.append("package.json lazydev bin must point to ./cli/lazydev.py")
    if "bin/" in package_data.get("files", []):
        errors.append("package.json files must not publish a top-level bin/ directory")
    if "cli/" not in package_data.get("files", []):
        errors.append("package.json files must include cli/")
allowed = {"$schema", "name", "version", "description", "author", "repository", "license", "keywords"}
if rp:
    if rp.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json":
        errors.append("root plugin.json schema mismatch")
    if rp.get("name") != "lazy-developer":
        errors.append("root plugin.json name mismatch")
    if rp.get("version") != "1.0.0":
        errors.append("root plugin.json version mismatch")
    extra = set(rp) - allowed
    if extra:
        errors.append("root plugin.json unsupported keys: " + ", ".join(sorted(extra)))

for rel in [
    ".claude-plugin/plugin.json", ".codex-plugin/plugin.json",
    ".cursor-plugin/plugin.json", ".qoder-plugin/plugin.json",
    ".github/plugin/plugin.json", ".devin-plugin/plugin.json",
]:
    d = load(rel)
    if d:
        if d.get("name") != "lazy-developer": errors.append(f"{rel}: name mismatch")
        if d.get("version") != "1.0.0": errors.append(f"{rel}: version mismatch")

for rel in ["gemini-extension.json", "openclaw.plugin.json"]:
    d = load(rel)
    if d and d.get("version") != "1.0.0": errors.append(f"{rel}: version mismatch")

for rel in [
    ".claude-plugin/marketplace.json", ".agents/plugins/marketplace.json",
    ".github/plugin/marketplace.json", ".grok-plugin/marketplace.json",
]:
    d = load(rel)
    if d and not d.get("plugins"): errors.append(f"{rel}: no plugins")

for s in ["lazy-developer", "lazy-debug", "lazy-review", "lazy-test"]:
    sp = ROOT / "skills" / s / "SKILL.md"
    if not sp.is_file():
        errors.append(f"missing skills/{s}/SKILL.md")
        continue
    t = sp.read_text(encoding="utf-8")
    for target in re.findall(r'\]\(([^)]+)\)', t):
        if target.startswith(("http://", "https://", "#", "mailto:")): continue
        q = (sp.parent / target.split("#", 1)[0]).resolve()
        if not str(q).startswith(str(sp.parent.resolve())) or not q.exists():
            errors.append(f"{sp.relative_to(ROOT)}: broken ref {target}")

for rel in [
    "package.json", "plugin.yaml", "scripts/lazydev.mjs", "scripts/intelligence_smoke.mjs", "commands/lazydev.toml",
    "README.md", "LICENSE", "AGENTS.md", "CLAUDE.md", "GEMINI.md", "install.sh", "install.ps1", "uninstall.sh", "uninstall.ps1",
    "SECURITY.md", "COMPATIBILITY.md", "assets/free-kimi-code-light.svg", "assets/free-kimi-code-dark.svg",
]:
    if not (ROOT / rel).is_file(): errors.append(f"missing {rel}")

for rel in ["runtime/SYSTEM.md", "runtime/PLUGIN-PROMPT.md", "runtime/token-policy.json",
            "runtime/platform-policy.mjs", "cli/lazydev.py", "runtime/intelligence-kernel.mjs", "hooks/lazydev-path-guard.mjs", "systems/index.mjs", "systems/token/index.mjs", "systems/token/bridge.mjs", "systems/token/manifest.json", "systems/token/adapters/index.mjs", "systems/context/working-set.mjs",
            "hooks/lazydev-prompt-context.mjs", "hooks/lazydev-shell-guard.mjs",
            "kimi.plugin.json"]:
    if not (ROOT / rel).is_file(): errors.append(f"missing {rel}")

system_prompt = (ROOT / "runtime/SYSTEM.md").read_text(encoding="utf-8")
if "${base_prompt}" not in system_prompt:
    errors.append("runtime/SYSTEM.md must preserve Kimi built-in prompt via ${base_prompt}")
plugin_prompt = (ROOT / "runtime/PLUGIN-PROMPT.md").read_text(encoding="utf-8")
if "${base_prompt}" in plugin_prompt or len(plugin_prompt.encode("utf-8")) > 32 * 1024:
    errors.append("runtime/PLUGIN-PROMPT.md must be standalone and within Kimi plugin prompt size")

for p in ROOT.rglob("*.json"):
    if ".git" in p.parts or p.name == "marketplace.json": continue
    try: d = json.loads(p.read_text(encoding="utf-8"))
    except Exception: continue
    if isinstance(d, dict) and "version" in d and d["version"] != "1.0.0":
        errors.append(f"{p.relative_to(ROOT)}: version drift {d['version']!r}")

readme = (ROOT / "README.md").read_text(encoding="utf-8")
for target in re.findall(r'\]\(([^)]+)\)', readme):
    if target.startswith(("http://", "https://", "#", "mailto:")): continue
    target = target.split("#", 1)[0]
    if target and not (ROOT / target).exists(): errors.append(f"README link missing: {target}")

for rel in [
    ".agents/skills", ".claude/skills", ".codex/skills", ".cursor/skills",
    ".devin/skills", ".grok/skills", ".kiro/skills", ".opencode/skills",
    ".qoder/skills", ".github/skills", ".gemini/skills", ".blackbox/skills",
    "plugins/lazy-developer",
]:
    if (ROOT / rel).exists(): errors.append(f"duplicated vendor skill tree remains: {rel}")

secret_re = re.compile(r'''(?i)(api[_-]?key|secret|private[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"']{24,}["']''')
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts: continue
    if p.suffix.lower() not in {".md", ".json", ".yml", ".yaml", ".py", ".toml", ".mjs", ".js", ".txt"}: continue
    if secret_re.search(p.read_text(encoding="utf-8", errors="ignore")):
        errors.append(f"possible secret-like literal: {p.relative_to(ROOT)}")

if errors:
    print("FAIL")
    print("\n".join("ERROR: " + x for x in errors))
    raise SystemExit(1)
print("PASS: unified source structure, manifests, references, README links, versions, and secret scan")

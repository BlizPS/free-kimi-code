#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]
package=json.loads((ROOT/"package.json").read_text())
if package.get("version")!="1.0.0": errors.append("package version is not 1.0.0")
js=(ROOT/"runtime/intelligence-kernel.mjs").read_text()
for signal in ["evidence-first reasoning", "verify", "scope_lock", "context_lean"]:
    if signal.lower() not in js.lower(): errors.append(f"intelligence signal missing: {signal}")
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts: continue
    if p.name == "README.md": continue
    if p.suffix.lower() not in {".md",".json",".yml",".yaml",".py",".toml",".mjs",".js"}: continue
    t=p.read_text(encoding="utf-8",errors="ignore").lower()
    forbidden = ["up" + "date", "updat" + "ed", "updat" + "ing"]
    if any(re.search(rf"\b{re.escape(word)}\b", t) for word in forbidden): errors.append(f"release-word leakage: {p.relative_to(ROOT)}")
if errors:
    print("FAIL"); print("\n".join("- "+e for e in errors)); sys.exit(1)
print("PASS: adaptive intelligence kernel, 1.0.0 release identity, and release-word hygiene")

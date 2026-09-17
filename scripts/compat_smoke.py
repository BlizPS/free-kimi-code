#!/usr/bin/env python3
"""Package-level compatibility smoke test; validates loader-visible files without launching agent CLIs."""
from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
SKILLS=["lazy-developer","lazy-debug","lazy-review","lazy-test"]
errors=[]

def load(rel):
    p=ROOT/rel
    if not p.is_file(): errors.append(f"missing: {rel}"); return None
    try: return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e: errors.append(f"invalid JSON {rel}: {e}"); return None

def must_dir(rel):
    if not (ROOT/rel).is_dir(): errors.append(f"missing dir: {rel}")

# Portable Agent Skills loader.
for s in SKILLS:
    must_dir(f"skills/{s}")
    if not (ROOT/f"skills/{s}/SKILL.md").is_file(): errors.append(f"missing skill: skills/{s}/SKILL.md")

# Native project loaders.
for surface in [".agents/skills",".claude/skills",".codex/skills",".cursor/skills",".devin/skills",".grok/skills",".kiro/skills",".opencode/skills",".qoder/skills",".github/skills",".gemini/skills",".blackbox/skills"]:
    for s in SKILLS: must_dir(f"{surface}/{s}")

# Claude marketplace -> plugin -> skills.
cm=load('.claude-plugin/marketplace.json')
if cm and cm.get('plugins'):
    src=ROOT/cm['plugins'][0]['source']
    if not src.is_dir(): errors.append('Claude marketplace source directory missing')
    if not (src/'.claude-plugin/plugin.json').is_file(): errors.append('Claude plugin manifest missing inside plugin package')
    for s in SKILLS:
        if not (src/'skills'/s/'SKILL.md').is_file(): errors.append(f'Claude plugin missing skill: {s}')

# Codex marketplace -> plugin -> skills.
mp=load('.agents/plugins/marketplace.json')
if mp and mp.get('plugins'):
    raw=mp['plugins'][0].get('source',{}).get('path','')
    src=(ROOT/raw).resolve()
    if not src.is_dir(): errors.append('Codex marketplace source directory missing')
    if not (src/'.codex-plugin/plugin.json').is_file(): errors.append('Codex plugin manifest missing inside plugin package')

# Cursor marketplace -> plugin -> skills.
cu=load('.cursor-plugin/marketplace.json')
if cu and cu.get('plugins'):
    src=ROOT/'plugins'/cu['plugins'][0]['source']
    if not src.is_dir(): errors.append('Cursor marketplace source directory missing')
    if not (src/'.cursor-plugin/plugin.json').is_file(): errors.append('Cursor plugin manifest missing inside plugin package')

# Gemini extension: manifest + declared context file + standard skills directory.
ge=load('gemini-extension.json')
if ge:
    if ge.get('name')!='lazy-developer' or ge.get('version')!='1.0.0': errors.append('Gemini extension name/version mismatch')
    if ge.get('contextFileName')!='GEMINI.md': errors.append('Gemini contextFileName mismatch')
    if not (ROOT/'GEMINI.md').is_file(): errors.append('Gemini context file missing')

# OpenClaw plugin package surface.
oc=load('openclaw.plugin.json')
if oc:
    if oc.get('id')!='lazy-developer' or oc.get('version')!='1.0.0': errors.append('OpenClaw id/version mismatch')
    if oc.get('skills')!=['./skills']: errors.append('OpenClaw skill path mismatch')

# Version invariant across all explicit version fields.
for p in ROOT.rglob('*.json'):
    if '.git' in p.parts: continue
    try: d=json.loads(p.read_text(encoding='utf-8'))
    except: continue
    if isinstance(d,dict) and 'version' in d and d['version']!='1.0.0': errors.append(f"version drift: {p}")

# Security/package hygiene: no symlink escapes, no hidden bidi controls.
for p in ROOT.rglob('*'):
    if '.git' in p.parts: continue
    if p.is_symlink(): errors.append(f'symlink not allowed in release: {p}')
    if p.is_file() and p.suffix.lower() in {'.md','.json','.yml','.yaml','.py','.toml','.txt','.js','.ts'}:
        text=p.read_text(encoding='utf-8', errors='strict')
        if any(0x202A<=ord(c)<=0x202E or 0x2066<=ord(c)<=0x2069 or ord(c)==0x200B for c in text):
            errors.append(f'hidden unicode control: {p}')

if errors:
    print('FAIL')
    print('\n'.join('- '+e for e in errors)); sys.exit(1)
print(f'PASS: simulated loaders for {len(SKILLS)} skills, Claude/Codex/Cursor/Gemini/Blackbox/OpenCode/Qoder/Kiro/OpenClaw surfaces')

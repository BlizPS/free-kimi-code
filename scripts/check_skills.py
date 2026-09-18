#!/usr/bin/env python3
"""Validate canonical Agent Skills using the current SKILL.md frontmatter shape."""
from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1]; SOURCE=ROOT/"skills"; errors=[]
for d in sorted(p for p in SOURCE.iterdir() if p.is_dir()):
    p=d/"SKILL.md"; name=d.name
    if not p.is_file(): errors.append(f"missing source skill: {p.relative_to(ROOT)}"); continue
    t=p.read_text(encoding="utf-8")
    m=re.match(r"\A---\n(.*?)\n---\n",t,re.S)
    if not m: errors.append(f"{name}: invalid frontmatter"); continue
    block=m.group(1)
    nm=re.search(r"^name:\s*(.+)$",block,re.M)
    desc=re.search(r"^description:\s*(.+)$",block,re.M)
    if not nm or nm.group(1).strip()!=name: errors.append(f"{name}: invalid name")
    if not desc or not desc.group(1).strip(): errors.append(f"{name}: missing description")
    if len(t)<400: errors.append(f"{name}: suspiciously small skill")
    if 'version: "1.0.0"' not in t: errors.append(f"{name}: missing version 1.0.0")
    if not (d/"agents/openai.yaml").is_file(): errors.append(f"{name}: missing agents/openai.yaml")
    for target in re.findall(r'\]\(([^)]+)\)',t):
        if target.startswith(("http://","https://","#","mailto:")): continue
        q=(p.parent/target.split('#',1)[0]).resolve()
        if not str(q).startswith(str(p.parent.resolve())) or not q.exists(): errors.append(f"{name}: broken ref {target}")
if errors: print('\n'.join(errors)); sys.exit(1)
print('PASS: canonical skills, frontmatter, references, and metadata are valid')

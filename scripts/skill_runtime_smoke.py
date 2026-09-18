#!/usr/bin/env python3
from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
text=(ROOT/'scripts/lazydev.mjs').read_text(encoding='utf-8')
errors=[]
if "merge_all_available_skills = true" not in text: errors.append('merge_all_available_skills is not enabled')
if 'extra_skill_dirs = [' not in text or "path.join(root, 'skills')" not in text: errors.append('bundled skills directory is not configured as extra_skill_dirs')
for skill in ['lazy-developer','lazy-debug','lazy-review','lazy-test']:
    p=ROOT/'skills'/skill/'SKILL.md'
    if not p.is_file(): errors.append(f'missing {skill}/SKILL.md')
    else:
        body=p.read_text(encoding='utf-8')
        if not re.search(r'^---\n.*?^name:\s*'+re.escape(skill)+r'\s*$', body, re.S|re.M): errors.append(f'{skill}: invalid name frontmatter')
print('Skill runtime smoke')
if errors:
    print('FAIL')
    print('\n'.join('- '+e for e in errors))
    raise SystemExit(1)
print('PASS: Kimi Code skill discovery points to bundled skills and all four canonical SKILL.md files exist')

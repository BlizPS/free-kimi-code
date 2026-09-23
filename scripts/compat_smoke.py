#!/usr/bin/env python3
"""Static smoke test for the unified package entrypoints."""
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]; errors=[]
def load(rel):
    try: return json.loads((ROOT/rel).read_text(encoding='utf-8'))
    except Exception as e: errors.append(f'{rel}: invalid JSON: {e}'); return None
for s in ['lazy-developer','lazy-debug','lazy-review','lazy-test']:
    if not (ROOT/'skills'/s/'SKILL.md').is_file(): errors.append(f'missing skill {s}')
for rel in ['.claude-plugin/plugin.json','.codex-plugin/plugin.json','.cursor-plugin/plugin.json','.qoder-plugin/plugin.json']:
    d=load(rel)
    if d and d.get('skills')!='./skills/': errors.append(f'{rel}: skills path mismatch')
cm=load('.claude-plugin/marketplace.json')
if cm and (not cm.get('plugins') or cm['plugins'][0].get('source')!='./'): errors.append('Claude marketplace source mismatch')
gh=load('.github/plugin/plugin.json')
if gh and (gh.get('skills')!='skills/' or gh.get('commands')!='commands/'): errors.append('GitHub plugin paths mismatch')
cu=load('.cursor-plugin/plugin.json')
if cu and (cu.get('rules')!='./.cursor/rules/' or cu.get('commands')!='./commands/'): errors.append('Cursor adapter path mismatch')
kimi=load('kimi.plugin.json')
if kimi and kimi.get('systemPromptPath')!='./runtime/PLUGIN-PROMPT.md': errors.append('Kimi plugin systemPromptPath mismatch')
if kimi and kimi.get('commands')!='./commands/': errors.append('Kimi plugin commands path mismatch')
if kimi and len(kimi.get('hooks',[]))<2: errors.append('Kimi plugin hooks missing')
root=load('plugin.json')
if (ROOT/'bin').exists(): errors.append('top-level bin/ must be absent for hosted Claude plugin archives')
launcher=ROOT/'cli/lazydev.py'
if not launcher.is_file(): errors.append('native Python CLI missing at cli/lazydev.py')
else:
    text=launcher.read_text(encoding='utf-8')
    if 'python3' not in text or 'Lazy Developer native CLI' not in text: errors.append('native CLI must be a Python entrypoint')
pkg=load('package.json')
if pkg and pkg.get('bin',{}).get('lazydev')!='./cli/lazydev.py': errors.append('package.json lazydev bin target mismatch')
if root and root.get('$schema')!='https://agent-plugins.org/schemas/1.0.0/plugin.schema.json': errors.append('root Agent Plugins schema mismatch')
for p in ROOT.rglob('*'):
    if '.git' in p.parts: continue
    if p.is_symlink(): errors.append(f'symlink not allowed: {p.relative_to(ROOT)}')
    if p.is_file() and p.suffix.lower() in {'.md','.json','.yml','.yaml','.py','.toml','.js','.mjs','.ts'}:
        t=p.read_text(encoding='utf-8',errors='strict')
        if any(0x202A<=ord(c)<=0x202E or 0x2066<=ord(c)<=0x2069 or ord(c)==0x200B for c in t): errors.append(f'hidden unicode: {p.relative_to(ROOT)}')
if errors:
    print('FAIL'); print('\n'.join('- '+x for x in errors)); sys.exit(1)
print('PASS: Agent Plugins/Claude/Codex/Cursor/Qoder/Gemini/OpenClaw/OpenCode entrypoint smoke checks')

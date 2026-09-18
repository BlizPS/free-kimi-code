#!/usr/bin/env python3
"""Validate the one-package CLI + plugin layout without launching vendor agents."""
from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]; errors=[]
def need(rel):
    if not (ROOT/rel).exists(): errors.append(f'missing {rel}')
for rel in ['plugin.json','package.json','plugin.yaml','opencode.json','openclaw.plugin.json','gemini-extension.json','.claude-plugin/plugin.json','.claude-plugin/marketplace.json','.codex-plugin/plugin.json','.cursor-plugin/plugin.json','.qoder-plugin/plugin.json','.github/plugin/plugin.json','.github/plugin/marketplace.json','.agents/plugins/marketplace.json','.devin-plugin/plugin.json','.grok-plugin/marketplace.json','scripts/lazydev.mjs','scripts/intelligence_smoke.mjs','runtime/intelligence-kernel.mjs','commands/lazydev.toml','skills','assets/free-kimi-code-light.svg','assets/free-kimi-code-dark.svg','GEMINI.md','AGENTS.md','CLAUDE.md','README.md','LICENSE']:
    need(rel)
for s in ['lazy-developer','lazy-debug','lazy-review','lazy-test']:
    need(f'skills/{s}/SKILL.md'); need(f'skills/{s}/agents/openai.yaml')
for rel in ['.agents/skills','.claude/skills','.codex/skills','.cursor/skills','.devin/skills','.grok/skills','.kiro/skills','.opencode/skills','.qoder/skills','.github/skills','.gemini/skills','.blackbox/skills','plugins/lazy-developer']:
    if (ROOT/rel).exists(): errors.append(f'legacy duplicate tree: {rel}')
for p in ROOT.rglob('*.json'):
    if '.git' in p.parts: continue
    try: d=json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: errors.append(f'invalid JSON {p.relative_to(ROOT)}: {e}'); continue
    # Package/plugin version is 1.0.0; keep the Agent Plugins schema URL at its own 1.0.0 schema revision.
    if isinstance(d,dict) and isinstance(d.get('version'), str) and d['version'] != '1.0.0':
        errors.append(f'version drift {p.relative_to(ROOT)}: {d["version"]!r}')
rp=json.loads((ROOT/'plugin.json').read_text())
allowed={'$schema','name','version','description','author','repository','license','keywords'}
if rp.get('$schema')!='https://agent-plugins.org/schemas/1.0.0/plugin.schema.json': errors.append('root plugin.json missing Agent Plugins 1.0 schema')
if rp.get('name')!='lazy-developer' or rp.get('version')!='1.0.0': errors.append('root plugin.json identity/version mismatch')
extra=set(rp)-allowed
if extra: errors.append('root plugin.json unsupported keys: '+', '.join(sorted(extra)))
readme=(ROOT/'README.md').read_text(encoding='utf-8')
for target in re.findall(r'\]\(([^)]+)\)',readme):
    if target.startswith(('http://','https://','#','mailto:')): continue
    t=target.split('#',1)[0]
    if t and not (ROOT/t).exists(): errors.append(f'README link missing: {t}')
if errors:
    print('FAIL'); print('\n'.join('- '+x for x in errors)); sys.exit(1)
print('PASS: unified CLI + plugin package, versions, manifests, docs, and no mirror drift')

#!/usr/bin/env python3
"""Sync complete source skill bundles to bundled native discovery paths."""
from pathlib import Path
import argparse, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "skills"
MIRROR_ROOTS = ['.agents/skills', '.claude/skills', '.codex/skills', '.cursor/skills', '.devin/skills', '.grok/skills', '.kiro/skills', '.opencode/skills', '.qoder/skills', '.github/skills', '.gemini/skills', '.blackbox/skills', '.agents/plugins/lazy-developer/skills', '.grok/plugins/lazy-developer/skills', 'plugins/lazy-developer/skills']


def sync(check=False):
    stale=[]; changed=0
    for source_skill in sorted(p for p in SOURCE_ROOT.iterdir() if p.is_dir()):
        for root in MIRROR_ROOTS:
            target=ROOT/root/source_skill.name
            if target.exists() and not target.is_dir():
                stale.append(target.relative_to(ROOT));
                if not check: target.unlink()
            if target.exists():
                source_files={p.relative_to(source_skill) for p in source_skill.rglob('*') if p.is_file()}
                target_files={p.relative_to(target) for p in target.rglob('*') if p.is_file()}
                for rel in sorted(source_files-target_files): stale.append((target/rel).relative_to(ROOT))
                for rel in sorted(target_files-source_files): stale.append((target/rel).relative_to(ROOT))
                for rel in sorted(source_files & target_files):
                    if (source_skill/rel).read_bytes() != (target/rel).read_bytes(): stale.append((target/rel).relative_to(ROOT))
            else:
                stale.append(target.relative_to(ROOT))
            if not check:
                if target.exists(): shutil.rmtree(target)
                shutil.copytree(source_skill,target)
                changed += 1
    if check:
        if stale:
            print('Stale/missing mirrors:')
            for p in stale: print(' ',p)
            return 1
        print('PASS: complete skill mirrors are in sync')
        return 0
    print(f'Synced {changed} skill bundle(s) across {len(MIRROR_ROOTS)} surfaces.')
    return 0

if __name__ == '__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--check',action='store_true'); args=ap.parse_args()
    raise SystemExit(sync(args.check))

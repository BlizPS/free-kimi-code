from pathlib import Path

root = Path(__file__).resolve().parents[1]
install = (root / 'install.sh').read_text(encoding='utf-8')
assert 'init --agent kimi --auto-patch' in install
install_ps = (root / 'install.ps1').read_text(encoding='utf-8')
assert 'init --agent kimi --auto-patch' in install_ps
assert (root / 'runtime' / 'rtk-integration.mjs').is_file()
assert (root / '.github' / 'workflows' / 'rtk-context-audit.yml').is_file()
policy = (root / 'runtime' / 'token-policy.json').read_text(encoding='utf-8')
assert '"terminal_output_target_reduction": 0.90' in policy
assert '"compaction_trigger_ratio": 0.75' in policy
print('PASS: RTK integration audit')

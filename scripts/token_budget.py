#!/usr/bin/env python3
"""Gate source skill + runtime instruction budgets. This measures prompt payload size, not billed provider tokens."""
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"skills"
BASE=json.loads((ROOT/"tests/skill-evals.json").read_text())
POLICY=json.loads((ROOT/"runtime/token-policy.json").read_text())
def toks(s:str)->int: return len(s)//4
rows=[]; bad=[]
for p in sorted(SOURCE.glob("*/SKILL.md")):
    n=p.parent.name; t=toks(p.read_text()) ; base=BASE["baseline_by_skill"].get(n,0); frac=t/base if base else 0
    rows.append((n,t,base,frac))
    if base and frac>POLICY["max_skill_fraction"]: bad.append(f"{n}: {t}/{base}={frac:.3f} > {POLICY['max_skill_fraction']:.2f}")
system=toks((ROOT/"runtime/SYSTEM.md").read_text())
total=sum(r[1] for r in rows)
cli_hot_path=total+system
baseline=BASE["baseline_approx_tokens"]
cli_reduction=(1-cli_hot_path/baseline) if baseline else 0.0
print("LazyDev token gate")
for n,t,b,f in rows: print(f"  {n:<18} ~{t:>4} tokens  {f*100:>5.1f}% of original")
print(f"  runtime system     ~{system:>4} tokens")
print(f"  skills total       ~{total:>4} tokens")
print(f"  CLI static hotpath ~{cli_hot_path:>4} tokens")
print(f"  CLI reduction      {cli_reduction*100:>5.1f}%")
print(f"  savings floor      >= {POLICY['target_hot_path_reduction']*100:.0f}%")
print(f"  preferred target   ~ {POLICY.get('preferred_hot_path_reduction', 0.80)*100:.0f}%")
reduction=(1-total/BASE["baseline_approx_tokens"]) if BASE["baseline_approx_tokens"] else 0.0
if reduction < POLICY.get('target_hot_path_reduction', 0.75):
    bad.append(f"skills-only reduction {reduction*100:.1f}% is below floor {POLICY.get('target_hot_path_reduction', 0.75)*100:.0f}%")
if cli_hot_path > POLICY.get('max_cli_hot_path_tokens', int(baseline * 0.25)) or cli_reduction < POLICY.get('target_hot_path_reduction', 0.75):
    bad.append(f"CLI static hot-path {cli_hot_path} tokens is above the 25% budget or below the 75% savings floor")
if bad:
    print("FAIL"); print("\n".join("- "+x for x in bad)); sys.exit(1)
print("PASS: skill hot-path payload is within the configured fraction; provider billing still varies by conversation/context.")

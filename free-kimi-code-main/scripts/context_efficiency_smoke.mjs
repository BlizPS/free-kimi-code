import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const py = String.raw`
import sys
sys.path.insert(0, '.')
import cli.lazydev as ld
msgs = [{'role':'user','content':'hi'}] + [{'role':'tool','content':f'chunk-{i}\n' + 'noise\n' * 3000} for i in range(20)] + [{'role':'user','content':'continue'}]
out, stats = ld._fit_messages_to_context(msgs, 8000, 1500)
assert stats['before'] > stats['after']
assert stats['rollingPruned'] >= 1
assert stats['after'] + 1500 + 512 <= 8000
print('PASS: rolling context pruning')
`;
const root = new URL('..', import.meta.url);
execFileSync('python3', ['-c', py], { cwd: root, stdio: 'inherit' });
const policy = JSON.parse(fs.readFileSync(new URL('../runtime/token-policy.json', import.meta.url), 'utf8'));
assert.equal(policy.terminal_output_target_reduction, 0.90);
assert.equal(policy.compaction_trigger_ratio, 0.75);
console.log('PASS: policy guard');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agent = fs.readFileSync(path.join(root, 'agents', 'lazydev.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skills', 'lazy-developer', 'SKILL.md'), 'utf8');

assert.match(agent, /^name: default$/m);
assert.match(agent, /^override: true$/m);
assert.match(agent, /\$\{base_prompt\}/);
assert.match(agent, /activated or clearly relevant LazyDev Skill as execution policy/i);
assert.match(agent, /do not replace it with demos, self-tests, unrelated probes/i);
assert.match(skill, /When active, apply this Skill/i);
assert.match(skill, /task and tool decisions/i);
console.log('PASS: LazyDev default agent override and active Skill enforcement are wired');

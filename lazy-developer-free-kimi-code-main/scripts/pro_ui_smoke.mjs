import assert from 'node:assert/strict';
import { generateDesignSystem, persistDesignSystem } from '../systems/ui/pro/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateGeneratedSource } from '../systems/ui/pro/index.mjs';

const ai = generateDesignSystem('Build a polished dark AI chat coding workspace with streaming, file context, responsive side panels, keyboard shortcuts, and restrained motion.');
assert.equal(ai.resolution.product.id, 'developer-tool');
assert.equal(ai.resolution.pattern.id, 'workspace');
assert.equal(ai.stack.id, 'html-tailwind');
assert.ok(ai.matches.style.length > 0);
assert.ok(ai.matches.palette.length > 0);
assert.ok(ai.uxRules.length >= 4);
assert.match(ai.markdown, /Visual System/);
assert.match(ai.markdown, /Avoid/);
assert.match(ai.trace, /product=developer-tool/);
assert.match(ai.trace, /style=dense-console/);

const mobile = generateDesignSystem('Create a dense analytics dashboard for mobile with accessible controls and real-time metrics.', { stack: 'react-native', density: 8, motion: 3 });
assert.equal(mobile.stack.id, 'react-native');
assert.equal(mobile.resolution.density, 8);
assert.ok(mobile.resolution.flags.includes('mobile'));

const quality = evaluateGeneratedSource('<button aria-label="Open">Open</button><main class="responsive states"></main>');
assert.ok(quality.score >= 0);
assert.ok(Array.isArray(quality.checks));
console.log('pro ui intelligence smoke: PASS');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-ui-'));
try {
  const persisted = generateDesignSystem('SaaS analytics dashboard', { persist: true, outputDir: temp, projectName: 'Acme Console', page: 'billing' });
  assert.ok(persisted.persistence?.master);
  assert.ok(fs.existsSync(persisted.persistence.master));
  assert.ok(fs.existsSync(persisted.persistence.page));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

import assert from 'node:assert/strict';
import { buildTasteSystemPrompt, buildTasteTaskFrame, tasteDiagnostics } from '../ui/taste/compiler.mjs';
import { build3dSystemPrompt, build3dTaskFrame, classify3dRequest } from '../ui/3d/reference-gate.mjs';
import { buildSeoSystemPrompt, buildSeoTaskFrame, classifySeoRequest, auditSeoSource } from '../seo/analyze.mjs';

const ui = buildTasteSystemPrompt();
assert.match(ui, /anti-slop/i);
assert.match(ui, /DESIGN_VARIANCE/);
assert.match(buildTasteTaskFrame('Build a premium landing page', { maxChars: 5000 }), /Anti-Slop|BRIEF INFERENCE/i);
assert.equal(tasteDiagnostics('Build a dense analytics dashboard').visualDensity, 7);

const three = classify3dRequest('Build a Three.js product configurator');
assert.equal(three.is3d, true);
assert.equal(three.referenceRequired, true);
assert.match(build3dTaskFrame('Build a 3D scene'), /research=mandatory/);
assert.match(build3dSystemPrompt(), /working reference example/i);

const seo = classifySeoRequest('Optimize the website SEO and structured data');
assert.equal(seo.isSeo, true);
assert.equal(seo.researchFirst, true);
assert.match(buildSeoTaskFrame('Improve SEO'), /research=mandatory/);
const audit = auditSeoSource('<html lang="en"><head><title>Home</title><meta name="description" content="Site"></head><body><main><a href="/about">About</a><img alt="Hero"></main></body></html>');
assert.ok(audit.score >= 50);
console.log('PASS: Taste, 3D research gate, and SEO system are wired as built-in domain systems');

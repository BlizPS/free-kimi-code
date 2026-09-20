import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(ROOT, 'taste-core.md');
let cached = null;

function source() {
  if (cached !== null) return cached;
  try { cached = fs.readFileSync(SOURCE, 'utf8'); }
  catch { cached = ''; }
  return cached;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[`*_']/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

function sections() {
  const text = source();
  const matches = [...text.matchAll(/^(#{1,3})\s+(.+)$/gm)];
  const out = new Map();
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const level = match[1].length;
    const title = match[2].trim();
    const start = match.index;
    const next = matches[i + 1];
    const end = next ? next.index : text.length;
    const key = slug(title);
    if (!out.has(key)) out.set(key, text.slice(start, end).trim());
    if (level === 2) {
      const number = title.match(/^(\d+(?:\.\d+)*)\./)?.[1] || title.match(/^(\d+(?:\.\d+)*)\b/)?.[1];
      if (number) out.set(`section-${number}`, text.slice(start, end).trim());
    }
  }
  return out;
}

const ALWAYS = Object.freeze([
  'section-0',
  'section-1',
  'section-2',
  'section-3',
  'section-4',
  'section-6',
  'section-9',
  'section-11',
  'section-14',
]);
const MODES = Object.freeze({
  landing: ['section-0','section-1','section-2','section-3','section-4','section-5','section-6','section-9','section-10','section-14'],
  redesign: ['section-0','section-2','section-4','section-9','section-11','section-14'],
  image: ['section-0','section-1','section-2','section-4','section-8','section-9','section-14'],
  product: ['section-0','section-1','section-2','section-3','section-4','section-6','section-9','section-14'],
});

function inferMode(prompt = '') {
  const t = String(prompt).toLowerCase();
  if (/\b(redesign|refresh|modernize|modernise|existing ui|existing site)\b/.test(t)) return 'redesign';
  if (/\b(image.?to.?code|screenshot|reference image|mockup|visual reference)\b/.test(t)) return 'image';
  if (/\b(landing|portfolio|marketing|homepage|campaign|hero)\b/.test(t)) return 'landing';
  return 'product';
}

function trimBlock(text, maxChars) {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}\n[progressive-disclosure: additional Taste rules remain bundled in systems/ui/taste/taste-core.md]`;
}

export function loadTasteSource() {
  return source();
}

export function buildTasteTaskFrame(prompt = '', options = {}) {
  const text = String(prompt || '');
  if (!text.trim()) return '';
  const mode = options.mode || inferMode(text);
  const map = sections();
  const keys = options.sections || MODES[mode] || ALWAYS;
  const selected = [];
  const seen = new Set();
  for (const key of keys) {
    const block = map.get(key);
    if (!block || seen.has(block)) continue;
    seen.add(block);
    selected.push(block);
  }
  const maxChars = Number(options.maxChars) || (options.deep ? 24000 : 12000);
  const joined = selected.join('\n\n');
  return trimBlock(joined, maxChars);
}

export function buildTasteSystemPrompt() {
  return [
    '## LazyDev Taste System',
    'Taste is integrated into LazyDev as execution policy, not a separate Skill. The full licensed core is bundled at systems/ui/taste/taste-core.md; load only the relevant sections when deeper detail is needed.',
    'Before frontend implementation, infer page kind, audience, vibe, reference signals, existing brand assets, and hard constraints. Then set DESIGN_VARIANCE, MOTION_INTENSITY, and VISUAL_DENSITY from the brief instead of using a generic default.',
    'Use one coherent visual family. Prefer an official design system when the brief clearly maps to one; do not recreate official tokens by hand. Otherwise use native CSS, Tailwind, or a maintained component foundation honestly.',
    'Anti-slop is a hard quality gate: reject generic card grids, pill-everything, AI-gradient decoration, stacked glass, fake controls/data, decorative icon piles, filler copy, oversized heroes, repeated section templates, and fabricated assets unless the product context justifies them.',
    'Build structure and state before decoration. Preserve existing identity in redesigns, audit first, and never silently change URLs, navigation labels, form field names/order, logos, analytics hooks, or legal text.',
    'Motion must have a job, be isolated from competing animation systems, prefer transform/opacity, support reduced motion, and be verified on narrow, medium, and wide viewports.',
    'Visual assets must be real and verified. Never guess URLs. For image-first work, generate/analyze section-specific references when an image tool is available, then translate the observed design language instead of using a generic template.',
    'Run the Taste pre-flight before shipping: hierarchy, typography, spacing, content, responsive behavior, accessibility, motion, asset integrity, performance, and AI-tell checks.',
  ].join('\n');
}

export function tasteDiagnostics(prompt = '') {
  const t = String(prompt).toLowerCase();
  const mode = inferMode(t);
  const variance = /\b(minimal|clean|calm|editorial|linear)\b/.test(t) ? 5 : /\b(wild|experimental|awwwards|creative|crazy)\b/.test(t) ? 9 : 7;
  const motion = /\b(static|calm|reduced motion)\b/.test(t) ? 2 : /\b(kinetic|cinematic|dynamic|gsap|physics)\b/.test(t) ? 8 : 6;
  const density = /\b(dense|dashboard|analytics|cockpit)\b/.test(t) ? 7 : /\b(airy|editorial|portfolio|premium)\b/.test(t) ? 3 : 4;
  return { mode, designVariance: variance, motionIntensity: motion, visualDensity: density, source: path.relative(process.cwd(), SOURCE) };
}

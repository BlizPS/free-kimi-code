import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.next', 'coverage', '.cache']);

function exists(file) {
  try { return fs.existsSync(file); } catch { return false; }
}

function readDirSafe(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

export function detectLanguages(cwd = process.cwd()) {
  const root = path.resolve(cwd);
  const found = new Map();
  const add = (id, confidence, evidence) => {
    const current = found.get(id);
    if (!current || confidence > current.confidence) found.set(id, { id, confidence, evidence: [...new Set(evidence)] });
    else current.evidence = [...new Set([...current.evidence, ...evidence])];
  };

  if (exists(path.join(root, 'tsconfig.json')) || exists(path.join(root, 'tsconfig.base.json'))) add('typescript', 1, ['tsconfig']);
  if (exists(path.join(root, 'go.mod'))) add('go', 1, ['go.mod']);
  if (exists(path.join(root, 'go.work'))) add('go', 1, ['go.work']);

  const stack = [{ dir: root, depth: 0 }];
  let inspected = 0;
  while (stack.length && inspected < 12000) {
    const { dir, depth } = stack.pop();
    for (const entry of readDirSafe(dir)) {
      if (entry.name.startsWith('.') && entry.name !== '.eslintrc') continue;
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name) && depth < 5) stack.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      inspected += 1;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.ts' || ext === '.tsx' || entry.name === 'tsconfig.json' || entry.name === 'tsconfig.base.json') add('typescript', 0.78, [entry.name]);
      if (ext === '.go') add('go', 0.82, [entry.name]);
      if (inspected >= 12000) break;
    }
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}

export function detectPrimaryLanguage(cwd = process.cwd()) {
  return detectLanguages(cwd)[0] || { id: 'unknown', confidence: 0, evidence: [] };
}

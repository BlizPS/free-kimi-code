import fs from 'node:fs';
import path from 'node:path';

function splitFilename(filename) {
  const raw = path.basename(String(filename || ''));
  const ext = path.extname(raw);
  if (!ext) return { stem: raw, ext: '' };
  return { stem: raw.slice(0, -ext.length), ext };
}

const GENERIC_STEMS = new Set([
  'index', 'main', 'app', 'default', 'output', 'result', 'file', 'new',
  'untitled', 'document', 'artifact', 'generated', 'temp', 'tmp',
]);

export function isGenericArtifactName(filename) {
  const { stem } = splitFilename(path.basename(String(filename || '')));
  return GENERIC_STEMS.has(stem.trim().toLowerCase());
}

export function nextAvailableArtifactName(directory, filename) {
  const dir = path.resolve(String(directory || ''));
  const raw = path.basename(String(filename || '').trim());
  if (!raw) throw new Error('Artifact filename is required.');

  const { stem, ext } = splitFilename(raw);
  const initial = path.join(dir, raw);
  if (!fs.existsSync(initial)) return raw;

  for (let index = 1; index < 1000000; index += 1) {
    const candidate = `${stem}${index}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
  }
  throw new Error(`Could not find an available filename for ${raw}.`);
}

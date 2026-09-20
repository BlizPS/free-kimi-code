import fs from 'node:fs';
import path from 'node:path';

function splitFilename(filename) {
  const raw = path.basename(String(filename || ''));
  const ext = path.extname(raw);
  if (!ext) return { stem: raw, ext: '' };
  return { stem: raw.slice(0, -ext.length), ext };
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

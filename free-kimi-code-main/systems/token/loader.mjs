import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export function tokenSystemRoot() {
  return ROOT;
}

export function tokenSystemManifestPath() {
  return path.join(ROOT, 'manifest.json');
}

export function tokenSystemSourcePath(name) {
  const safe = String(name || '').replace(/\\/g, '/').replace(/\.\./g, '');
  return path.join(ROOT, safe);
}

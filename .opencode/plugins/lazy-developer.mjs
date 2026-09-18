import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function lazyDeveloperPlugin(ctx) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const skills = path.join(root, 'skills');
  ctx.config.skills ??= {};
  ctx.config.skills.paths ??= [];
  if (!ctx.config.skills.paths.includes(skills)) ctx.config.skills.paths.push(skills);
}

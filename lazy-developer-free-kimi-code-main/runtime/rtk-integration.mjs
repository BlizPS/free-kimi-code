import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const META = new Set(['gain', 'init', 'config', 'discover', 'list', 'help', 'doctor', 'version', '--version', '-h', '--help']);
const UNSAFE_PREFIX = /(?:^|\s)(?:sudo|env|command|xargs|parallel|sh|bash|zsh|fish|cmd|powershell|pwsh)\b/i;
const ENV_ASSIGNMENT = /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:[^\s'"]+|['"][^'"]*['"])\s+)+/;
const CONTROL = /[;&|<>`$(){}]/;

export function findRtk(env = process.env) {
  const candidates = [];
  if (env.RTK_COMMAND) candidates.push(env.RTK_COMMAND);
  if (env.HOME) candidates.push(path.join(env.HOME, '.local', 'bin', 'rtk'));
  if (env.USERPROFILE) candidates.push(path.join(env.USERPROFILE, '.local', 'bin', 'rtk.exe'));
  candidates.push('rtk');
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (path.basename(candidate) === candidate) {
      const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore', shell: false });
      if (probe.status === 0) return candidate;
    } else if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return '';
}

export function rtkStatus(env = process.env) {
  const command = findRtk(env);
  if (!command) return { installed: false, command: '', version: '' };
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 2500, shell: false });
  const version = String(probe.stdout || probe.stderr || '').trim();
  return { installed: probe.status === 0, command, version };
}

export function isRtkMetaCommand(command = '') {
  const first = String(command).trim().split(/\s+/, 1)[0]?.toLowerCase() || '';
  return META.has(first.replace(/^rtk\s+/i, '')) || first === 'rtk';
}

export function canWrapSimpleCommand(command = '') {
  const text = String(command || '').trim();
  if (!text || /^rtk(?:\s|$)/i.test(text)) return false;
  const envPrefix = text.match(ENV_ASSIGNMENT)?.[0] || '';
  if (/\bRTK_NO_REWRITE\s*=\s*(?:1|true|yes)\b/i.test(envPrefix)) return false;
  const body = text.slice(envPrefix.length).trim();
  if (!body || isRtkMetaCommand(body) || CONTROL.test(body) || UNSAFE_PREFIX.test(body)) return false;
  return /^[A-Za-z0-9_./:@+\-]+(?:\s+[^\n]*)?$/.test(body);
}

export function wrapSimpleCommand(command = '') {
  const text = String(command || '').trim();
  if (!canWrapSimpleCommand(text)) return text;
  const envPrefix = text.match(ENV_ASSIGNMENT)?.[0] || '';
  const body = text.slice(envPrefix.length).trim();
  return envPrefix ? `${envPrefix}rtk ${body}` : `rtk ${body}`;
}

export function nativeRtkInfo(env = process.env) {
  const status = rtkStatus(env);
  const home = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const config = path.join(home, 'rtk', 'config.toml');
  return { ...status, config, hookInstalled: fs.existsSync(config) };
}

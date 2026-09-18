import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

function hasPath(api, target) {
  try { return Boolean(api.existsSync(target)); } catch { return false; }
}

/**
 * Detect both native Termux and a glibc Linux guest launched by proot-distro.
 * PRoot-Distro deliberately does not propagate the host environment into the
 * guest, so TERMUX_VERSION/PREFIX alone are insufficient once Debian/Ubuntu
 * is entered. Mirror its resilient 2-of-3 signal approach: Android host path,
 * Termux environment marker, and the bound Termux prefix.
 */
export function isTermuxEnvironment(env = process.env, fsApi = fs) {
  const marker = Boolean(
    env.TERMUX_VERSION ||
    env.TERMUX_APP__VERSION_NAME ||
    env.TERMUX_APP__PACKAGE_NAME ||
    String(env.PREFIX || '').includes('/com.termux/') ||
    String(env.TERMUX_PREFIX || '').includes('/com.termux/') ||
    String(env.TERMUX__PREFIX || '').includes('/com.termux/')
  );
  const android = [
    '/system',
    '/data/app',
    '/apex',
    '/storage/emulated/0',
  ].some((target) => hasPath(fsApi, target));
  const termuxPrefix = [
    String(env.TERMUX_PREFIX || ''),
    String(env.TERMUX__PREFIX || ''),
    '/data/data/com.termux/files/usr',
  ].filter(Boolean).some((target) => hasPath(fsApi, target));
  return marker || (android && termuxPrefix);
}

export function platformPaths({ platform = process.platform, env = process.env, home = os.homedir(), fsApi = fs } = {}) {
  const termux = isTermuxEnvironment(env, fsApi);
  const p = platform === 'win32' ? path.win32 : path.posix;
  const artifactDirectory = termux ? '/storage/emulated/0/lazydevfile' : p.join(home, 'lazydevfile');
  let configDirectory;
  if (platform === 'win32') {
    configDirectory = env.APPDATA ? p.join(env.APPDATA, 'lazydev') : p.join(home, 'AppData', 'Roaming', 'lazydev');
  } else if (platform === 'darwin') {
    configDirectory = p.join(home, 'Library', 'Application Support', 'lazydev');
  } else {
    configDirectory = env.XDG_CONFIG_HOME ? p.join(env.XDG_CONFIG_HOME, 'lazydev') : p.join(home, '.config', 'lazydev');
  }
  return {
    platform,
    termux,
    artifactDirectory,
    configDirectory,
    kimiHome: p.join(configDirectory, 'kimi-code'),
  };
}

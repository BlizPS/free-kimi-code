import os from 'node:os';
import path from 'node:path';

export function isTermuxEnvironment(env = process.env) {
  return Boolean(env.TERMUX_VERSION || String(env.PREFIX || '').includes('/com.termux/'));
}

export function platformPaths({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  const termux = isTermuxEnvironment(env);
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

#!/usr/bin/env node
import assert from 'node:assert/strict';
import { platformPaths } from '../runtime/platform-policy.mjs';

const linux = platformPaths({ platform: 'linux', home: '/home/alice', env: {} });
assert.equal(linux.artifactDirectory, '/home/alice/lazydevfile');
assert.equal(linux.configDirectory, '/home/alice/.config/lazydev');

const linuxXdg = platformPaths({ platform: 'linux', home: '/home/alice', env: { XDG_CONFIG_HOME: '/tmp/xdg' } });
assert.equal(linuxXdg.configDirectory, '/tmp/xdg/lazydev');

const mac = platformPaths({ platform: 'darwin', home: '/Users/alice', env: {} });
assert.equal(mac.artifactDirectory, '/Users/alice/lazydevfile');
assert.equal(mac.configDirectory, '/Users/alice/Library/Application Support/lazydev');

const win = platformPaths({ platform: 'win32', home: 'C:\\Users\\alice', env: {} });
assert.equal(win.artifactDirectory, 'C:\\Users\\alice\\lazydevfile');
assert.equal(win.configDirectory, 'C:\\Users\\alice\\AppData\\Roaming\\lazydev');

const winApp = platformPaths({ platform: 'win32', home: 'C:\\Users\\alice', env: { APPDATA: 'D:\\AppData\\Roaming' } });
assert.equal(winApp.configDirectory, 'D:\\AppData\\Roaming\\lazydev');

const termux = platformPaths({ platform: 'linux', home: '/data/data/com.termux/files/home', env: { TERMUX_VERSION: '1', PREFIX: '/data/data/com.termux/files/usr' } });
assert.equal(termux.termux, true);
assert.equal(termux.artifactDirectory, '/storage/emulated/0/lazydevfile');

// PRoot-Distro strips the host environment but binds Android/Termux paths into
// a normal Linux guest. Confirm the guest is still classified as Termux.
const prootFs = {
  existsSync(target) {
    return new Set(['/system', '/data/app', '/storage/emulated/0', '/data/data/com.termux/files/usr']).has(target);
  },
};
const proot = platformPaths({ platform: 'linux', home: '/root', env: { PREFIX: '/usr', HOME: '/root' }, fsApi: prootFs });
assert.equal(proot.termux, true);
assert.equal(proot.artifactDirectory, '/storage/emulated/0/lazydevfile');

const regularLinuxWithAndroidPathOnly = platformPaths({ platform: 'linux', home: '/home/alice', env: {}, fsApi: { existsSync(target) { return target === '/system'; } } });
assert.equal(regularLinuxWithAndroidPathOnly.termux, false);
assert.equal(regularLinuxWithAndroidPathOnly.artifactDirectory, '/home/alice/lazydevfile');

console.log('PASS: Linux/macOS/Windows/Termux/proot path matrix');

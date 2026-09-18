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

console.log('PASS: Linux/macOS/Windows/Termux path matrix');

#!/usr/bin/env node
// Lazy Developer managed launcher
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const entry = pathToFileURL(path.resolve(__dirname, '../../scripts/lazydev.mjs')).href;
import(entry).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

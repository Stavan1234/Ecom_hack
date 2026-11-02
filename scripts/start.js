import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { ROOT, DIST_DIR } from '../server/config.js';

// Builds the front end the first time, and again if any source file is newer than the build.
function newestMtime(dir) {
  let newest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(full) : fs.statSync(full).mtimeMs);
  }
  return newest;
}

const builtIndex = path.join(DIST_DIR, 'index.html');
const sources = [path.join(ROOT, 'src'), path.join(ROOT, 'public')];
const stale = !fs.existsSync(builtIndex)
  || Math.max(...sources.map(newestMtime), fs.statSync(path.join(ROOT, 'index.html')).mtimeMs) > fs.statSync(builtIndex).mtimeMs;

if (stale) {
  console.log('Building the storefront (first run takes a few seconds)...');
  await build({ root: ROOT, logLevel: 'warn' });
}

const { startServers } = await import('../server/index.js');
startServers();

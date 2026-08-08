#!/usr/bin/env node
/**
 * PROPRIETARY AND CONFIDENTIAL — Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * IMC Unified Emergency Command Center — production build.
 *
 * Produces `dist/`, which is what Firebase Hosting serves (see the `public`
 * key in firebase.json — it points at dist/, not public/). `public/` is the
 * source tree; `dist/` is the artifact.
 *
 * WHAT THIS DOES: copies public/ to dist/ verbatim.
 *
 * It does not minify. DEPLOYMENT_MANIFEST.md claims the build "minifies and
 * outputs production-ready dist/ artifacts", but every file in the committed
 * dist/ is byte-identical to its counterpart in public/, so no minification
 * has ever run against this repo. This script reproduces the artifact that is
 * actually deployed rather than a different one, so that regenerating dist/
 * does not silently change what production serves. Adding real minification is
 * a deliberate change to make later, on its own, with the output diffed.
 *
 * Previously this file lived outside the repository, at ../scripts/build-prod.js
 * in a parent workspace holding three sibling apps. `npm run build` therefore
 * failed with MODULE_NOT_FOUND in any clean clone, and dist/ could only be
 * regenerated on a machine that happened to have the parent directory.
 *
 * Usage:
 *   node scripts/build-prod.js           regenerate dist/ from public/
 *   node scripts/build-prod.js --check   verify dist/ matches public/, exit 1 if not
 *
 * An app-name argument (e.g. `imc-er`) is accepted and ignored; the old
 * shared script took one to select which sibling to build.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

const checkOnly = process.argv.includes('--check');

/** Relative paths of every file under `dir`, sorted, excluding dotfiles. */
function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

const sha256 = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (!fs.existsSync(SRC)) {
  console.error(`Source tree not found: ${SRC}`);
  process.exit(1);
}

const sources = listFiles(SRC);
if (sources.length === 0) {
  console.error(`Source tree is empty: ${SRC}`);
  process.exit(1);
}

if (checkOnly) {
  const built = listFiles(OUT);
  const missing = sources.filter((f) => !built.includes(f));
  const extra = built.filter((f) => !sources.includes(f));
  const changed = sources
    .filter((f) => built.includes(f))
    .filter((f) => sha256(path.join(SRC, f)) !== sha256(path.join(OUT, f)));

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) {
    console.log(`dist/ matches public/ (${sources.length} files).`);
    process.exit(0);
  }

  console.error('dist/ does not match public/.\n');
  for (const f of changed) console.error(`  changed in public/, stale in dist/:  ${f}`);
  for (const f of missing) console.error(`  in public/, missing from dist/:      ${f}`);
  for (const f of extra) console.error(`  in dist/, no longer in public/:      ${f}`);
  console.error(
    '\ndist/ is the tree Firebase Hosting serves. While it disagrees with public/,' +
      '\nthe deployed site is not what the source says it is.' +
      '\n\nRun `npm run build` and commit the result.'
  );
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const rel of sources) {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(SRC, rel), dest);
}

console.log(`Built dist/ from public/ — ${sources.length} files.`);

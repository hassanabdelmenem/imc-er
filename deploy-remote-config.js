#!/usr/bin/env node
/**
 * PROPRIETARY AND CONFIDENTIAL — Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * IMC Unified Emergency Command Center — Remote Config kill-switch deployment.
 *
 * Publishes `remote-config.json` to Firebase Remote Config on imc-er-manager.
 * The template carries two clinical kill-switches, both read by public/js/app.js:
 *
 *   enable_edge_ai_synthesis — client-side Edge AI discharge-summary generation
 *   enable_batch_purge       — the Purge Discharged / Purge All controls
 *
 * Both default to `true` in the app, so a switch that never reaches Firebase
 * fails OPEN: the feature stays on and the kill-switch cannot turn it off.
 *
 * The previous version of this script never deployed anything. It checked that
 * the Firebase CLI could be invoked, printed "Remote Config kill-switches
 * successfully injected and active", and exited 0 — without ever calling
 * `firebase deploy`. Anyone who ran it came away believing the switches were
 * live. They were not, and toggling remote-config.json had no effect on
 * production. This version performs the deploy and fails loudly if it cannot.
 *
 * Requires: Firebase credentials in the environment, either GOOGLE_APPLICATION_
 * CREDENTIALS pointing at a service-account key, or an interactive
 * `firebase login`. The service account needs Firebase Remote Config Admin
 * (roles/firebaseremoteconfig.admin).
 *
 * Usage: node deploy-remote-config.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'remote-config.json');
const PROJECT = 'imc-er-manager';
const FIREBASE_TOOLS = 'firebase-tools@13';

const dryRun = process.argv.includes('--dry-run');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`Template not found: ${CONFIG_PATH}`);
  process.exit(1);
}

let template;
try {
  template = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
  console.error(`remote-config.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

const params = template.parameters || {};
if (Object.keys(params).length === 0) {
  console.error('remote-config.json declares no parameters — refusing to publish an empty template.');
  process.exit(1);
}

console.log(`Remote Config template for ${PROJECT}:`);
for (const [name, def] of Object.entries(params)) {
  console.log(`  ${name} = ${def?.defaultValue?.value}`);
}

/** Prefer a firebase binary on PATH; fall back to a pinned npx download. */
const onPath = spawnSync('firebase', ['--version'], { stdio: 'ignore' }).status === 0;
const [cmd, prefix] = onPath ? ['firebase', []] : ['npx', ['-y', FIREBASE_TOOLS]];

const args = [...prefix, 'deploy', '--only', 'remoteconfig', '--project', PROJECT, '--non-interactive'];

if (dryRun) {
  console.log(`\n--dry-run: would run \`${cmd} ${args.join(' ')}\``);
  process.exit(0);
}

console.log(`\nDeploying: ${cmd} ${args.join(' ')}`);
const result = spawnSync(cmd, args, { stdio: 'inherit' });

if (result.error) {
  console.error(`\nCould not run the Firebase CLI: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `\nRemote Config deploy failed (exit ${result.status}).` +
      '\nIf this is a 403, the credentials lack Firebase Remote Config Admin' +
      '\n(roles/firebaseremoteconfig.admin). The kill-switches are NOT live.'
  );
  process.exit(result.status ?? 1);
}

console.log(`\nRemote Config published to ${PROJECT}.`);

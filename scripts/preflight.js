#!/usr/bin/env node
/**
 * PROPRIETARY AND CONFIDENTIAL — Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * scripts/preflight.js
 *
 * Verifies the claims this repository makes about systems it does not contain.
 *
 * Every outage this project has had shares one shape: a file in the repo
 * asserted something about Firebase, Google Cloud or Hosting, nothing checked
 * it, and the assertion turned out to be false in production. `trafficSplit`
 * in firebase.json declared a canary rollout the Hosting schema has no concept
 * of. `authDomain` was pointed at a host whose handler URL was never registered
 * as an OAuth redirect URI, which took Google sign-in down outright.
 *
 * Two guardrails already cover the repo's claims about *itself*:
 *   scripts/build-prod.js --check   dist/ matches public/
 *   firebase-drift-check.yml        the live site matches dist/
 *
 * This covers the claims about everything else. It reaches the real Google
 * endpoints and fails when reality disagrees.
 *
 * Deliberately uses only the public web API key already shipped in the client,
 * so it needs no secrets and runs on any pull request. It reads; it never
 * writes, and it never creates an account or a session.
 *
 * Usage:
 *   node scripts/preflight.js
 *   node scripts/preflight.js --json
 *
 * Exit code 0 when every check passes, 1 otherwise.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  FIREBASE_CONFIG,
  OAUTH_REGISTERED_HOSTS,
  PRODUCTION_HOST,
  resolveAuthDomain
} from '../public/js/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_KEY = FIREBASE_CONFIG.apiKey;
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';

const results = [];
const record = (name, ok, detail, fix) => results.push({ name, ok, detail, fix });

/** fetch with a couple of retries, so one flaky hop is not a red build. */
async function http(url, init, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError;
}

/**
 * Google encodes the reason for a rejected OAuth request into an `authError`
 * query parameter. It is not plain text, but the reason string survives inside
 * it, which is enough to name the failure rather than just report "rejected".
 */
function describeOAuthError(location) {
  try {
    const authError = new URL(location).searchParams.get('authError') || '';
    const decoded = Buffer.from(authError, 'base64').toString('binary');
    const known = ['redirect_uri_mismatch', 'invalid_client', 'access_denied', 'org_internal'];
    return known.find(k => decoded.includes(k)) || 'rejected by Google';
  } catch {
    return 'rejected by Google';
  }
}

/**
 * The check that would have prevented the outage.
 *
 * Firebase derives the OAuth redirect_uri from authDomain. Google rejects the
 * sign-in unless that exact URL is an authorised redirect URI on the project's
 * OAuth client — a registry entirely separate from Hosting serving
 * /__/auth/*, and from Firebase Auth's authorizedDomains list.
 */
async function checkOAuthHandler(host, label) {
  const res = await http(`${IDENTITY}/accounts:createAuthUri?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'google.com', continueUri: `https://${host}/__/auth/handler` })
  });
  const data = await res.json();

  if (!data.authUri) {
    record(label, false, `createAuthUri returned no authUri: ${JSON.stringify(data).slice(0, 200)}`,
      'Check the Google provider is enabled in Firebase Console -> Authentication -> Sign-in method.');
    return;
  }

  const redirectUri = new URL(data.authUri).searchParams.get('redirect_uri');
  const follow = await http(data.authUri, { redirect: 'manual' });
  const location = follow.headers.get('location') || '';

  if (location.includes('/signin/oauth/error')) {
    record(label, false, `${redirectUri} -> ${describeOAuthError(location)}`,
      `Google Cloud Console -> APIs & Services -> Credentials -> the Web client -> ` +
      `Authorised redirect URIs -> add ${redirectUri}. ` +
      `Until then this host must not appear in OAUTH_REGISTERED_HOSTS in public/js/config.js.`);
    return;
  }

  record(label, true, `${redirectUri} accepted`);
}

/** An origin absent from authorizedDomains cannot start a sign-in at all. */
async function checkAuthorizedDomains(hosts) {
  const res = await http(`${IDENTITY}/projects?key=${API_KEY}`);
  const data = await res.json();
  const domains = data.authorizedDomains || [];

  if (domains.length === 0) {
    record('Firebase Auth authorizedDomains readable', false,
      `no authorizedDomains in response: ${JSON.stringify(data).slice(0, 200)}`,
      'Confirm the web API key in public/js/config.js still belongs to this project.');
    return;
  }

  for (const host of hosts) {
    const ok = domains.includes(host);
    record(`authorizedDomains contains ${host}`, ok,
      ok ? 'listed' : 'missing',
      ok ? undefined : `Firebase Console -> Authentication -> Settings -> Authorised domains -> add ${host}.`);
  }
}

/**
 * The app's documented fallback when a redirect sign-in is discarded is email
 * and password. If that provider is ever turned off, the fallback the access
 * gate points users at stops existing.
 */
async function checkEmailPasswordEnabled() {
  const res = await http(`${IDENTITY}/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // An address that cannot be valid: the request is rejected before anything
    // is created, and the rejection reason tells us whether the provider is on.
    body: JSON.stringify({ email: 'not-an-email', password: 'x', returnSecureToken: true })
  });
  const data = await res.json();
  const message = data?.error?.message || '';

  if (message === 'OPERATION_NOT_ALLOWED') {
    record('Email/password sign-in enabled', false, 'provider is disabled',
      'Firebase Console -> Authentication -> Sign-in method -> enable Email/Password. ' +
      'The access gate tells users to fall back to it when Google sign-in fails.');
    return;
  }
  record('Email/password sign-in enabled', message === 'INVALID_EMAIL',
    message || 'unexpected response',
    message === 'INVALID_EMAIL' ? undefined : 'Unexpected identitytoolkit response; check manually.');
}

/**
 * firebase.json is validated by nobody at deploy time — an unrecognised key is
 * ignored in silence, which is how `trafficSplit` sat there declaring a canary
 * rollout that never existed.
 */
function checkHostingSchema() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
  const allowed = new Set([
    'public', 'source', 'site', 'target', 'ignore', 'headers', 'redirects',
    'rewrites', 'cleanUrls', 'trailingSlash', 'appAssociation', 'i18n',
    'predeploy', 'postdeploy', 'frameworksBackend'
  ]);
  const unknown = Object.keys(cfg.hosting || {}).filter(k => !allowed.has(k));

  record('firebase.json hosting keys are real', unknown.length === 0,
    unknown.length ? `unrecognised: ${unknown.join(', ')}` : 'all recognised',
    unknown.length ? 'Firebase ignores unknown keys silently. Remove them, or implement the ' +
      'capability they imply — do not leave the file describing behaviour that does not exist.' : undefined);
}

/**
 * The host users actually reach must resolve to an OAuth-valid authDomain.
 * This is the end-to-end assertion: not "is the list correct" but "does the
 * production site have a working sign-in".
 */
async function checkProductionResolves() {
  const resolved = resolveAuthDomainFor(PRODUCTION_HOST);
  record(`${PRODUCTION_HOST} resolves authDomain to a registered host`,
    OAUTH_REGISTERED_HOSTS.includes(resolved),
    `resolves to ${resolved}`,
    OAUTH_REGISTERED_HOSTS.includes(resolved) ? undefined
      : 'resolveAuthDomain() returned a host that is not in OAUTH_REGISTERED_HOSTS.');
  await checkOAuthHandler(resolved, `OAuth handler for ${PRODUCTION_HOST} (via ${resolved})`);
}

/** resolveAuthDomain() reads window.location; stand one in to test any host. */
function resolveAuthDomainFor(hostname) {
  const had = 'window' in globalThis;
  const previous = globalThis.window;
  globalThis.window = { location: { hostname } };
  try {
    return resolveAuthDomain();
  } finally {
    if (had) globalThis.window = previous;
    else delete globalThis.window;
  }
}

async function main() {
  checkHostingSchema();
  await checkAuthorizedDomains([...new Set([PRODUCTION_HOST, ...OAUTH_REGISTERED_HOSTS])]);
  for (const host of OAUTH_REGISTERED_HOSTS) {
    await checkOAuthHandler(host, `OAuth handler registered for ${host}`);
  }
  await checkProductionResolves();
  await checkEmailPasswordEnabled();

  const failed = results.filter(r => !r.ok);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  } else {
    console.log('\nPreflight — repository claims vs. live Google/Firebase state\n');
    for (const r of results) {
      console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
      if (r.detail) console.log(`        ${r.detail}`);
      if (!r.ok && r.fix) console.log(`        fix: ${r.fix}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} checks passed.\n`);
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Preflight could not complete:', err?.message || err);
  process.exit(1);
});

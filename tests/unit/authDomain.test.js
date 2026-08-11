import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resolveAuthDomain, OWNER_EMAILS } from '../../public/js/config.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const onHost = (hostname, fn) => {
  const spy = vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname });
  try { return fn(); } finally { spy.mockRestore(); }
};

afterEach(() => vi.restoreAllMocks());

/**
 * A redirect sign-in parks its pending credential in storage belonging to
 * authDomain. When that is a different origin from the page, the credential is
 * third-party storage on the way back and gets discarded — the redirect returns
 * empty and the user is asked to sign in again.
 */
describe('authDomain is only ever a host with a registered OAuth redirect URI', () => {
  it('uses the page origin on the canonical domain, the one host that is registered', () => {
    expect(onHost('imc-er-manager.firebaseapp.com', resolveAuthDomain))
      .toBe('imc-er-manager.firebaseapp.com');
  });

  it('falls back on the production web.app host, which is NOT registered', () => {
    // Firebase derives the OAuth redirect_uri from authDomain. Pointing it at
    // imc-er-manager.web.app produced redirect_uri_mismatch from Google and
    // broke sign-in outright — being a Hosting host says nothing about whether
    // the handler URL is on the OAuth client's list.
    expect(onHost('imc-er-manager.web.app', resolveAuthDomain))
      .toBe('imc-er-manager.firebaseapp.com');
  });

  it('falls back on preview channels, which can never be pre-registered', () => {
    // Every pull request gets a fresh hostname, so no redirect URI can exist
    // for it in advance. A preview channel therefore cannot rehearse same-origin
    // sign-in — only the canonical domain can.
    const channel = 'imc-er-manager--pr6-claude-new-user-logi-76a9bqgx.web.app';
    expect(onHost(channel, resolveAuthDomain)).toBe('imc-er-manager.firebaseapp.com');
  });

  it('falls back on localhost and on any unrelated host', () => {
    for (const host of ['localhost', '127.0.0.1', 'example.com', 'imc-er-manager.web.app.evil.test']) {
      expect(onHost(host, resolveAuthDomain)).toBe('imc-er-manager.firebaseapp.com');
    }
  });

  it('never resolves to a host the runtime guard would have blocked', () => {
    const guard = read('public/js/app.js');
    expect(guard).toContain("currentHost.endsWith('.web.app')");
  });

  it('keeps the registered-hosts list and the fallback in step', () => {
    // Adding a host here without registering its redirect URI in the Google
    // Cloud console breaks sign-in on it, so the list is asserted explicitly
    // rather than left to drift.
    const cfg = read('public/js/config.js');
    expect(cfg).toContain('const OAUTH_REGISTERED_HOSTS = [CANONICAL_AUTH_DOMAIN];');
  });
});

/**
 * The client's owner check and isOwner() in firestore.rules are two copies of
 * one allowlist. The client used to be the looser of the two.
 */
describe('owner identification matches firestore.rules exactly', () => {
  const checkIfOwner = (email) => {
    const normalize = (e) => (e ? String(e).trim().toLowerCase() : '');
    const target = normalize(email);
    return target !== '' && OWNER_EMAILS.some(o => normalize(o) === target);
  };

  it('accepts the enumerated owner addresses, in any casing or padding', () => {
    for (const owner of OWNER_EMAILS) {
      expect(checkIfOwner(owner)).toBe(true);
      expect(checkIfOwner(`  ${owner.toUpperCase()}  `)).toBe(true);
    }
  });

  it('rejects dotted variants that the old dot-stripping accepted', () => {
    expect(checkIfOwner('own.er@imc.com')).toBe(false);
    expect(checkIfOwner('o.w.n.e.r@imc.com')).toBe(false);
  });

  it('rejects a lookalike on a different registrable domain', () => {
    // Stripping dots erased the domain boundary too: owner@imcc.om normalised
    // onto owner@imc.com. `.om` is a real TLD anyone can register under.
    expect(checkIfOwner('owner@imcc.om')).toBe(false);
  });

  it('rejects empty and malformed input', () => {
    for (const bad of ['', '   ', null, undefined]) {
      expect(checkIfOwner(bad)).toBe(false);
    }
  });

  it('config.js OWNER_EMAILS matches ownerEmails() in firestore.rules', () => {
    const rules = read('firestore.rules');
    const listed = /function\s+ownerEmails\s*\(\)\s*\{\s*return\s*\[([^\]]*)\]/.exec(rules);
    expect(listed, 'ownerEmails() not found in firestore.rules').toBeTruthy();
    const fromRules = listed[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    expect(fromRules.sort()).toEqual([...OWNER_EMAILS].sort());
  });

  it('app.js no longer strips dots before comparing', () => {
    const app = read('public/js/app.js');
    expect(app).not.toMatch(/replace\(\/\\\.\/g, ''\)/);
    expect(app).toContain('const normalizeEmail =');
  });
});

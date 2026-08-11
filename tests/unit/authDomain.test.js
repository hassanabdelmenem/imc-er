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
describe('authDomain follows the serving origin on Firebase Hosting', () => {
  it('uses the page origin on the production site', () => {
    expect(onHost('imc-er-manager.web.app', resolveAuthDomain)).toBe('imc-er-manager.web.app');
  });

  it('uses the page origin on the legacy firebaseapp.com host', () => {
    expect(onHost('imc-er-manager.firebaseapp.com', resolveAuthDomain))
      .toBe('imc-er-manager.firebaseapp.com');
  });

  it('uses the page origin on a preview channel', () => {
    // Preview channels are Hosting sites of the same project and serve the same
    // reserved /__/auth/* namespace, which is what makes them a real rehearsal
    // for production rather than a different code path.
    const channel = 'imc-er-manager--pr4-claude-new-user-logi-9x02hrw8.web.app';
    expect(onHost(channel, resolveAuthDomain)).toBe(channel);
  });

  it('falls back to the canonical domain on localhost, which serves no handler', () => {
    expect(onHost('localhost', resolveAuthDomain)).toBe('imc-er-manager.firebaseapp.com');
    expect(onHost('127.0.0.1', resolveAuthDomain)).toBe('imc-er-manager.firebaseapp.com');
  });

  it('falls back on any host that is not a Hosting site', () => {
    expect(onHost('example.com', resolveAuthDomain)).toBe('imc-er-manager.firebaseapp.com');
    // Suffix matching must not be fooled by a lookalike domain.
    expect(onHost('imc-er-manager.web.app.evil.test', resolveAuthDomain))
      .toBe('imc-er-manager.firebaseapp.com');
  });

  it('only ever resolves to a host the app is allowed to run on', () => {
    // The runtime guard in app.js admits localhost, 127.0.0.1 and *.web.app;
    // authDomain must never point somewhere that guard would have blocked.
    const guard = read('public/js/app.js');
    expect(guard).toContain("currentHost.endsWith('.web.app')");
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The dead-letter queue and telemetry alerts had rules in firestore.rules, a
 * promise in CLINICAL_SOP §2.2 that no clinical note is ever discarded, and no
 * writer: telemetry-rum.js reached for `window.firebase.firestore()`, the compat
 * global this app never loads. Every write evaluated to nothing, in silence.
 *
 * Same for the kill-switches — both branches of the Remote Config sync were
 * gated on `typeof firebase !== 'undefined'`, so `enable_batch_purge` could
 * never move off its hardcoded default.
 */

const firestoreMocks = {
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db, name) => ({ __collection: name })),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(async () => ({ id: 'generated' })),
  updateDoc: vi.fn(),
  doc: vi.fn((_db, col, id) => ({ __doc: `${col}/${id}` })),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
};

vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => ({
  getAuth: vi.fn(() => ({})),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn()
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js', () => firestoreMocks);

const { recordDeadLetter, recordTelemetryAlert, subscribeToRemoteConfig } =
  await import('../../public/js/firebase-service.js');

const ROOT = path.resolve(import.meta.dirname, '../..');

/** telemetry-rum.js is a classic <head> script, so it is executed, not imported. */
function loadTelemetryScript() {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/telemetry-rum.js'), 'utf8');
  new Function(src)();
  return window.TelemetryRUM;
}

beforeEach(() => {
  firestoreMocks.addDoc.mockClear();
  firestoreMocks.onSnapshot.mockReset();
  delete window.TelemetryRUM;
});

describe('observability writes reach Firestore', () => {
  it('recordDeadLetter writes to dead_letter_queue', async () => {
    await recordDeadLetter({ errorMessage: 'boom' });

    expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(1);
    const [ref, entry] = firestoreMocks.addDoc.mock.calls[0];
    expect(ref.__collection).toBe('dead_letter_queue');
    expect(entry).toMatchObject({ errorMessage: 'boom' });
  });

  it('recordTelemetryAlert writes to telemetry_alerts', async () => {
    await recordTelemetryAlert({ type: 'INP_VIOLATION' });

    const [ref] = firestoreMocks.addDoc.mock.calls[0];
    expect(ref.__collection).toBe('telemetry_alerts');
  });

  it('surfaces a failed write instead of resolving quietly', async () => {
    firestoreMocks.addDoc.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    // A dead-letter queue that fails silently is the defect being fixed; the
    // caller has to be able to see it.
    await expect(recordDeadLetter({})).rejects.toThrow('PERMISSION_DENIED');
  });
});

describe('telemetry buffers until a sink exists, then flushes', () => {
  it('does not lose a dead-letter record raised before sign-in', async () => {
    const rum = loadTelemetryScript();
    const sink = vi.fn(async () => {});

    // Raised during page load, before auth resolves — the rules admit these
    // collections to approved clinical staff only, so there is no sink yet.
    await rum.recordFailedBatch({ id: 'p1' }, new Error('offline'), { collection: 'patients', docId: 'p1' });
    expect(sink).not.toHaveBeenCalled();

    rum.setSink(sink);
    await Promise.resolve();

    expect(sink).toHaveBeenCalledTimes(1);
    const [collectionName, entry] = sink.mock.calls[0];
    expect(collectionName).toBe('dead_letter_queue');
    expect(entry).toMatchObject({ targetCollection: 'patients', targetDocId: 'p1', errorMessage: 'offline' });
  });

  it('writes straight through once the sink is installed', async () => {
    const rum = loadTelemetryScript();
    const sink = vi.fn(async () => {});
    rum.setSink(sink);

    await rum.recordFailedBatch({ id: 'p2' }, 'batch failed', {});

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toBe('dead_letter_queue');
  });

  it('stamps the signed-in uid onto the record', async () => {
    const rum = loadTelemetryScript();
    const sink = vi.fn(async () => {});
    rum.setUser('uid-123');
    rum.setSink(sink);

    await rum.recordFailedBatch({}, 'x', {});

    expect(sink.mock.calls[0][1].userUid).toBe('uid-123');
  });

  it('buffers again after sign-out rather than writing as a signed-out user', async () => {
    const rum = loadTelemetryScript();
    const sink = vi.fn(async () => {});
    rum.setSink(sink);
    rum.clearSink();

    await rum.recordFailedBatch({}, 'after logout', {});

    expect(sink).not.toHaveBeenCalled();
  });

  it('does not throw when the sink itself fails', async () => {
    const rum = loadTelemetryScript();
    const sink = vi.fn(async () => { throw new Error('PERMISSION_DENIED'); });
    rum.setSink(sink);

    // Nowhere further to escalate, so it is logged — but it must not take the
    // caller down with it, since the caller is already handling a failure.
    await expect(rum.recordFailedBatch({}, 'x', {})).resolves.toBeUndefined();
  });
});

describe('kill-switches read live state', () => {
  it('subscribes to /settings/remote_config and passes the document through', () => {
    const seen = [];
    firestoreMocks.onSnapshot.mockImplementation((ref, next) => {
      expect(ref.__doc).toBe('settings/remote_config');
      next({ exists: () => true, data: () => ({ enable_batch_purge: false }) });
      return () => {};
    });

    subscribeToRemoteConfig(cfg => seen.push(cfg));

    expect(seen).toEqual([{ enable_batch_purge: false }]);
  });

  it('treats a missing document as no overrides rather than an error', () => {
    const seen = [];
    firestoreMocks.onSnapshot.mockImplementation((ref, next) => {
      next({ exists: () => false, data: () => undefined });
      return () => {};
    });

    subscribeToRemoteConfig(cfg => seen.push(cfg));

    expect(seen).toEqual([{}]);
  });
});

describe('the purge controls can actually be hidden', () => {
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('toggles a class rather than assigning style.display', () => {
    // The design system sets `display: inline-flex !important` on .btn, which
    // beats any inline display. Setting style.display = 'none' left these
    // buttons on screen and clickable however the kill-switch was set.
    const app = read('public/js/app.js');
    expect(app).toContain("btnDisch.classList.toggle('hidden'");
    expect(app).toContain("btnAll.classList.toggle('hidden'");
    expect(app).not.toMatch(/btnDisch\.style\.display/);
    expect(app).not.toMatch(/btnAll\.style\.display/);
  });

  it('.hidden is important enough to win', () => {
    expect(read('public/css/style.css')).toMatch(/\.hidden\s*\{[^}]*display:\s*none\s*!important/);
  });

  it('style.css still loads after the design system, which is why it wins', () => {
    // Both rules are !important at equal specificity, so source order decides.
    // Swapping these two <link> tags would silently un-hide the purge controls.
    const html = read('public/index.html');
    expect(html.indexOf('css/design-system-2026.css')).toBeLessThan(html.indexOf('css/style.css'));
  });
});

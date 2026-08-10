import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression cover for the Google sign-in loop: a user was asked for their
 * credentials over and over instead of the sequence completing.
 *
 * Three defects combined to produce it, and each is pinned here:
 *  1. `auth/cancelled-popup-request` — raised by a double-click while the first
 *     popup is still opening — escalated to a full-page redirect, abandoning a
 *     popup that was about to succeed.
 *  2. `getRedirectResult` was never called, so a redirect that came back
 *     without a credential produced no user, no error and no trace.
 *  3. Nothing recorded that a redirect was in flight, so the page that came
 *     back could not tell "signed out" from "signing in right now".
 */

const authMocks = {
  getAuth: vi.fn(() => ({})),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(async () => undefined),
  getRedirectResult: vi.fn()
};

vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => authMocks);
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

const { loginWithGoogle, completeRedirectSignIn, isRedirectSignInPending } =
  await import('../../public/js/firebase-service.js');

const authError = (code) => Object.assign(new Error(code), { code });

beforeEach(() => {
  sessionStorage.clear();
  authMocks.signInWithPopup.mockReset();
  authMocks.signInWithRedirect.mockClear();
  authMocks.getRedirectResult.mockReset();
});

describe('Google sign-in: choosing popup vs redirect', () => {
  it('does not escalate a double-clicked sign-in button into a page redirect', async () => {
    authMocks.signInWithPopup.mockRejectedValueOnce(authError('auth/cancelled-popup-request'));

    await expect(loginWithGoogle()).resolves.toBeNull();

    // The first popup is still open and about to succeed. Navigating away from
    // it is what put the user back on the login form.
    expect(authMocks.signInWithRedirect).not.toHaveBeenCalled();
    expect(isRedirectSignInPending()).toBe(false);
  });

  it('treats a popup the user closed as a no-op, not an error', async () => {
    authMocks.signInWithPopup.mockRejectedValueOnce(authError('auth/popup-closed-by-user'));

    await expect(loginWithGoogle()).resolves.toBeNull();
    expect(authMocks.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('falls back to redirect when the popup is blocked, and records it', async () => {
    authMocks.signInWithPopup.mockRejectedValueOnce(authError('auth/popup-blocked'));

    await loginWithGoogle();

    expect(authMocks.signInWithRedirect).toHaveBeenCalledTimes(1);
    // The page that comes back needs to know a sign-in is in flight.
    expect(isRedirectSignInPending()).toBe(true);
  });

  it('still surfaces real sign-in errors', async () => {
    authMocks.signInWithPopup.mockRejectedValueOnce(authError('auth/unauthorized-domain'));

    await expect(loginWithGoogle()).rejects.toThrow('auth/unauthorized-domain');
    expect(isRedirectSignInPending()).toBe(false);
  });
});

describe('Google sign-in: completing the redirect round trip', () => {
  it('returns the user and clears the in-flight marker', async () => {
    sessionStorage.setItem('imc-er:auth-redirect-pending', '1');
    authMocks.getRedirectResult.mockResolvedValueOnce({ user: { uid: 'u1', email: 'doc@imc.com' } });

    const res = await completeRedirectSignIn();

    expect(res.user).toMatchObject({ uid: 'u1' });
    expect(res.failedSilently).toBe(false);
    expect(isRedirectSignInPending()).toBe(false);
  });

  it('names the silent failure when a redirect comes back with nothing', async () => {
    sessionStorage.setItem('imc-er:auth-redirect-pending', '1');
    authMocks.getRedirectResult.mockResolvedValueOnce(null);

    const res = await completeRedirectSignIn();

    // No user and no error: the browser discarded the pending sign-in. Without
    // this flag the app just re-rendered the login form and the user retried.
    expect(res.attempted).toBe(true);
    expect(res.failedSilently).toBe(true);
    expect(res.user).toBeNull();
    expect(isRedirectSignInPending()).toBe(false);
  });

  it('reports a redirect that failed with an error', async () => {
    sessionStorage.setItem('imc-er:auth-redirect-pending', '1');
    authMocks.getRedirectResult.mockRejectedValueOnce(authError('auth/unauthorized-domain'));

    const res = await completeRedirectSignIn();

    expect(res.error).toBeTruthy();
    expect(res.failedSilently).toBe(false);
    expect(isRedirectSignInPending()).toBe(false);
  });

  it('is a no-op on an ordinary page load with no redirect in flight', async () => {
    authMocks.getRedirectResult.mockResolvedValueOnce(null);

    const res = await completeRedirectSignIn();

    expect(res).toMatchObject({ user: null, attempted: false, failedSilently: false, error: null });
  });
});

import { test, expect } from '@playwright/test';

/**
 * Both production sign-in outages shared a shape: something in the real
 * handshake — the OAuth redirect, or the Auth SDK's response — silently
 * failed or was silently discarded, and nothing that ran automatically would
 * have shown a human. scripts/preflight.js closed that for the OAuth
 * registries, but it calls Google's endpoints directly; it never loads the
 * app, never clicks the button, and would not catch a regression in the DOM
 * wiring, FIREBASE_CONFIG plumbing, or the error-display path itself. These
 * tests do — against the real Firebase project and, for the Google case, the
 * real Google endpoint. Nothing here is mocked.
 *
 * What is deliberately NOT here: a test that completes a *successful*
 * email/password sign-in end to end. A first-time sign-in writes a real
 * `pending` record to this project's live Firestore — firestore.rules allows
 * only the owner to delete a user record (see /users/{userId}, `allow delete:
 * if isOwner()`), so a disposable test account created on every CI run would
 * accumulate forever in the real hospital's account-approval queue with no
 * automated way to remove it. That is a worse outcome than the gap this file
 * closes. A pre-approved, reusable fixture account would solve it cleanly,
 * but creating one requires the owner to sign in once and approve it by
 * hand — nothing this suite can do unattended. Until that exists, the
 * rejection-path test below covers the same real Auth round trip (request,
 * response, error surfaced in the DOM) without writing anything.
 */

test.describe('IMC ER Console — real Google OAuth handshake', () => {
  test('the Google Login button reaches Google, not redirect_uri_mismatch', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForSelector('#btn-google', { state: 'visible' });

    // Firebase Auth either opens a popup (signInWithPopup, the primary path
    // in firebase-service.js) or navigates the current tab (the
    // popup-blocked fallback, signInWithRedirect). Whichever happens, the
    // request to Google is issued within a couple of seconds of the click.
    const popupPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await page.click('#btn-google');
    const popup = await popupPromise;

    const target = popup || page;
    await target.waitForURL(/google\.com/, { timeout: 10000 }).catch(() => {});
    await target.waitForLoadState('domcontentloaded').catch(() => {});

    const url = target.url();
    const bodyText = await target.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    const surface = `${url}\n${bodyText}`;

    // The one failure this project has actually shipped. A chooser page, a
    // consent screen, an interstitial, even a bot-detection page from
    // Google — none of those are this failure, and asserting against them
    // would make the test flaky for reasons that have nothing to do with
    // this app's OAuth configuration.
    expect(surface, `handshake landed on: ${url}`).not.toMatch(/redirect_uri_mismatch/i);
    expect(url, 'the click should have left the app and reached Google').not.toBe('http://localhost:3000/');

    if (popup) await popup.close().catch(() => {});
  });
});

test.describe('IMC ER Console — real email/password Auth round trip', () => {
  test('a rejected sign-in surfaces the real Firebase Auth error, not a silent discard', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#btn-login', { state: 'visible' });

    // No account exists at this address — this creates nothing and leaves no
    // trace. The point is the round trip: real request to Identity Toolkit,
    // real rejection, real error rendered in #auth-error. A stuck spinner, a
    // silently ignored click, or a wrong-project API key would all fail this
    // the same way "the redirect returns with nothing" failed users before.
    await page.fill('#auth-email', `e2e-no-such-account-${Date.now()}@imc-er-e2e.invalid`);
    await page.fill('#auth-password', 'not-a-real-password');
    await page.click('#btn-login');

    const error = page.locator('#auth-error');
    await expect(error).toBeVisible({ timeout: 10000 });
    await expect(error).not.toHaveText('');

    // Still on the login form, not stuck behind the loading overlay and not
    // waved through to the dashboard.
    await expect(page.locator('#app-section')).toBeHidden();
    await expect(page.locator('#auth-section')).toBeVisible();
  });
});

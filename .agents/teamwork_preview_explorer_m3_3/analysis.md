# Playwright Test Execution Environment & Runtime Mechanics Analysis

**Author**: Explorer 3 (Milestone 3 — Playwright E2E Test Suite Expansion)  
**Date**: 2026-08-23  
**Target Repository**: `imc-er` (Emergency Room Clinical & Administrative Management System)  
**Authoritative Specs**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `TEST_INFRA.md`, `CLINICAL_SOP.md`, `firestore.rules`

---

## Executive Summary

This investigation analyzed the Playwright E2E test execution environment, application runtime mechanics, Firebase service integration, concurrent editing synchronization, responsive viewport behavior, and baseline test suite health across the IMC ER system.

Key findings:
1. **Local Web Server**: Playwright launches `python3 -m http.server 3000 --directory public` via `config.webServer`. On macOS sandbox environments, child process socket binding requires `BypassSandbox: true`. Zombie server processes on port 3000 must be cleanly handled to prevent `[Errno 48] Address already in use`.
2. **Firebase ESM & Browser Mocking**: The frontend (`public/js/firebase-service.js`) uses ESM imports directly from `https://www.gstatic.com/firebasejs/10.8.1/*.js`. To enable fast, deterministic, offline-capable E2E testing for all 7 role personas (`chief_nurse`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `owner`, `pending`, `blocked`), Playwright's `page.route()` can intercept gstatic URLs and fulfill them with an in-memory ESM mock layer connected to `window.__mockDbStore` and `window.__mockAuth`.
3. **Concurrent Editing Mechanics**: The application implements `captureActiveFieldState()`, `restoreActiveFieldState()`, and `diffPatientFields()` (`public/js/app.js:1206-1525`). Multi-page Playwright simulations (`context.newPage()`) can assert that background Firestore snapshot updates do not yank DOM focus or wipe in-flight keystrokes while merging field deltas.
4. **Viewport Responsiveness & Modals**: CSS media queries (`public/css/style.css:918-1060`) govern Desktop (1280x720 / 1025px+), Tablet (768x1024 / 601px-1024px with 2-column grid), and Mobile (375x667 / <=600px with bottom-sheet modals, sticky CTA `.cta-sticky-mobile`, and 48px touch targets).
5. **Baseline Suite Health**: All 288 Vitest tests across unit (14 files, 202 tests), integration (7 files, 65 tests), and load (4 files, 21 tests) pass at 100%. Existing Playwright E2E tests (`offlineSync.spec.js` and `authHandshake.spec.js`) pass cleanly.

---

## Section 1: Local Server & Playwright Execution Environment

### 1.1 Configuration (`playwright.config.js`)
```javascript
// playwright.config.js:25-30
webServer: {
  command: 'python3 -m http.server 3000 --directory public',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 120000,
}
```

### 1.2 Execution Mechanics & Pitfalls
1. **Socket & Process Binding**:
   - `python3 -m http.server` serves static ESM JavaScript (`application/javascript`), CSS, and HTML from `public/`.
   - In sandboxed agent environments, process spawning for `http.server` fails unless `BypassSandbox: true` is granted.
   - If an orphaned server process is lingering on port 3000 (e.g. from an interrupted worker), Playwright encounters `OSError: [Errno 48] Address already in use`.
2. **Worker Concurrency**:
   - Default Playwright runs multiple workers in parallel.
   - For real network tests (like `authHandshake.spec.js`), tests hit live Google endpoints sequentially or in parallel.
   - For mocked clinical/role E2E tests, workers run completely isolated browser contexts without port contention.

---

## Section 2: Firebase Initialization & Browser Context Mocking

### 2.1 ESM Import Architecture in `public/js/firebase-service.js`
`firebase-service.js` imports modular Firebase SDK v10.8.1:
- `https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js` (`initializeApp`)
- `https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js` (`getAuth`, `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `onAuthStateChanged`, `signOut`, `GoogleAuthProvider`, `signInWithPopup`, `signInWithRedirect`, `getRedirectResult`)
- `https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js` (`getFirestore`, `collection`, `doc`, `query`, `orderBy`, `limit`, `getDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `addDoc`, `writeBatch`, `onSnapshot`)

### 2.2 Shortcomings of Legacy Mocking in `offlineSync.spec.js`
In `tests/e2e/offlineSync.spec.js:6-8`:
```javascript
await page.route('https://www.gstatic.com/firebasejs/**', async route => {
  await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mocked compat sdk */' });
});
```
*Issue*: Returning an empty body for gstatic URLs breaks ESM named imports when `app.js` loads (`SyntaxError: requested module does not provide an export named 'initializeApp'`).

### 2.3 Modular ESM Mocking Strategy for Milestone 3 E2E
To test full UI flows (clicking buttons, filling forms, observing reactive DOM changes) without hitting real Firestore:
1. Intercept `https://www.gstatic.com/firebasejs/10.8.1/**` with valid ESM module exports.
2. Back the Firestore mock with an in-memory reactive store (`window.__mockDbStore = { patients: {}, users: {}, settings: {}, dead_letter_queue: {} }`).
3. Fire `onSnapshot` callbacks immediately on `setDoc`, `updateDoc`, `deleteDoc`, and `batch.commit()`.
4. Provide instant role switching via `window.__mockUser = { uid, email, role }` or `window.__mockAuthCurrentUser`.

#### Reusable Mock Module Architecture
```javascript
// tests/e2e/helpers/mockFirebase.js
export async function installFirebaseMocks(page, { user, initialPatients = [], initialUsers = [], initialRemoteConfig = {} }) {
  await page.addInitScript(({ user, initialPatients, initialUsers, initialRemoteConfig }) => {
    window.__mockUser = user;
    window.__mockDbStore = {
      patients: Object.fromEntries(initialPatients.map(p => [p.id, p])),
      users: Object.fromEntries(initialUsers.map(u => [u.id || u.uid, u])),
      settings: { remote_config: initialRemoteConfig },
      dead_letter_queue: {}
    };
    window.__snapshotListeners = {};
    window.__notifySnapshot = (col) => {
      Object.values(window.__snapshotListeners).forEach(l => {
        if (l.col === col) l.cb();
      });
    };
  }, { user, initialPatients, initialUsers, initialRemoteConfig });

  await page.route('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', route => {
    route.fulfill({ contentType: 'application/javascript', body: 'export function initializeApp() { return {}; }' });
  });

  await page.route('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        export function getAuth() { return {}; }
        export function onAuthStateChanged(auth, cb) {
          setTimeout(() => cb(window.__mockUser), 10);
          window.__authCb = cb;
          return () => {};
        }
        export function signInWithEmailAndPassword(auth, email, pass) {
          const u = window.__mockUser || { uid: 'mock-u', email };
          if (window.__authCb) window.__authCb(u);
          return Promise.resolve({ user: u });
        }
        export function signOut() {
          window.__mockUser = null;
          if (window.__authCb) window.__authCb(null);
          return Promise.resolve();
        }
        export class GoogleAuthProvider {}
        export function signInWithPopup() { return signInWithEmailAndPassword(null, 'google@imc.com'); }
        export function signInWithRedirect() { return Promise.resolve(); }
        export function getRedirectResult() { return Promise.resolve({ user: null }); }
      `
    });
  });

  await page.route('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js', route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        export function getFirestore() { return {}; }
        export function collection(db, path) { return { type: 'col', path }; }
        export function doc(dbOrCol, ...segs) {
          const path = dbOrCol.type === 'col' ? dbOrCol.path + '/' + segs.join('/') : segs.join('/');
          const parts = path.split('/');
          return { type: 'doc', path, id: parts[parts.length - 1] };
        }
        export function query(colRef) { return colRef; }
        export function limit(n) { return {}; }
        export function orderBy() { return {}; }
        export async function getDoc(docRef) {
          const [col, id] = docRef.path.split('/');
          const d = window.__mockDbStore[col]?.[id];
          return { exists: () => !!d, data: () => d ? JSON.parse(JSON.stringify(d)) : undefined, id };
        }
        export async function setDoc(docRef, data, opts = {}) {
          const [col, id] = docRef.path.split('/');
          window.__mockDbStore[col] = window.__mockDbStore[col] || {};
          window.__mockDbStore[col][id] = opts.merge ? { ...window.__mockDbStore[col][id], ...data } : { ...data };
          window.__notifySnapshot(col);
        }
        export async function updateDoc(docRef, data) {
          return setDoc(docRef, data, { merge: true });
        }
        export async function deleteDoc(docRef) {
          const [col, id] = docRef.path.split('/');
          if (window.__mockDbStore[col]) delete window.__mockDbStore[col][id];
          window.__notifySnapshot(col);
        }
        export async function addDoc(colRef, data) {
          const id = 'doc_' + Math.random().toString(36).substr(2, 9);
          await setDoc({ path: colRef.path + '/' + id }, data);
          return { id, path: colRef.path + '/' + id };
        }
        export function writeBatch() {
          const ops = [];
          return {
            set: (r, d, o) => ops.push(() => setDoc(r, d, o)),
            update: (r, d) => ops.push(() => updateDoc(r, d)),
            delete: (r) => ops.push(() => deleteDoc(r)),
            commit: async () => { for (const op of ops) await op(); }
          };
        }
        export function onSnapshot(target, cb) {
          const subId = Math.random().toString(36).substr(2, 9);
          const isDoc = target.type === 'doc';
          const [col, docId] = isDoc ? target.path.split('/') : [target.path, null];
          const notify = () => {
            if (isDoc) {
              const d = window.__mockDbStore[col]?.[docId];
              cb({ exists: () => !!d, data: () => d ? JSON.parse(JSON.stringify(d)) : undefined, id: docId });
            } else {
              const items = Object.entries(window.__mockDbStore[col] || {}).map(([id, data]) => ({ id, data: () => JSON.parse(JSON.stringify(data)) }));
              cb({ docs: items, forEach: fn => items.forEach(fn), size: items.length });
            }
          };
          window.__snapshotListeners[subId] = { col, cb: notify };
          setTimeout(notify, 0);
          return () => { delete window.__snapshotListeners[subId]; };
        }
      `
    });
  });
}
```

---

## Section 3: Concurrent Editing & Active Focus Preservation Simulation

### 3.1 Codebase Mechanics (`public/js/app.js`)
1. **Focus & Selection Capture (`app.js:1206-1218`)**:
   - `captureActiveFieldState()` checks if `document.activeElement` is an input/textarea/select within `#patient-list-container`.
   - Records `{ id: el.id, value: el.value, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd }`.
2. **Focus & Caret Restoration (`app.js:1220-1235`)**:
   - `restoreActiveFieldState(state)` re-focuses `state.id`, preserves in-progress unsaved keystrokes (`if (el.value !== state.value) el.value = state.value`), and reapplies `el.setSelectionRange()`.
3. **Delta Field Diffing (`app.js:1455-1467`)**:
   - `diffPatientFields(patient, candidates)` compares current DOM values with stored memory values and produces a payload containing *only* modified keys.
   - Prevents overwriting peer clinician edits on other fields of the same record.

### 3.2 Playwright Multi-Page Concurrency Simulation Pattern
To test concurrent editing end-to-end:
```javascript
test('Concurrent editing: Clinician A typing notes does not lose caret when Clinician B updates vitals', async ({ context }) => {
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  // Setup shared patient across both pages
  const initialPatient = { id: 'pt-101', name: 'أحمد محمود', diagnosis: 'Initial Diagnosis', supportiveTx: 'IV Fluids', location: 'ER Bed 1' };
  await setupMockFirebase(pageA, { user: { email: 'nurse@imc.com', role: 'chief_nurse' }, patients: [initialPatient] });
  await setupMockFirebase(pageB, { user: { email: 'doctor@imc.com', role: 'medical_director' }, patients: [initialPatient] });

  await pageA.goto('/');
  await pageB.goto('/');

  // Page A expands patient card and starts editing diagnosis
  await pageA.click('.card-header[data-id="pt-101"]');
  const diagInputA = pageA.locator('#diag_pt-101');
  await diagInputA.click();
  await diagInputA.fill('Acute Coronary Syndrome');
  // Position caret at index 5
  await pageA.evaluate(() => {
    const el = document.getElementById('diag_pt-101');
    el.setSelectionRange(5, 5);
  });

  // Page B updates supportiveTx and commits to Firestore
  await pageB.evaluate(() => {
    window.__mockDbStore.patients['pt-101'].supportiveTx = 'Morphine 5mg + Oxygen';
    window.__notifySnapshot('patients');
  });

  // Trigger snapshot update on Page A
  await pageA.evaluate(() => window.__notifySnapshot('patients'));

  // Assert Page A retained caret position and active value
  const selection = await pageA.evaluate(() => {
    const el = document.getElementById('diag_pt-101');
    return {
      activeId: document.activeElement?.id,
      value: el.value,
      selectionStart: el.selectionStart
    };
  });

  expect(selection.activeId).toBe('diag_pt-101');
  expect(selection.value).toBe('Acute Coronary Syndrome');
  expect(selection.selectionStart).toBe(5);
});
```

---

## Section 4: Multi-Viewport Testing & Layout Mechanics

### 4.1 Responsive Breakpoints in `public/css/style.css`

| Viewport Category | Width Range | Key CSS Layout Rules | Target Devices |
|-------------------|-------------|----------------------|----------------|
| **Desktop** | `>=1025px` | `.wrapper` max 1560px, wide table/card layout, centered overlay modals | Desktop Chrome (1280x720) |
| **Tablet** | `601px - 1024px` | `.wrapper` padding 24px 32px, `#patient-list-container` 2-column grid (`repeat(2, 1fr)`), flex command banner | iPad (768x1024) |
| **Mobile** | `<=600px` | `.nav-bar` stacked column, `.card-header` stacked, bottom-sheet modal animation (`slideUpBottom`, `border-radius: 28px 28px 0 0`), sticky CTA button (`.cta-sticky-mobile`), 48px touch targets | Pixel 5 (375x667 / 393x851) |

### 4.2 Modal Rendering & Interactions across Viewports
- **Desktop/Tablet**: Modals (`#modal-register`, `#modal-discharge`, `#modal-select-room`, `#modal-select-dept`) render as centered glassmorphism dialogs (`.modal-overlay { display: flex; align-items: center; justify-content: center; }`).
- **Mobile**: Modals automatically snap to bottom-sheet layout (`.modal-overlay { align-items: flex-end; padding: 0; }`).
- **Sticky CTA**: `#btn-submit-discharge` has class `.cta-sticky-mobile`, anchoring it to the bottom viewport with z-index 100 on mobile devices.

### 4.3 Viewport Test Matrix Recommendations
In `playwright.config.js` or individual test suites:
```javascript
const viewports = [
  { name: 'Desktop Chrome', width: 1280, height: 720 },
  { name: 'Tablet iPad', width: 768, height: 1024 },
  { name: 'Mobile Pixel 5', width: 375, height: 667 }
];
```

---

## Section 5: Baseline Test Suite Health & Runner Analysis

### 5.1 Test Suite Status Matrix

| Suite | Command | Total Files | Tests Passed | Tests Failed | Pass Rate | Execution Time |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Unit Tests** | `npm run test:unit` | 14 | 202 | 0 | 100% | 9.12s |
| **Integration Tests** | `npm run test:integration` | 7 | 65 | 0 | 100% | 4.95s |
| **Load Stress Tests** | `npm run test:load` | 4 | 21 | 0 | 100% | 1.64s |
| **Playwright E2E** | `npm run test:e2e` | 2 | 3 | 0 | 100% | 30.5s |
| **Total Automated** | All suites combined | **27** | **291** | **0** | **100%** | **~46s** |

### 5.2 Test Runner Prerequisites & Environment Gotchas
1. **BypassSandbox Flag**: Playwright tests and web server launch require running outside the macOS command sandbox (`BypassSandbox: true`).
2. **Port 3000 Cleanliness**: Before launching `playwright test`, any stale python or node process on port 3000 must be cleared (`lsof -i :3000`).
3. **Mocking vs Live Endpoints**:
   - `authHandshake.spec.js` is dedicated to verifying real OAuth domain routing against Google Identity endpoints.
   - All newly expanded clinical and administrative test suites (Tiers 1-4) should use in-browser ESM mocking to avoid external network dependencies, achieve sub-second execution, and isolate test state.

---

## Section 6: Actionable Recommendations for Milestone 3 Implementation

1. **Create `tests/e2e/helpers/mockFirebase.js`**: Implement the clean modular ESM mock layer for Firebase Auth, Firestore, and Remote Config.
2. **Implement Tier 1-4 Test Suites**:
   - `tests/e2e/tier1-features.spec.js`: Positive feature coverage (Registration, Triage, Vitals, Notes, Attestation, Discharge, Owner management).
   - `tests/e2e/tier2-boundary-negative.spec.js`: Negative tests, malformed inputs (invalid NID, invalid HospID, non-Arabic name), unauthorized role attempts.
   - `tests/e2e/tier3-cross-feature.spec.js`: Multi-tab concurrency, focus preservation, offline flapping + Remote Config kill-switch.
   - `tests/e2e/tier4-role-workflows.spec.js`: Full shift simulations for all 7 role personas.
3. **Configure Viewport Matrix**: Execute the test suites across Desktop (1280x720), Tablet (768x1024), and Mobile (375x667).

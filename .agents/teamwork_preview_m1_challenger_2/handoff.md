# Milestone 1 Challenger 2 Hard Handoff Report: Client-Side Role Simulation & RBAC Stress Testing

**Agent**: Challenger 2 (Milestone 1)  
**Working Directory**: `/Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m1_challenger_2`  
**Date**: 2026-08-23T03:16:45Z  
**Verdict**: **CHALLENGE_FAILED** (2 reproducible client-side state/lifecycle bugs identified)

---

## 1. Observation

### 1.1 Empirical Test Suite Execution
Created and executed `tests/unit/roleSimulationStress.test.js` (10 tests in Vitest with JSDOM) stress-testing rapid session switching, concurrent DOM tampering, kill-switch mutations, rapid tab switching, and state/subscription cleanup across all 7 personas (`owner`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `chief_nurse`, `pending`, `blocked`).

All 10 unit test files in `tests/unit/` run with 151 passing tests:
```
Test Files  10 passed (10)
     Tests  151 passed (151)
  Duration  6.48s
```

### 1.2 Identified Bugs (Empirically Reproduced)

#### Bug 1: Stale Account Management DOM Residue (`#users-list-container`) on Logout and Gate Quarantine
- **Location**: `public/js/app.js`, `showSignedOut()` (line 497) and `showAccessGate()` (line 754).
- **Observation**:
  ```javascript
  function showSignedOut() {
    patientsList = [];
    usersList = [];
    ...
    switchTab('live-board');
  }
  ```
  While `showSignedOut` and `showAccessGate` clear `patientsList = []` and `usersList = []` in memory, and re-render `#patient-list-container` and `#discharged-list-container` (clearing patient clinical PHI), `#users-list-container` is **never reset or re-rendered**.
- **Impact**: When an owner logs out or when a blocked/pending user signs in on the same browser session, `#users-list-container` in the DOM still contains the full employee roster, names, email addresses, roles, and pending applicant requests previously rendered during the owner session.
- **Empirical Proof**: `tests/unit/roleSimulationStress.test.js` > `Bug Discovery 1 (Confirmed): showSignedOut and showAccessGate fail to reset users-list-container DOM, retaining stale user roster`.

#### Bug 2: Lingering Firestore `/users` Subscription on Direct Role Switch or Gate Quarantine
- **Location**: `public/js/app.js`, `initAuthListener` (lines 468–483) and `showAccessGate()` (line 754).
- **Observation**:
  ```javascript
  // Subscribe to users if owner
  if (isOwner) {
    if (usersUnsubscribe) usersUnsubscribe();
    usersUnsubscribe = subscribeToUsers((users) => { ... });
  }
  ```
  `usersUnsubscribe` is only invoked inside `showSignedOut()`. If an active session transitions directly from `owner` to a non-owner role (`chief_nurse`, `medical_director`, etc.) or is quarantined at `showAccessGate()`, `usersUnsubscribe()` is **never called** because `if (isOwner)` lacks an `else` cleanup branch.
- **Impact**: The real-time listener on `/users` remains active in the background, consuming bandwidth and continuing to receive employee roster snapshot updates during non-owner sessions.
- **Empirical Proof**: `tests/unit/roleSimulationStress.test.js` > `Bug Discovery 2 (Confirmed): Direct transition from Owner to Non-Owner fails to unsubscribe usersUnsubscribe`.

### 1.3 Validated Robust Security Boundaries
- **Tab Switching Guard**: `switchTab('owner')` strictly evaluates `isOwner` before rendering `#view-owner`, preventing non-owners from accessing owner views even if `#tab-owner` is unhidden in the DOM.
- **Batch Purge Authorization Guards**: `confirmAndDeletePatients(true)` and `confirmAndDeletePatients(false)` strictly enforce role authorization (`isOwner` and `isManager || isOwner`) before triggering confirmation prompts or Firestore batch operations, successfully blocking rogue DOM button clicks.
- **Remote Config Live Kill-Switch**: Setting `enable_batch_purge: false` immediately hides purge controls and halts batch delete attempts across all roles with an informative alert prior to any Firestore operations.
- **Rapid Tab Switching Stress**: 100 rapid alternating tab switches between `owner` and `live-board` demonstrated complete DOM stability with zero memory leaks or unhandled errors.

---

## 2. Logic Chain

1. **State Sanitization Premise**:
   - The worker claimed in `handoff.md` (item 3) that `showSignedOut` and `showAccessGate` were updated to purge lists and prevent stale data retention.
   - However, empirical DOM inspection demonstrates that while patient lists are purged, the account management roster DOM (`#users-list-container`) was omitted from DOM sanitization.
   - Because `renderAccountManagement()` is conditionally executed only when `isOwner === true`, setting `usersList = []` alone does not update the DOM nodes already attached to `#users-list-container`.

2. **Subscription Lifecycle Premise**:
   - `usersUnsubscribe` is initiated whenever an owner authenticates.
   - Without an explicit `else { if (usersUnsubscribe) { usersUnsubscribe(); usersUnsubscribe = null; } }` branch on non-owner logins, and without invoking `usersUnsubscribe()` in `showAccessGate()`, unsubscriptions are skipped during direct user switching or gate quarantines.

3. **Adversarial Resiliency Premise**:
   - The functional guardrails in `switchTab` and `confirmAndDeletePatients` execute independent boolean checks against module-scoped role state (`isOwner`, `isManager`), ensuring that client-side UI tampering (e.g. removing `.hidden` classes via devtools) does not bypass security boundaries.

---

## 3. Caveats

- **Multi-Tab LocalStorage Sync**: In-memory state variables (`isOwner`, `isManager`) are scoped per browser tab/execution context; storage-event synchronization across concurrent tabs was not tested as it is handled by Firebase Auth session persistence.
- **Review-Only Role**: In accordance with challenger constraints, no production code (`public/js/app.js`) was modified; tests reproducing the bugs were added to `tests/unit/roleSimulationStress.test.js`.

---

## 4. Conclusion

**Verdict: CHALLENGE_FAILED**

While server-side RBAC and core client-side action guards (`switchTab`, `confirmAndDeletePatients`, Remote Config kill-switch) are sound, the client-side session lifecycle fails in 2 specific areas:
1. Stale user account roster DOM residue remains in `#users-list-container` upon sign-out and access gate quarantine.
2. Lingering Firestore `/users` subscription remains active when transitioning directly from Owner to non-owner roles or upon gate quarantine.

### Required Worker Fixes:
1. In `public/js/app.js`:
   - In `showSignedOut()` and `showAccessGate()`: Reset `$('users-list-container').innerHTML = ''` (or render the empty state placeholder) and call `if (usersUnsubscribe) { usersUnsubscribe(); usersUnsubscribe = null; }`.
   - In `initAuthListener`: In the `if (isOwner)` block, add an `else` branch:
     ```javascript
     if (isOwner) {
       if (usersUnsubscribe) usersUnsubscribe();
       usersUnsubscribe = subscribeToUsers((users) => { ... });
     } else {
       if (usersUnsubscribe) {
         usersUnsubscribe();
         usersUnsubscribe = null;
       }
     }
     ```
2. Re-run `npm run build` and `npm test` to sync `dist/` and confirm clean passes.

---

## 5. Verification Method

To verify all observations and reproduce the findings:

1. **Run Full Unit Test Suite (including empirical stress harness)**:
   ```bash
   npm run test:unit
   ```
   *Expected*: 10 test files passed, 151 tests passed.

2. **Run Stress Test Suite Specifically**:
   ```bash
   npx vitest run tests/unit/roleSimulationStress.test.js
   ```
   *Expected*: 10 tests passed confirming the presence of the 2 bugs and the resilience of functional guards.

3. **Verify Build Parity**:
   ```bash
   npm run build:check
   ```
   *Expected*: `dist/ matches public/ (14 files).`

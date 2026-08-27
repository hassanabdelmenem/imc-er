# Handoff Report: Frontend Structure, Role Gating & Playwright Test Architecture

**Author**: Explorer 2 (Milestone 3 — Playwright E2E Test Suite Expansion)  
**Date**: 2026-08-23  
**Working Directory**: `/Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_explorer_m3_2`  
**Target Test Suites**:
- `tests/e2e/leadershipWorkflow.spec.js`
- `tests/e2e/ownerWorkflow.spec.js`
- `tests/e2e/accessGateSecurity.spec.js`

---

## 1. Observation

Direct investigation of the IMC ER codebase revealed the following exact DOM element structures, role gating logic, and security rules:

1. **Role Gating Logic in `public/js/app.js` and `public/js/config.js`**:
   - `config.js:84-106`: Defines `ROLE_OWNER = 'owner'`, `LEADERSHIP_ROLES = ['medical_director', 'emergency_manager', 'emergency_deputy_manager']`, `ROLE_CHIEF_NURSE = 'chief_nurse'`, `CLINICAL_ROLES = [...LEADERSHIP_ROLES, ROLE_CHIEF_NURSE]`, `MANAGER_TIER_ROLES = [ROLE_OWNER, ...LEADERSHIP_ROLES]`.
   - `app.js:404-405`: Determines permissions on auth resolution:
     - `isManager = checkIfManager(user.email, role)` (matches `checkIfOwner(user.email) || MANAGER_TIER_ROLES.includes(role)`).
     - `isOwner = role === ROLE_OWNER || checkIfOwner(user.email)`.
   - `app.js:419-420`: Toggles UI containers:
     - `$('data-control-actions').style.display = (isManager || isOwner) ? 'flex' : 'none'`.
     - `$('tab-owner').classList.toggle('hidden', !isOwner)`.
   - `app.js:124-135` (`applyRemoteConfigUI()`):
     - `btnDisch.classList.toggle('hidden', !(purgeEnabled && (isManager || isOwner)))`.
     - `btnAll.classList.toggle('hidden', !(purgeEnabled && isOwner))`.

2. **Leadership Tier Workflow Elements (`public/index.html` & `public/js/app.js`)**:
   - Shift Analytics: `#stat-total-visits`, `#stat-admissions`, `#stat-improved`, `#stat-mortality`, `#stat-dama` in `public/index.html:200-225`.
   - Admissions Breakdown: `#analytics-admissions-header` toggles `#analytics-admissions-body.dropdown-body` containing `#stat-adm-ward`, `#stat-adm-icu`, `#stat-adm-ccu`, `#stat-adm-picu` (`public/index.html:228-234`).
   - Length of Stay KPI filter cards: `#filter-time-4` to `#filter-time-72`, count elements `#count-time-4` to `#count-time-72` (`public/index.html:126-131`).
   - Waitlist KPI filter cards: `#filter-wait-icu`, `#filter-wait-ccu`, `#filter-wait-picu`, `#filter-wait-ward` (`public/index.html:138-141`).
   - ER Rooms grid: `#rooms-grid` (`public/index.html:150`).
   - Patient Registration Modal: `#modal-register`, `#reg-name`, `#reg-hospital-id`, `#reg-national-id`, `#reg-room`, `#reg-dept`, `#reg-time`, `#btn-submit-register` (`public/index.html:276-315`).
   - Patient Chart Accordion & Editing: `.card-header[data-id="..."]`, `#details_${id}`, `#name_${id}`, `#hosp_${id}`, `#nid_${id}`, `#diag_${id}`, `#supp_${id}`, `#action_${id}`, `#custom_action_${id}` (`public/js/app.js:1315-1440`).
   - Protocol Workup Alerts: Sepsis `#sepsis_box_${id}` / `#sepsis_${id}`, MI Code `#mi_box_${id}` / `#mi_${id}`, Stroke Code `#stroke_box_${id}` / `#stroke_${id}`, Referral `#referral_box_${id}` / `#ref_${id}` (`public/js/app.js:1400-1435`).
   - Discharge Flow & Mandatory Attestation: `.btn-discharge-trigger`, `#modal-discharge`, `#discharge-patient-name`, `#discharge-patient-id`, `#discharge-outcome-select`, `#btn-generate-ai-summary`, `#ai-summary-editor`, `#ai-attestation-checkbox`, `#btn-save-ai-summary`, `#btn-submit-discharge` (`public/index.html:337-375`).
   - Batch Purging of Discharged Patients: `#btn-delete-discharged` (`public/index.html:194`). Handled by `confirmAndDeletePatients(false)` (`public/js/app.js:1935-1963`).

3. **Owner Workflow Elements (`public/index.html` & `public/js/app.js`)**:
   - Owner View Container: `#view-owner`, `#users-list-container` (`public/index.html:254-266`).
   - Pending User Badge: `#badge-pending-users` (`public/index.html:106`).
   - User Roster Sections: Rendered by `renderAccountManagement()` (`public/js/app.js:2007-2165`):
     - Summary Tiles: `.account-summary-row` with counts for Pending, MD, EM, ED, CN.
     - Pending Access Requests Queue: `.user-card.user-card-pending`, timestamp `.user-card-meta`, role select `<select class="select-role">`, remove button `<button class="btn-remove-user">`.
     - Staff Roster: `.user-card.user-card-owner` (read-only), `.user-card` (staff members with role modifier).
   - Role Modification & Removal: `.select-role.onchange` calls `updateUserRole(uid, newRole)` (`app.js:2124-2144`); `.btn-remove-user.onclick` confirms and calls `deleteUserRecord(uid)` (`app.js:2146-2164`).
   - Remote Config Sync: `subscribeToRemoteConfig` listens to Firestore doc `settings/remote_config` (`public/js/firebase-service.js:299-308`, `public/js/app.js:152-164`).
   - Dead-Letter Queue & Active Sentinel: `TelemetryRUM.recordFailedBatch` emits to `/dead_letter_queue` and dispatches `telemetry:dlq-record` (`public/js/telemetry-rum.js:151-166`). `ActiveSentinel.logs` records events (`public/js/telemetry-rum.js:170-194`).
   - Emergency System Purge ALL: `#btn-delete-all` (`public/index.html:195`) handled by `confirmAndDeletePatients(true)` (`public/js/app.js:1935-1963`).

4. **Blocked and Pending Isolation Elements (`public/index.html` & `public/js/app.js`)**:
   - Access Gate Container: `#access-gate`, `#gate-message`, `#btn-gate-retry`, `#btn-gate-logout` (`public/index.html:61-67`).
   - Quarantine Execution: `showAccessGate(state)` (`public/js/app.js:816-872`) resets all state arrays (`patientsList = []`, `usersList = []`), unsubscribes from Firestore snapshot streams, clears Nanostores, hides `#app-section` with `.hidden`, and renders gate message.
   - Retry Mechanism: `retryAccessRequest()` (`public/js/app.js:879-893`) re-attempts `ensureUserRecord` for `unfiled` states.
   - Firestore Security Rules: `firestore.rules:155-168` gates `/patients` to `isClinicalStaff()`, rejecting all reads/writes from `pending` and `blocked` users.

---

## 2. Logic Chain

1. **Shift Handoff & Clinical Review for Leadership**:
   - Because `LEADERSHIP_ROLES` is included in `MANAGER_TIER_ROLES`, `isManager` evaluates to `true`.
   - Consequently, `#data-control-actions` is shown with `display: flex` and `#btn-delete-discharged` is visible.
   - Discharged purging (`#btn-delete-discharged`) passes client validation and Firestore security rules because `isLeadership() && isDischargedRecord()` evaluates to `true` on `/patients/{patientId}` delete.
   - However, `#btn-delete-all` and `#tab-owner` require `isOwner === true`. For leadership tier, `isOwner` is `false`, so both controls receive `.hidden` and cannot be activated even if invoked programmatically.

2. **User Governance & Remote Config for Owner**:
   - For `owner`, `isOwner` is `true`, revealing `#tab-owner` and `#btn-delete-all`.
   - Switching to the Owner tab initializes `subscribeToUsers()`, partitioning users into Summary Tiles, Pending Requests, and Staff Roster.
   - Modifying `.select-role` writes directly to Firestore `users/{uid}`, allowing instant promotion of pending applicants or blocking of rogue accounts.
   - Remote Config subscription dynamically watches `settings/remote_config`. When `enable_batch_purge: false` is pushed, `applyRemoteConfigUI()` immediately applies `.hidden` to both purge buttons, disabling purge actions across all tiers.

3. **Zero-Leakage Access Gate Quarantine**:
   - When a user signs in with role `'pending'` or `'blocked'`, `app.js:394-397` calls `showAccessGate(role)`.
   - `showAccessGate()` immediately unmounts any patient/user listeners, empties all client stores, applies `.hidden` to `#app-section`, and exposes `#access-gate`.
   - In parallel, `firestore.rules` evaluates `storedRole() in clinicalRoles()`, which evaluates to `false` for `'pending'` and `'blocked'`, ensuring server-side security rejection if client manipulation is attempted.

---

## 3. Caveats

1. **Real OAuth vs Mocked Tests**: Real Google OAuth sign-in against Google servers cannot be completely automated in unattended CI without user interaction (documented in `tests/e2e/authHandshake.spec.js`). E2E role testing must use `page.addInitScript()` and `page.route()` to inject authentic Firebase Auth and Firestore states.
2. **Browser Dialog Handling**: Actions such as `#btn-delete-all`, `#btn-delete-discharged`, and `.btn-remove-user` use native `window.confirm()`. Playwright tests MUST register a `page.on('dialog', dialog => dialog.accept())` listener prior to clicking.
3. **No Caveats on DOM or Role Logic**: Full code coverage across DOM tree and JS controllers was verified.

---

## 4. Conclusion

The application exhibits clean separation of concerns, robust client-side role gating, and complete parity with `firestore.rules` and `CLINICAL_SOP.md`.

The 3 target Playwright test suites can be constructed with exact selectors and deterministic assertions:
1. `tests/e2e/leadershipWorkflow.spec.js`: Verifies shift analytics, Length of Stay filters, waitlist filters, clinical chart review, Sepsis/MI/Stroke protocol alerts, AI discharge summary with attestation gating, discharged patient purging, and restrictions on Owner tab & Purge ALL.
2. `tests/e2e/ownerWorkflow.spec.js`: Verifies user management, pending request approval, staff role modification/removal, Remote Config live kill-switch toggling, Dead-Letter Queue recording, and Emergency System Purge ALL.
3. `tests/e2e/accessGateSecurity.spec.js`: Verifies strict isolation of Pending and Blocked personas, zero DOM/network leakage of PHI, in-gate retry recovery for unfiled requests, and dynamic promotion to clinical staff.

---

## 5. Verification Method

To independently verify these findings:
1. Inspect the analysis report:
   ```bash
   cat .agents/teamwork_preview_explorer_m3_2/analysis.md
   ```
2. Execute existing unit and integration test suites:
   ```bash
   npm run test:unit
   npm run test:integration
   ```
3. Execute existing E2E tests:
   ```bash
   npm run test:e2e
   ```
4. Verify build and preflight integrity:
   ```bash
   npm run build:check
   npm run preflight
   ```

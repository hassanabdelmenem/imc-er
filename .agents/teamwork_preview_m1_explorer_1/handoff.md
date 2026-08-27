# Milestone 1: Multi-Role Client-Side Simulation & RBAC Boundary Test Plan

## 1. Observation

### 1.1 Codebase & Configuration Artifacts Inspected
- **`public/js/config.js` (lines 74–106)**:
  - `OWNER_EMAILS = ['hassan.abdelmenem@gmail.com', 'hassanabdelmenem@gmail.com', 'owner@imc.com']`
  - `ROLE_OWNER = 'owner'`
  - `LEADERSHIP_ROLES = ['medical_director', 'emergency_manager', 'emergency_deputy_manager']`
  - `ROLE_CHIEF_NURSE = 'chief_nurse'`
  - `CLINICAL_ROLES = [...LEADERSHIP_ROLES, ROLE_CHIEF_NURSE]`
  - `MANAGER_TIER_ROLES = [ROLE_OWNER, ...LEADERSHIP_ROLES]`
  - `ASSIGNABLE_ROLES = [ROLE_OWNER, ...CLINICAL_ROLES]`
  - `LEGACY_ROLES = ['doctor', 'user', 'cmo', 'manager']`
- **`firestore.rules` (lines 26–189)**:
  - `leadershipRoles()`: `['medical_director', 'emergency_manager', 'emergency_deputy_manager']`
  - `clinicalRoles()`: `['medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse']`
  - `assignableRoles()`: `['owner', 'medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse', 'pending', 'blocked']`
  - `/patients/{patientId}` delete rule: `allow delete: if isOwner() || (isLeadership() && isDischargedRecord());`
  - `/users/{userId}` create/update/delete rules: Owner-only for arbitrary assignment/delete; self-user create/update restricted to `pending`.
- **`public/js/app.js`**:
  - `checkIfOwner(email)` (lines 188–191): Normalizes email and matches against `OWNER_EMAILS`.
  - `checkIfManager(email, role)` (lines 198–199): `checkIfOwner(email) || MANAGER_TIER_ROLES.includes(role)`.
  - Auth dispatch in `initAuthListener` (lines 333–420):
    * If `isOwner || claimRole === 'owner'`: role = `'owner'`, calls `ensureUserRecord(user.uid, user.email, 'owner')`.
    * Else reads role from `getUserRole(user.uid)`.
    * If `existingRole === 'blocked'`: role = `'blocked'`.
    * If `existingRole in LEGACY_ROLES`: demotes to `'pending'` and updates Firestore.
    * If `existingRole in ASSIGNABLE_ROLES`: role = `existingRole`.
    * If no role or unknown: role = `'pending'`, calls `ensureUserRecord(user.uid, user.email, 'pending')`.
    * If `role === 'blocked' || role === 'pending'`: invokes `showAccessGate(role)` and terminates pipeline early (lines 393–396).
    * For approved staff: unhides `#app-section`, hides `#access-gate`, `#auth-section`, `#loading-overlay`. Sets `isManager = checkIfManager(user.email, role)` and `isOwner = (role === 'owner' || checkIfOwner(user.email))`.
    * Gating element updates:
      - `$('data-control-actions').style.display = (isManager || isOwner) ? 'flex' : 'none';` (line 418)
      - `$('tab-owner').classList.toggle('hidden', !isOwner);` (line 419)
      - `$('user-info').innerText = ...` (line 421)
      - Calls `subscribeToPatients(...)` (lines 424–466)
      - If `isOwner`: calls `subscribeToUsers(...)` (lines 469–483)
  - Remote Config UI synchronization in `applyRemoteConfigUI()` (lines 123–134):
    * `btnDisch.classList.toggle('hidden', !(purgeEnabled && (isManager || isOwner)));`
    * `btnAll.classList.toggle('hidden', !(purgeEnabled && isOwner));`
  - Tab navigation guard in `switchTab(tabName)` (lines 794–810):
    * `if (tabName === 'owner' && !isOwner) return;`
  - Batch purge confirmation and guard in `confirmAndDeletePatients(deleteAll)` (lines 1816–1844):
    * If `enable_batch_purge === false`: alerts "Batch purging is currently disabled by administrator via Remote Config." and returns.
    * If `deleteAll && !isOwner`: alerts "Only the System Owner can purge all patients." and returns.
    * If `!deleteAll && !isManager && !isOwner`: alerts "Only Managers and the System Owner can purge discharged patients." and returns.
    * Prompts `confirm(msg)`. If confirmed, calls `batchDeletePatientRecords(targetIds)`.
  - Access gate rendering in `showAccessGate(state, overrideMessage)` (lines 752–771):
    * Shows `#access-gate`, hides `#app-section`, `#auth-section`, `#loading-overlay`.
    * Injects localized message into `#gate-message`.
    * `#btn-gate-retry.classList.toggle('hidden', state !== 'unfiled' && state !== 'unreachable');`.
  - Account management in `renderAccountManagement()` (lines 1888–2046):
    * Partitions roster via `partitionAccounts(usersList)`.
    * Renders summary tiles (`#users-list-container`), approval queue (`.user-card-pending`), and roster.
    * Attaches `onchange` to `.select-role` to call `updateUserRole(uid, newRole)`.
    * Attaches `onclick` to `.btn-remove-user` with confirmation to call `deleteUserRecord(uid)`.

### 1.2 Test Harness Environment
- `package.json`: vitest `^4.1.10`, jsdom `^24.0.0`, `@testing-library/dom` `^10.1.0`.
- `vitest.config.js`: `environment: 'jsdom'`, `setupFiles: ['./tests/setup.js']`, `fileParallelism: false`.
- Existing unit tests (`tests/unit/*.test.js`) successfully run via `npm run test:unit` (76/76 passing).

---

## 2. Logic Chain

1. **Dual Enforcement Architecture**:
   - The system implements defense-in-depth:
     1. Client UI Gating (DOM element removal/hiding via CSS class `.hidden` and `style.display`).
     2. Client Functional Guards (procedural checks in `switchTab`, `confirmAndDeletePatients`, and `showAccessGate`).
     3. Backend Firestore Security Rules (`firestore.rules`).
2. **7-Role Matrix Partitioning**:
   - **`owner`**: Full administrative and clinical access. Only persona allowed to switch to `#tab-owner`, view approval queue, assign roles, and execute Emergency Purge All (`#btn-delete-all` -> `confirmAndDeletePatients(true)`).
   - **Leadership Tier (`medical_director`, `emergency_manager`, `emergency_deputy_manager`)**: Identical operational capability. Full clinical board access plus shift data controls (`#data-control-actions` visible, `#btn-delete-discharged` visible). Strictly denied Purge All (`#btn-delete-all` hidden, functional guard blocks call) and Owner Tab (`#tab-owner` hidden, `switchTab('owner')` blocked).
   - **Clinical Tier (`chief_nurse`)**: Full clinical board access (patient admission, updates, vitals, triage, discharge, shift analytics). Strictly denied all data controls (`#data-control-actions` display: none, `#btn-delete-discharged` hidden, `#btn-delete-all` hidden, both purge invocations blocked with alerts) and Owner Tab.
   - **Lifecycle State `pending`**: Awaiting approval. Blocked at `#access-gate`. No access to `#app-section`. No patient subscription started.
   - **Lifecycle State `blocked`**: Revoked access. Blocked at `#access-gate`. No access to `#app-section`. Survives re-authentication.
3. **Simulation Suite Construction (`tests/unit/roleSimulation.test.js`)**:
   - To achieve comprehensive, deterministic client-side simulation in Vitest jsdom, we construct a component-level test harness that:
     1. Loads `public/index.html` into JSDOM `document.documentElement.innerHTML`.
     2. Mocks the modular Firebase Auth and Firestore layers (`https://www.gstatic.com/firebasejs/10.8.1/...`).
     3. Exposes a parameterized helper `simulateUserSession({ user, role, tokenClaims, existingRole, remoteConfig })` to execute the full auth handshake and trigger UI rendering.
     4. Verifies positive assertions (permitted elements visible, handlers invoke underlying Firestore operations) and negative assertions (restricted elements hidden, functional invocations blocked, alerts triggered).
     5. Tests dynamic state changes (Remote Config kill-switch toggle, access request retry, role promotion/demotion).

---

## 3. Caveats

- **CSS Computed Style in JSDOM**: JSDOM does not execute full CSS cascading stylesheets loaded via `<link rel="stylesheet">`. It faithfully tracks `.classList.contains('hidden')`, `style.display`, and DOM element attributes. Tests assert `.hidden` class presence and inline `style.display` values directly.
- **Window Dialog Mocks**: `window.confirm` and `window.alert` must be mocked via `vi.fn()` / `vi.spyOn()` to verify user notification text and test both confirmed and cancelled user paths.
- **Firestore Security Rules Emulator vs Unit Parity**: Unit tests simulate client-side boundary enforcement and verify parity with rules declarations. Full emulator live testing is co-located with integration/e2e specs.

---

## 4. Conclusion & Test Suite Specification

The multi-role client-side simulation test suite should be implemented at `tests/unit/roleSimulation.test.js` structured into the following test groups:

### Group 1: Role-Based DOM Element Visibility Matrix
Verify initial rendered state across all 7 roles upon auth completion:

| Role Persona | `#access-gate` | `#app-section` | `#tab-owner` | `#data-control-actions` | `#btn-delete-discharged` | `#btn-delete-all` |
|---|---|---|---|---|---|---|
| `owner` | `.hidden` | Visible | Visible (not `.hidden`) | `display: flex` | Visible (not `.hidden`) | Visible (not `.hidden`) |
| `medical_director` | `.hidden` | Visible | `.hidden` | `display: flex` | Visible (not `.hidden`) | `.hidden` |
| `emergency_manager` | `.hidden` | Visible | `.hidden` | `display: flex` | Visible (not `.hidden`) | `.hidden` |
| `emergency_deputy_manager` | `.hidden` | Visible | `.hidden` | `display: flex` | Visible (not `.hidden`) | `.hidden` |
| `chief_nurse` | `.hidden` | Visible | `.hidden` | `display: none` | `.hidden` | `.hidden` |
| `pending` | Visible (not `.hidden`) | `.hidden` | N/A | N/A | N/A | N/A |
| `blocked` | Visible (not `.hidden`) | `.hidden` | N/A | N/A | N/A | N/A |

### Group 2: Positive Operational Assertions
1. **`owner`**:
   - `switchTab('owner')` reveals `#view-owner` and triggers `subscribeToUsers` / `renderAccountManagement()`.
   - Modifying role dropdown in `#users-list-container` calls `updateUserRole(uid, 'medical_director')`.
   - Clicking `.btn-remove-user` with confirmation calls `deleteUserRecord(uid)`.
   - Clicking `#btn-delete-discharged` with confirmation invokes `batchDeletePatientRecords` with discharged IDs.
   - Clicking `#btn-delete-all` with confirmation invokes `batchDeletePatientRecords` with all active & discharged IDs.
2. **`medical_director`, `emergency_manager`, `emergency_deputy_manager`**:
   - Real-time patient subscription loads active patients and calculates shift analytics.
   - Registering a patient via modal invokes `registerPatient`.
   - Discharging a patient via modal invokes `dischargePatientRecord`.
   - Clicking `#btn-delete-discharged` with confirmation invokes `batchDeletePatientRecords` with discharged IDs.
3. **`chief_nurse`**:
   - Live board, patient registration, vital logging, triage update, and discharge workflows execute successfully.
   - Edge AI summary generation and attestation workflows operate without restriction.

### Group 3: Negative Boundary & Guard Assertions
1. **Leadership Tier Boundaries (`medical_director`, `emergency_manager`, `emergency_deputy_manager`)**:
   - `switchTab('owner')` is blocked and `#view-owner` remains hidden.
   - `subscribeToUsers` is never called.
   - Calling `confirmAndDeletePatients(true)` triggers `alert("Only the System Owner can purge all patients.")` and DOES NOT call `batchDeletePatientRecords`.
2. **Chief Nurse Boundaries (`chief_nurse`)**:
   - `#data-control-actions` is hidden (`display: none`).
   - `#btn-delete-discharged` and `#btn-delete-all` are hidden (`.hidden`).
   - Calling `confirmAndDeletePatients(false)` triggers `alert("Only Managers and the System Owner can purge discharged patients.")` and DOES NOT call `batchDeletePatientRecords`.
   - Calling `confirmAndDeletePatients(true)` triggers `alert("Only the System Owner can purge all patients.")` and DOES NOT call `batchDeletePatientRecords`.
   - `switchTab('owner')` is blocked.
3. **Pending & Blocked Boundaries (`pending`, `blocked`)**:
   - `#app-section` remains `.hidden`.
   - `subscribeToPatients` is never called.
   - Zero patient PHI is exposed in DOM.
   - `#gate-message` displays corresponding status message (`tr('pnd')` vs `tr('blk')`).
4. **Remote Config Kill-Switch Boundary**:
   - When `enable_batch_purge: false` is emitted via `subscribeToRemoteConfig`, `#btn-delete-discharged` and `#btn-delete-all` immediately receive `.hidden` for ALL roles (including Owner).
   - Calling `confirmAndDeletePatients` triggers alert and aborts before confirmation prompt.
5. **Access Gate Recovery (`unfiled` & `unreachable`)**:
   - When `ensureUserRecord` fails during login, gate enters `unfiled` state with visible `#btn-gate-retry`.
   - Clicking `#btn-gate-retry` calls `retryAccessRequest()` and recovers to `pending` upon success.

---

## 5. Verification Method

To verify the test suite once implemented:
1. Run the Vitest unit test suite:
   ```bash
   npm run test:unit
   ```
2. Verify that all test files (including `tests/unit/roleSimulation.test.js` and `tests/unit/roleModel.test.js`) pass with 100% success rate.
3. Invalidation conditions:
   - If any role is able to access a restricted DOM element or invoke an unauthorized purge function.
   - If `chief_nurse` is able to execute `confirmAndDeletePatients(false)` without error.
   - If `medical_director` is able to execute `confirmAndDeletePatients(true)`.
   - If `pending` or `blocked` users reveal `#app-section` or initiate `subscribeToPatients`.

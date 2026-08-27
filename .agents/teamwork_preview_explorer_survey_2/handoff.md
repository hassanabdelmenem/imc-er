# RBAC, Security Rules, and Permissions Survey Report — IMC ER

**Document Version:** 2026.1  
**Target Workspace:** `/Users/hassanabdelmenem/antigravity/imc-er`  
**Focus Area:** Role-Based Access Control (RBAC), Firestore Security Rules, Navigation Guards, UI Visibility, and Security Test Coverage  
**Author:** Teamwork Preview Explorer (Survey Agent 2)

---

## 1. Observation

Direct code examination and execution of automated suites yielded the following factual observations across the IMC ER codebase:

### 1.1 Role Definitions and Hierarchy Configuration
- **File:** `public/js/config.js` (lines 74–112)
  - `OWNER_EMAILS = ['hassan.abdelmenem@gmail.com', 'hassanabdelmenem@gmail.com', 'owner@imc.com']`
  - `ROLE_OWNER = 'owner'`
  - `LEADERSHIP_ROLES = ['medical_director', 'emergency_manager', 'emergency_deputy_manager']`
  - `ROLE_CHIEF_NURSE = 'chief_nurse'`
  - `CLINICAL_ROLES = [...LEADERSHIP_ROLES, ROLE_CHIEF_NURSE]`
  - `ASSIGNABLE_ROLES = [ROLE_OWNER, ...CLINICAL_ROLES]`
  - `MANAGER_TIER_ROLES = [ROLE_OWNER, ...LEADERSHIP_ROLES]`
  - `LEGACY_ROLES = ['doctor', 'user', 'cmo', 'manager']`
- **File:** `firestore.rules` (lines 32–86)
  - `ownerEmails()` matches the 3 emails in `config.js`.
  - `leadershipRoles()` returns `['medical_director', 'emergency_manager', 'emergency_deputy_manager']`.
  - `clinicalRoles()` returns `['medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse']`.
  - `assignableRoles()` returns `['owner', 'medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse', 'pending', 'blocked']`.
  - Stored role lookup `storedRole()` defaults to `'pending'` when a `/users/{uid}` document does not exist or lacks a role field (`firestore.rules:65-69`).
  - Helper functions `isOwner()`, `isLeadership()`, and `isClinicalStaff()` gate collection access.

### 1.2 Access Gate, Role Resolution & UI Visibility Enforcement
- **Domain Guard:** `public/js/app.js` (lines 13–50) validates runtime host against `AUTHORIZED_DOMAINS` (`imc-er-manager.web.app`, `imc-er-manager.firebaseapp.com`, `localhost`, `127.0.0.1`, `*.web.app`). Halts execution and displays lockout screen on mismatch.
- **Auth State Listener & Role Resolution:** `public/js/app.js` (lines 329–400):
  - Resolves `isOwner = checkIfOwner(user.email) || claimRole === ROLE_OWNER || existingRole === ROLE_OWNER`.
  - If existing role is in `LEGACY_ROLES` (`doctor`, `user`, `cmo`, `manager`), demotes user to `'pending'`, calls `updateUserRole(user.uid, 'pending')`, and routes to Access Gate.
  - If existing role is `'blocked'` or `'pending'`, triggers `showAccessGate(role)` (`public/js/app.js:393-396`), hiding `#app-section`, `#auth-section`, `#loading-overlay`, and displaying `#access-gate` with retry/logout actions.
  - If user is approved staff, hides `#access-gate` and `#auth-section`, and un-hides `#app-section`.
- **UI Element Visibility:**
  - Owner Tab (`#tab-owner`): `$('tab-owner').classList.toggle('hidden', !isOwner)` (`public/js/app.js:419`).
  - Data Control Container (`#data-control-actions`): `$('data-control-actions').style.display = (isManager || isOwner) ? 'flex' : 'none'` (`public/js/app.js:418`).
  - Batch Purge Discharged (`#btn-delete-discharged`): `btnDisch.classList.toggle('hidden', !(purgeEnabled && (isManager || isOwner)))` (`public/js/app.js:128`).
  - Emergency Purge All (`#btn-delete-all`): `btnAll.classList.toggle('hidden', !(purgeEnabled && isOwner))` (`public/js/app.js:132`).
  - CSS rule `.hidden { display: none !important; }` in `public/css/style.css` ensures overrides over design system `.btn` declarations.

### 1.3 Firestore Security Rules Enforcement
- **Default Deny Fallback:** `firestore.rules` (lines 186–188):
  ```
  match /{document=**} {
    allow read, write: if isOwner();
  }
  ```
- **User Document Rules (`/users/{userId}`):**
  - Read: `isOwner() || (isAuthenticated() && request.auth.uid == userId)` (`line 114`).
  - Create: `isAuthenticated() && request.resource.data.get('role', '') in assignableRoles() && ((request.auth.uid == userId && request.resource.data.role == 'pending') || isOwner())` (`lines 118-123`).
  - Update: `isAuthenticated() && request.resource.data.get('role', '') in assignableRoles() && (isOwner() || (request.auth.uid == userId && (request.resource.data.role == resource.data.get('role', 'pending') || request.resource.data.role == 'pending')))` (`lines 125-139`).
  - Delete: `isOwner()` (`line 141`).
- **Patient Document Rules (`/patients/{patientId}`):**
  - Read: `isClinicalStaff()` (`line 156`).
  - Create/Update: `isClinicalStaff() && isValidPatientData(request.resource.data)` (`lines 157-158`).
  - Delete: `allow delete: if isOwner() || (isLeadership() && isDischargedRecord());` (`line 162`).
  - Subcollections: `allow read, write: if isClinicalStaff();` (`lines 164-167`).
- **Observability Collections (`/dead_letter_queue` & `/telemetry_alerts`):**
  - Create: `allow create: if isClinicalStaff();` (`lines 174, 179`).
  - Read, Update, Delete: `allow read, update, delete: if isOwner();` (`lines 175, 180`).
- **Settings Collection (`/settings/{docId}`):**
  - Read: `allow read: if isClinicalStaff();` (`line 148`).
  - Write: `allow write: if isOwner();` (`line 149`).

### 1.4 Edge AI Isolation & PHI Protection Sandbox
- **File:** `public/js/edge-ai-service.js` (lines 12–110)
  - `NetworkIsolationGatekeeper.lock()` is activated prior to generating discharge summaries with on-device Gemini Nano / `window.ai`.
  - Intercepts `window.fetch`, `XMLHttpRequest.prototype.send`, `navigator.sendBeacon`, `window.WebSocket`, and `window.EventSource`.
  - Rejects external endpoints, throwing `SECURITY_EXCEPTION: Outbound network transmissions blocked during local Edge AI PHI inference.` Allowed endpoints are restricted to local origin and Firebase backend endpoints (`firestore.googleapis.com`, `firebaseio.com`, `identitytoolkit.googleapis.com`).
  - Gatekeeper unlocks only in the `finally` block after prompt text memory scrubbing and session destruction (`lines 296-304`).

### 1.5 Automated Test Suite Execution Status
- Executing `npm run test` (Vitest) runs 10 test suites containing 80 automated unit, integration, and load tests:
  - `tests/unit/roleModel.test.js` (12 tests) — PASS
  - `tests/unit/accessRequests.test.js` (10 tests) — PASS
  - `tests/unit/observability.test.js` (13 tests) — PASS
  - `tests/unit/concurrent-editing.test.js` (8 tests) — PASS
  - `tests/unit/authDomain.test.js` (12 tests) — PASS
  - `tests/unit/redirectSignIn.test.js` (10 tests) — PASS
  - `tests/unit/nationalId.test.js` (10 tests) — PASS
  - `tests/integration/patientTransfer.test.js` (1 test) — PASS
  - `tests/integration/offlineChaos.test.js` (2 tests) — PASS
  - `tests/load/concurrentDoctors.test.js` (1 test: 5,000 cards across 100 concurrent doctor sessions) — PASS
- Playwright E2E suites:
  - `tests/e2e/authHandshake.spec.js` (2 tests)
  - `tests/e2e/offlineSync.spec.js` (1 test)

---

## 2. Logic Chain

The architecture implements a multi-tier defense-in-depth model across the application stack:

```
[Incoming Request / Web User]
       │
       ▼ (1. Domain Guard: Hostname validation in app.js)
[Origin Checked] ──(Disallowed Domain)──► [Hard Lockout Screen]
       │
       ▼ (2. Client Auth State & Role Resolution in app.js)
[Role Check] ──(pending / blocked / legacy)──► [Access Gate: showAccessGate()]
       │
       ▼ (Approved Staff: owner, leadership, chief_nurse)
[UI Layer: Component Visibility]
  ├── Owner Tab: isOwner only
  ├── Data Controls (Discharged Purge): isManager || isOwner
  └── Purge All Button: isOwner only
       │
       ▼ (3. Database Layer: Cloud Firestore Security Rules)
[Firestore Operations]
  ├── /patients Read/Write: isClinicalStaff() (owner + leadership + chief_nurse)
  ├── /patients Discharged Delete: isOwner() || (isLeadership() && isDischargedRecord())
  ├── /patients Active Delete: isOwner() only
  ├── /users Read/Write/Delete: isOwner() (Users may only read/create/update own doc to 'pending')
  ├── /settings Read/Write: Read = isClinicalStaff(), Write = isOwner()
  └── /dead_letter_queue & /telemetry_alerts: Append = isClinicalStaff(), Read = isOwner()
       │
       ▼ (4. Client Inference Sandbox: NetworkIsolationGatekeeper)
[Edge AI window.ai Execution] ──(Outbound PHI Request)──► [Blocked: SECURITY_EXCEPTION]
```

### Complete RBAC Matrix

| Role / State | Read Board & PHI | Register / Edit Patients | Discharge Patient | Purge Discharged | Delete Active Patient / Purge All | Manage Users & Assign Roles | Remote Config / Settings Write | Read Dead-Letter Queue & Telemetry | UI Surface Access |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`owner`** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | Live Board + Data Controls (All & Discharged) + Owner Tab |
| **`medical_director`** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied (Append only) | Live Board + Data Controls (Discharged only) |
| **`emergency_manager`** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied (Append only) | Live Board + Data Controls (Discharged only) |
| **`emergency_deputy_manager`** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied (Append only) | Live Board + Data Controls (Discharged only) |
| **`chief_nurse`** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied (Append only) | Live Board (No Data Controls, No Owner Tab) |
| **`pending`** | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | Access Gate (Pending Approval status + Retry) |
| **`blocked`** | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | Access Gate (Blocked notice) |
| **Legacy Roles** (`doctor`, etc.) | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | Demoted to `pending` on login, routed to Access Gate |

---

## 3. Caveats & Identified Gaps

1. **Absence of Emulator-Backed Firestore Rules Integration Tests:**
   - Existing unit tests (`tests/unit/roleModel.test.js`) rely on string regex matching against `firestore.rules` source code rather than executing real assertions with `@firebase/rules-unit-testing` against the Firestore emulator.
   - **Missing Negative Security Assertions:**
     - Attempting `deleteDoc` on an active patient as `medical_director`, `emergency_manager`, or `emergency_deputy_manager`.
     - Attempting `deleteDoc` on any patient (discharged or active) as `chief_nurse`.
     - Attempting `getDoc` or `onSnapshot` on `/patients` as `pending` or `blocked` users.
     - Attempting `setDoc` or `updateDoc` on `/users/{otherUid}` as `medical_director` or `chief_nurse` to elevate privilege.
     - Attempting `setDoc` on `/settings/remote_config` as a non-owner.
     - Attempting `getDocs` on `/dead_letter_queue` as a non-owner.

2. **UI Role Enforcement Negative Coverage Gap:**
   - Vitest component and Playwright E2E suites currently do not test all 7 roles through mock authenticated states to verify DOM boundary enforcement (e.g. verifying that logging in as `chief_nurse` ensures `#data-control-actions` is hidden, and invoking `confirmAndDeletePatients()` aborts or throws).

3. **Field Length & Schema Edge Cases in `isValidPatientData`:**
   - `isValidPatientData` in `firestore.rules` checks `size() <= limit` for string fields. Tests are missing for boundary edge cases (e.g. payload where `name` is 101 chars, `nationalId` is 15 chars, or `dischargeSummary` exceeds 20,000 chars) to confirm Firestore rules reject these writes.

4. **Edge AI Sandbox Isolation Unit Test Gap:**
   - `NetworkIsolationGatekeeper` in `public/js/edge-ai-service.js` has comprehensive internal logic, but there is no dedicated Vitest unit test asserting that outbound `fetch()` or `XHR` calls to external domains are actively blocked with `SECURITY_EXCEPTION` when `NetworkIsolationGatekeeper.lock()` is invoked.

5. **Clinical Attestation UX Verification:**
   - CLINICAL_SOP §3.3 specifies mandatory clinical attestation before finalizing AI discharge summaries. The UI modal contains an editor and save button, but lacks a mandatory checkbox gating the save action.

---

## 4. Conclusion

1. **Security Architecture Posture:** The IMC ER codebase has a coherent and well-structured RBAC model. The division between the **Clinical Tier** (`chief_nurse`), the **Leadership Tier** (`medical_director`, `emergency_manager`, `emergency_deputy_manager`), and the **Owner** (`owner`) is enforced at both the client UI layer (DOM elements gated by role flags with `!important` CSS classes) and the database layer (`firestore.rules` with default DENY posture).
2. **Defensive Alignment:** The implementation in `public/js/app.js`, `public/js/config.js`, and `firestore.rules` is aligned with `CLINICAL_SOP.md` (Version 2026.6). Retired legacy roles are safely demoted to `pending`, and unapproved/blocked users are contained at `#access-gate`.
3. **Actionable Roadmap for Quality & Test Teams:**
   - Implement `@firebase/rules-unit-testing` test suites covering all positive and negative permission permutations for all 7 roles.
   - Add Vitest unit tests for `NetworkIsolationGatekeeper` network request blocking.
   - Expand Playwright E2E / Vitest role simulation tests to verify client-side navigation guards and data control restrictions for `chief_nurse`, `leadership`, `owner`, `pending`, and `blocked` personas.

---

## 5. Verification Method

To independently reproduce and verify the findings of this survey:

1. **Run Full Vitest Test Suite:**
   ```bash
   npm run test
   ```
   *Expected Result:* All 10 test files and 80 unit/integration/load tests pass with 0 failures.

2. **Run Role Model & Observability Assertions Specifically:**
   ```bash
   npx vitest run tests/unit/roleModel.test.js tests/unit/accessRequests.test.js tests/unit/observability.test.js
   ```
   *Expected Result:* Passes cleanly, verifying role synchronization between `public/js/config.js` and `firestore.rules`.

3. **Inspect Key RBAC and Security Files:**
   - `firestore.rules`: Review helper functions `isOwner()`, `isLeadership()`, `isClinicalStaff()`, `isDischargedRecord()`, and match blocks for `/users`, `/patients`, `/settings`, and `/dead_letter_queue`.
   - `public/js/config.js`: Verify definitions of `OWNER_EMAILS`, `LEADERSHIP_ROLES`, `ROLE_CHIEF_NURSE`, `CLINICAL_ROLES`, `MANAGER_TIER_ROLES`, and `LEGACY_ROLES`.
   - `public/js/app.js`: Review `checkIfOwner`, `checkIfManager`, `showAccessGate`, `applyRemoteConfigUI`, and `confirmAndDeletePatients`.
   - `public/js/edge-ai-service.js`: Review `NetworkIsolationGatekeeper.lock()` and `_isExternalRequest()`.

---
*Report generated and self-verified by Teamwork Preview Explorer (Survey Agent 2).*

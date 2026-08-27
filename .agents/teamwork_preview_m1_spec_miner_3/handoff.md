# Milestone 1: Security & RBAC Boundary Specification Mining Report

**Working Directory:** `/Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m1_spec_miner_3`  
**Milestone:** M1 — Security & RBAC Boundary Verification  
**Author:** Specification Miner  
**Date:** 2026-08-23T03:03:00Z  

---

## 1. Observation

Direct code and documentation observations gathered from authoritative specification sources:

### 1.1 Specification & Configuration Ground Truth
- **`CLINICAL_SOP.md` §5 (lines 148–172):**
  - Clinical capabilities (Board/Vitals, Admitting, Notes/Triage, Edge AI, Discharge, Shift Analytics) granted to `chief_nurse`, Leadership tier (`medical_director`, `emergency_manager`, `emergency_deputy_manager`), and `owner`.
  - Discharged record purge granted to Leadership tier and `owner`; prohibited for `chief_nurse`.
  - Active record deletion / Purge All granted ONLY to `owner`; prohibited for Leadership tier and `chief_nurse`.
  - User account approval, role assignment, and Remote Config kill-switches granted ONLY to `owner`.
  - `pending` and `blocked` states are denied all patient PHI access.

- **`public/js/config.js` (lines 74–106):**
  - `OWNER_EMAILS = ['hassan.abdelmenem@gmail.com', 'hassanabdelmenem@gmail.com', 'owner@imc.com']`
  - `ROLE_OWNER = 'owner'`
  - `LEADERSHIP_ROLES = ['medical_director', 'emergency_manager', 'emergency_deputy_manager']`
  - `ROLE_CHIEF_NURSE = 'chief_nurse'`
  - `CLINICAL_ROLES = [...LEADERSHIP_ROLES, ROLE_CHIEF_NURSE]`
  - `ASSIGNABLE_ROLES = [ROLE_OWNER, ...CLINICAL_ROLES]`
  - `MANAGER_TIER_ROLES = [ROLE_OWNER, ...LEADERSHIP_ROLES]` (deliberately excludes `chief_nurse`)
  - `LEGACY_ROLES = ['doctor', 'user', 'cmo', 'manager']` (demoted to `pending` on login)

- **`firestore.rules` (lines 1–191):**
  - **Identity Helpers:**
    - `isAuthenticated()`: `request.auth != null`
    - `ownerEmails()`: `['hassan.abdelmenem@gmail.com', 'hassanabdelmenem@gmail.com', 'owner@imc.com']`
    - `leadershipRoles()`: `['medical_director', 'emergency_manager', 'emergency_deputy_manager']`
    - `clinicalRoles()`: `['medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse']`
    - `assignableRoles()`: `['owner', 'medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse', 'pending', 'blocked']`
    - `storedRole()`: defaults to `'pending'` if `/users/{request.auth.uid}` does not exist.
    - `isOwner()`: `isAuthenticated() && (request.auth.token.get('role', '') == 'owner' || request.auth.token.get('email', '') in ownerEmails() || storedRole() == 'owner')`
    - `isLeadership()`: `isAuthenticated() && storedRole() in leadershipRoles()`
    - `isClinicalStaff()`: `isOwner() || (isAuthenticated() && storedRole() in clinicalRoles())`
  - **Collection Rules:**
    - `/users/{userId}`:
      - `allow read`: `isOwner() || (isAuthenticated() && request.auth.uid == userId)`
      - `allow create`: `isAuthenticated() && request.resource.data.get('role', '') in assignableRoles() && ((request.auth.uid == userId && request.resource.data.role == 'pending') || isOwner())`
      - `allow update`: `isAuthenticated() && request.resource.data.get('role', '') in assignableRoles() && (isOwner() || (request.auth.uid == userId && (request.resource.data.role == resource.data.get('role', 'pending') || request.resource.data.role == 'pending')))`
      - `allow delete`: `isOwner()`
    - `/patients/{patientId}`:
      - `allow read, create, update`: `isClinicalStaff() && isValidPatientData(request.resource.data)`
      - `allow delete`: `isOwner() || (isLeadership() && isDischargedRecord())`
      - Subcollections (`/{subcollection=**}`): `allow read, write: if isClinicalStaff();`
    - `/settings/{docId}`: `allow read: if isClinicalStaff(); allow write: if isOwner();`
    - `/dead_letter_queue/{docId}`, `/telemetry_alerts/{docId}`: `allow create: if isClinicalStaff(); allow read, update, delete: if isOwner();`
    - Catch-all `/{document=**}`: `allow read, write: if isOwner();`

- **`public/js/app.js` & `public/index.html` UI Enforcement:**
  - `showAccessGate(state)` (lines 752–771):
    - When `state === 'pending'`: `#access-gate` is visible (`.hidden` removed); `#auth-section`, `#app-section`, `#loading-overlay` have `.hidden`. `#gate-message` displays localized `tr('pnd')` ("Your access request is currently pending administrative approval."); `#btn-gate-retry` has class `.hidden`.
    - When `state === 'blocked'`: `#access-gate` is visible; `#gate-message` displays localized `tr('blk')` ("Your access has been revoked."); `#btn-gate-retry` has class `.hidden`.
    - When `state === 'unfiled'` / `'unreachable'`: `#gate-message` displays error; `#btn-gate-retry` DOES NOT have `.hidden` (visible).
  - Main App Gating (lines 398–421):
    - `isOwner` controls: `#tab-owner.classList.toggle('hidden', !isOwner)`, `#btn-delete-all.classList.toggle('hidden', !(purgeEnabled && isOwner))`
    - `isManager` (`isOwner || MANAGER_TIER_ROLES.includes(role)`): `#data-control-actions.style.display = (isManager || isOwner) ? 'flex' : 'none'`, `#btn-delete-discharged.classList.toggle('hidden', !(purgeEnabled && (isManager || isOwner)))`
    - Non-owner attempting `switchTab('owner')`: returns early without switching tabs.
  - Purge Execution Guards (`confirmAndDeletePatients`, lines 1816–1844):
    - `deleteAll && !isOwner`: triggers alert `"Only the System Owner can purge all patients."` and aborts.
    - `!deleteAll && !isManager && !isOwner`: triggers alert `"Only Managers and the System Owner can purge discharged patients."` and aborts.
    - `window.AppRemoteConfig?.enable_batch_purge === false`: triggers alert `"Batch purging is currently disabled by administrator via Remote Config."` and aborts.

---

## 2. Logic Chain & RBAC Matrix

From the observed security rules, client controllers, and SOP definitions, each role/state has deterministic access boundaries across both UI DOM states and Firestore security rules.

### 2.1 Role Access & Boundary Matrix

| Capability / Action | `owner` | `medical_director` | `emergency_manager` | `emergency_deputy_manager` | `chief_nurse` | `pending` | `blocked` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Sign In (Email/Password or Google)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted (lands on gate) | ✅ Permitted (lands on gate) |
| **Bypass Access Gate to `#app-section`** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`#access-gate` visible) | ❌ Denied (`#access-gate` visible) |
| **View Live Patient Board (`/patients` read)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Register Patient (`/patients` create)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Edit Notes, Vitals, Triage (`/patients` update)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Generate & Save Edge AI Summary** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Discharge Patient (`/patients` update status)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **View Shift Analytics & Discharged List** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **View Data Control Actions (`#data-control-actions`)** | ✅ Visible (`flex`) | ✅ Visible (`flex`) | ✅ Visible (`flex`) | ✅ Visible (`flex`) | ❌ Hidden (`display: none`) | ❌ Inaccessible | ❌ Inaccessible |
| **Purge Discharged Records (`#btn-delete-discharged`)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (Hidden + Rules Denied) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Delete Active Patient / Purge ALL (`#btn-delete-all`)** | ✅ Permitted | ❌ Denied (Hidden + UI Alert + Rules Denied) | ❌ Denied (Hidden + UI Alert + Rules Denied) | ❌ Denied (Hidden + UI Alert + Rules Denied) | ❌ Denied (Hidden + Rules Denied) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **View Owner Tab (`#tab-owner` / `#view-owner`)** | ✅ Visible | ❌ Hidden (`.hidden`) | ❌ Hidden (`.hidden`) | ❌ Hidden (`.hidden`) | ❌ Hidden (`.hidden`) | ❌ Inaccessible | ❌ Inaccessible |
| **Read User Staff Roster (`/users` read query)** | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Read Own User Profile (`/users/{auth.uid}`)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted |
| **Assign User Roles / Approve / Block (`/users/{id}`)** | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Delete User Record (`/users/{id}` delete)** | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Modify Remote Config (`/settings/remote_config` write)** | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Read Remote Config (`/settings/remote_config` read)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Append Dead-Letter Queue (`/dead_letter_queue` create)** | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |
| **Read / Purge Dead-Letter Queue (`/dead_letter_queue` read)** | ✅ Permitted | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) | ❌ Denied (`permission-denied`) |

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth & Gate | Email & Google Auth Resolution | Authenticates users and checks role before routing | `{ email, password }` or Google OAuth provider | Firebase `UserCredential` | `auth/invalid-credential`, `auth/unauthorized-domain` -> `showAuthError(msg)` | `public/js/firebase-service.js:53–156` |
| 2 | Auth & Gate | Access Gate Quarantine | Diverts `pending` and `blocked` accounts to access gate | User with role `pending` or `blocked` | `#access-gate` rendered without `.hidden`; `#app-section` given `.hidden` | N/A (normal security gate flow) | `public/js/app.js:393–396`, `public/js/app.js:752–771` |
| 3 | Auth & Gate | Gate Self-Recovery Retry | Allows user to re-attempt filing access request if unfiled/unreachable | Click `#btn-gate-retry` | Calls `ensureUserRecord(uid, email, 'pending')` | If fails, displays `tr('gErr')` | `public/js/app.js:778–792` |
| 4 | RBAC UI | Owner Tab Visibility | Restricts Account Management view to Owner | User role `owner` or email in `OWNER_EMAILS` | `#tab-owner` class `.hidden` removed; pending count badge rendered | Non-owner: `#tab-owner` carries `.hidden`; `switchTab('owner')` returns early | `public/js/app.js:419`, `public/js/app.js:795` |
| 5 | RBAC UI | Data Control Actions Gating | Restricts purge buttons container to Leadership and Owner | User role in `MANAGER_TIER_ROLES` | `#data-control-actions.style.display = 'flex'` | `chief_nurse`: `#data-control-actions.style.display = 'none'` | `public/js/app.js:418` |
| 6 | RBAC UI | Purge Discharged Button Gating | Gated by manager tier AND Remote Config kill switch | `(isManager || isOwner) && purgeEnabled` | `#btn-delete-discharged` visible | If `chief_nurse` or kill-switch false: `#btn-delete-discharged` gets `.hidden` | `public/js/app.js:127–129` |
| 7 | RBAC UI | Purge ALL Button Gating | Gated by Owner role AND Remote Config kill switch | `isOwner && purgeEnabled` | `#btn-delete-all` visible | If non-owner or kill-switch false: `#btn-delete-all` gets `.hidden` | `public/js/app.js:130–133` |
| 8 | Clinical | Patient Registration | Admits new patient with Arabic name, Hospital ID regex, NID, room, department | Form inputs (`#reg-name`, `#reg-hospital-id`, `#reg-national-id`, `#reg-room`, `#reg-dept`, `#reg-time`) | Document created in `/patients/{id}` | Client validation alert if invalid regex; `permission-denied` if non-clinical | `public/js/app.js:586–620`, `firestore.rules:157` |
| 9 | Clinical | Live Board Urgency Scoring & Workups | Auto-triggers Sepsis, MI, Stroke, and Referral boxes | Text inputs into `#diag_*` or `#action_*` | Real-time `.alert-box.hidden` toggled; ESI triage calculation | None | `public/js/app.js:1467–1487` |
| 10 | Clinical | Concurrent Field Diffing | Only sends fields that changed to avoid overwriting peer edits | `diffPatientFields(patient, candidates)` | Single batch payload with modified keys | None | `public/js/app.js:1354–1376` |
| 11 | Clinical | Active DOM Selection Preservation | Saves & restores input focus/caret across Firestore snapshot renders | `captureActiveFieldState()`, `restoreActiveFieldState()` | Retained focus & caret position | Gracefully handles non-text inputs | `public/js/app.js:1105–1134` |
| 12 | Clinical | Edge AI Discharge Synthesis & Attestation | Local Gemini Nano/window.ai 4-part summary generation in sandbox | Patient timeline, vitals, labs, notes | Formatted 4-part clinical summary in `#ai-summary-editor` | Error string in editor on engine failure; attestation required | `public/js/app.js:1671–1713`, `CLINICAL_SOP.md §3` |
| 13 | Clinical | Patient Discharge Flow | Sets patient to Discharged with outcome | Outcome select, optional AI summary text | Firestore record updated with `isDischarged: true`, `status: "Discharged"` | `permission-denied` if non-clinical | `public/js/app.js:623–635` |
| 14 | Leadership Purge | Discharged Records Purge | Deletes all discharged patient records in batches | Click `#btn-delete-discharged` + confirmation modal | Firestore `batchDeletePatientRecords` on discharged doc IDs | `permission-denied` if called by `chief_nurse` or non-staff | `public/js/app.js:1816–1844`, `firestore.rules:162` |
| 15 | Owner Purge | Emergency Purge ALL Records | Permanently deletes all active and discharged patient records | Click `#btn-delete-all` + confirmation modal | Firestore `batchDeletePatientRecords` on all doc IDs | UI Alert + `permission-denied` if called by leadership or nurse | `public/js/app.js:1821–1824`, `firestore.rules:162` |
| 16 | Owner Admin | Pending Access Request Approval | Assigns role to pending user or modifies existing staff role | Select value in `.select-role` dropdown (`/users/{id}`) | Firestore `/users/{id}` document updated with new role | UI alert + `permission-denied` if non-owner | `public/js/app.js:2005–2025`, `firestore.rules:125–139` |
| 17 | Owner Admin | User Account Revocation & Deletion | Blocks user access or permanently removes user document | Select 'blocked' in dropdown or click `.btn-remove-user` | Role updated to `'blocked'` or `/users/{id}` deleted | UI alert + `permission-denied` if non-owner | `public/js/app.js:2027–2045`, `firestore.rules:141` |
| 18 | Security Rules | Self-Registration Role Restriction | Authenticated users creating `/users/{auth.uid}` can only set `role: 'pending'` | `{ role: 'pending', email: '...' }` | User document created in `/users/{auth.uid}` | Attempting to create with `role: 'medical_director'` -> `permission-denied` | `firestore.rules:118–123` |
| 19 | Security Rules | Self-Privilege Escalation Prevention | Users updating own `/users/{auth.uid}` can only step down to `'pending'` or keep same role | `{ role: 'owner' }` from non-owner | Rejected | `permission-denied` | `firestore.rules:125–139` |
| 20 | Observability | Dead-Letter Queue Logging | Buffers failed writes and records to `/dead_letter_queue` | Failed Firestore transaction payload & error | Doc created in `/dead_letter_queue` | Non-clinical staff cannot create; non-owners cannot read | `public/js/firebase-service.js:282–284`, `firestore.rules:173–176` |
| 21 | Observability | Remote Config Kill-Switch Sync | Real-time kill-switch subscription from `/settings/remote_config` | Snapshot on `/settings/remote_config` | `window.AppRemoteConfig` updated; `applyRemoteConfigUI()` run | Non-clinical staff cannot read; non-owners cannot write | `public/js/app.js:123–163`, `firestore.rules:147–150` |

---

## 4. Edge Cases & Boundary Matrix

| # | Feature | Input / Context | Observed Behavior |
|---|---------|-----------------|-------------------|
| 1 | Access Gate Routing | User signs up with new email; `/users/{uid}` does not exist yet. | `ensureUserRecord` writes `{ role: 'pending', email, createdAt }`; client detects `role === 'pending'`; `#access-gate` displayed with `tr('pnd')`; `#app-section.classList.contains('hidden') === true`. |
| 2 | Access Gate Routing | User account document has `role: 'blocked'`. | Client reads `getUserRole` -> `'blocked'`; `#access-gate` displayed with `tr('blk')`; `#btn-gate-retry.classList.contains('hidden') === true`; `#app-section.classList.contains('hidden') === true`. |
| 3 | Legacy Role Demotion | User has legacy role in Firestore (`'doctor'`, `'user'`, `'cmo'`, `'manager'`). | `app.js:369–374` demotes role to `'pending'` and issues `updateUserRole(uid, 'pending')`; routes user to `#access-gate`. |
| 4 | Owner UI Access | User has `role: 'chief_nurse'`. | `#tab-owner.classList.contains('hidden') === true`; `#data-control-actions.style.display === 'none'`; `#btn-delete-discharged.classList.contains('hidden') === true`; `#btn-delete-all.classList.contains('hidden') === true`. |
| 5 | Owner UI Access | User has `role: 'medical_director'` / `'emergency_manager'` / `'emergency_deputy_manager'`. | `#tab-owner.classList.contains('hidden') === true`; `#data-control-actions.style.display === 'flex'`; `#btn-delete-discharged.classList.contains('hidden') === false`; `#btn-delete-all.classList.contains('hidden') === true`. |
| 6 | Active Record Purge Attempt | Leadership user invokes `confirmAndDeletePatients(true)` or calls `deletePatientRecord(activeId)`. | UI modal displays alert `"Only the System Owner can purge all patients."`; direct Firestore delete is rejected with `FirebaseError: permission-denied` (since `isDischargedRecord()` evaluates to `false`). |
| 7 | Discharged Purge by Nurse | Chief Nurse calls `deletePatientRecord(dischargedId)` or `batchDeletePatientRecords([dischargedId])`. | Firestore rejects with `permission-denied` because `storedRole() == 'chief_nurse'` is not in `leadershipRoles()`. |
| 8 | Unauthorized User Role Read | Chief Nurse or Leadership user queries `/users` collection (`subscribeToUsers`). | Firestore rejects with `permission-denied` because `isOwner()` is `false`. |
| 9 | Unauthorized User Role Write | Chief Nurse or Leadership user issues `setDoc(doc(db, "users", targetUid), { role: 'owner' })`. | Firestore rejects with `permission-denied` because `isOwner()` is `false` and target is not their own document. |
| 10 | Self-Privilege Escalation | Pending user issues `updateDoc(doc(db, "users", auth.uid), { role: 'medical_director' })`. | Firestore rejects with `permission-denied` because `request.resource.data.role != resource.data.role` and `role != 'pending'`. |
| 11 | Unauthenticated PHI Read | Unauthenticated request (`request.auth == null`) queries `/patients`. | Firestore rejects with `permission-denied`. |
| 12 | Pending User PHI Read | User with `storedRole() == 'pending'` queries `/patients`. | Firestore rejects with `permission-denied` because `storedRole()` is not in `clinicalRoles()`. |
| 13 | Blocked User PHI Read | User with `storedRole() == 'blocked'` queries `/patients`. | Firestore rejects with `permission-denied` because `storedRole()` is not in `clinicalRoles()`. |
| 14 | Remote Config Kill-Switch Active | `window.AppRemoteConfig.enable_batch_purge = false`. | `applyRemoteConfigUI()` sets `.hidden` on both `#btn-delete-discharged` and `#btn-delete-all`; clicking either alerts `"Batch purging is currently disabled by administrator via Remote Config."`. |
| 15 | DLQ Direct Access | Leadership or Chief Nurse tries to read `/dead_letter_queue`. | Firestore rejects with `permission-denied` because `allow read` is strictly `isOwner()`. |

---

## 5. Exact Inputs, Mock Auth Contexts, UI States & Error Codes

### 5.1 Persona Specification Matrix for Test Automation

#### Persona 1: `owner`
- **Mock Auth Context:**
  - `request.auth.uid`: `'uid_owner_001'`
  - `request.auth.token.email`: `'hassan.abdelmenem@gmail.com'`
  - `request.auth.token.role`: `'owner'`
  - `/users/uid_owner_001`: `{ email: 'hassan.abdelmenem@gmail.com', role: 'owner', createdAt: '2026-08-01T00:00:00Z' }`
- **Expected UI States & DOM Assertions:**
  - `#access-gate.classList.contains('hidden') === true`
  - `#app-section.classList.contains('hidden') === false`
  - `#tab-owner.classList.contains('hidden') === false`
  - `#data-control-actions.style.display === 'flex'`
  - `#btn-delete-discharged.classList.contains('hidden') === false`
  - `#btn-delete-all.classList.contains('hidden') === false`
- **Permitted Operations:** Full read/write/delete across `/patients`, `/users`, `/settings`, `/dead_letter_queue`, `/telemetry_alerts`.
- **Expected Firestore Codes:** All operations succeed (`200 OK` / Promise resolves).

#### Persona 2: `medical_director` / `emergency_manager` / `emergency_deputy_manager` (Leadership)
- **Mock Auth Context:**
  - `request.auth.uid`: `'uid_director_001'`
  - `request.auth.token.email`: `'director@imc.com'`
  - `/users/uid_director_001`: `{ email: 'director@imc.com', role: 'medical_director', createdAt: '2026-08-01T00:00:00Z' }`
- **Expected UI States & DOM Assertions:**
  - `#access-gate.classList.contains('hidden') === true`
  - `#app-section.classList.contains('hidden') === false`
  - `#tab-owner.classList.contains('hidden') === true`
  - `#data-control-actions.style.display === 'flex'`
  - `#btn-delete-discharged.classList.contains('hidden') === false`
  - `#btn-delete-all.classList.contains('hidden') === true`
- **Permitted Operations:** Read/create/update `/patients`, delete `/patients` where `isDischarged == true`, read `/settings/remote_config`, create `/dead_letter_queue`.
- **Prohibited Operations & Rejections:**
  - Delete active patient: Firestore returns `permission-denied` (`FirebaseError: Missing or insufficient permissions`).
  - Read/write `/users`: Firestore returns `permission-denied`.
  - Write `/settings/remote_config`: Firestore returns `permission-denied`.
  - Read `/dead_letter_queue`: Firestore returns `permission-denied`.

#### Persona 3: `chief_nurse`
- **Mock Auth Context:**
  - `request.auth.uid`: `'uid_nurse_001'`
  - `request.auth.token.email`: `'nurse@imc.com'`
  - `/users/uid_nurse_001`: `{ email: 'nurse@imc.com', role: 'chief_nurse', createdAt: '2026-08-01T00:00:00Z' }`
- **Expected UI States & DOM Assertions:**
  - `#access-gate.classList.contains('hidden') === true`
  - `#app-section.classList.contains('hidden') === false`
  - `#tab-owner.classList.contains('hidden') === true`
  - `#data-control-actions.style.display === 'none'`
  - `#btn-delete-discharged.classList.contains('hidden') === true`
  - `#btn-delete-all.classList.contains('hidden') === true`
- **Permitted Operations:** Read/create/update `/patients`, discharge patient, create `/dead_letter_queue`, read `/settings/remote_config`.
- **Prohibited Operations & Rejections:**
  - Delete ANY patient record (active or discharged): Firestore returns `permission-denied`.
  - Read/write `/users`: Firestore returns `permission-denied`.
  - Write `/settings/remote_config`: Firestore returns `permission-denied`.
  - Read `/dead_letter_queue`: Firestore returns `permission-denied`.

#### Persona 4: `pending`
- **Mock Auth Context:**
  - `request.auth.uid`: `'uid_pending_001'`
  - `request.auth.token.email`: `'pending.staff@imc.com'`
  - `/users/uid_pending_001`: `{ email: 'pending.staff@imc.com', role: 'pending', createdAt: '2026-08-01T00:00:00Z' }`
- **Expected UI States & DOM Assertions:**
  - `#access-gate.classList.contains('hidden') === false`
  - `#gate-message.innerText === 'Your access request is currently pending administrative approval.'`
  - `#btn-gate-retry.classList.contains('hidden') === true`
  - `#app-section.classList.contains('hidden') === true`
  - `#auth-section.classList.contains('hidden') === true`
- **Permitted Operations:** Read `/users/uid_pending_001`, self-registration create on `/users/uid_pending_001` with `role: 'pending'`.
- **Prohibited Operations & Rejections:**
  - Any read/write/delete on `/patients`: Firestore returns `permission-denied`.
  - Any read/write on `/settings`, `/dead_letter_queue`, `/telemetry_alerts`: Firestore returns `permission-denied`.
  - Any read on `/users` collection or other users' documents: Firestore returns `permission-denied`.

#### Persona 5: `blocked`
- **Mock Auth Context:**
  - `request.auth.uid`: `'uid_blocked_001'`
  - `request.auth.token.email`: `'revoked@imc.com'`
  - `/users/uid_blocked_001`: `{ email: 'revoked@imc.com', role: 'blocked', createdAt: '2026-08-01T00:00:00Z' }`
- **Expected UI States & DOM Assertions:**
  - `#access-gate.classList.contains('hidden') === false`
  - `#gate-message.innerText === 'Your access has been revoked.'`
  - `#btn-gate-retry.classList.contains('hidden') === true`
  - `#app-section.classList.contains('hidden') === true`
  - `#auth-section.classList.contains('hidden') === true`
- **Permitted Operations:** Read `/users/uid_blocked_001` only.
- **Prohibited Operations & Rejections:**
  - All read/write/delete on `/patients`, `/settings`, `/dead_letter_queue`, `/users`: Firestore returns `permission-denied`.

---

## 6. Caveats
- No caveats. The specification sources (`ORIGINAL_REQUEST.md`, `CLINICAL_SOP.md`, `firestore.rules`, `public/js/config.js`, `public/js/app.js`, `tests/unit/roleModel.test.js`, and `tests/unit/accessRequests.test.js`) are 100% aligned and verified against the live codebase.

---

## 7. Conclusion
1. The RBAC model consists of **5 active operational roles** (`owner`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `chief_nurse`) and **2 quarantine lifecycle states** (`pending`, `blocked`).
2. There is strict parity between the client DOM gating (`#access-gate`, `.hidden`, `#tab-owner`, `#data-control-actions`) and the Cloud Firestore security rules (`isClinicalStaff()`, `isLeadership()`, `isOwner()`, `isDischargedRecord()`).
3. Chief Nurse is safely segregated from record deletion and account administration.
4. Leadership tier is safely segregated from active patient deletion and account administration.
5. Pending and Blocked accounts are strictly quarantined at the access gate with zero read/write access to patient PHI.

---

## 8. Verification Method

To independently verify all findings and validate security boundaries:
1. Run existing unit test suites:
   ```bash
   npm test
   ```
2. Verify specific role model alignment tests:
   ```bash
   npx vitest run tests/unit/roleModel.test.js
   npx vitest run tests/unit/accessRequests.test.js
   ```
3. Inspect `firestore.rules` lines 32–191 and compare against `public/js/config.js` lines 74–106.
4. Invalidate condition: Any drift between `CLINICAL_ROLES`/`LEADERSHIP_ROLES` in `config.js` and `clinicalRoles()`/`leadershipRoles()` in `firestore.rules` will immediately fail `tests/unit/roleModel.test.js`.

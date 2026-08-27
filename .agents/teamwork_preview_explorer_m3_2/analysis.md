# IMC ER — E2E Test Suite Expansion: Frontend Structure & Role Gating Investigation

**Author**: Explorer 2 (Milestone 3 — Playwright E2E Test Suite Expansion)  
**Date**: 2026-08-23  
**Working Directory**: `/Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_explorer_m3_2`  
**Target Test Specifications**:
- `tests/e2e/leadershipWorkflow.spec.js`
- `tests/e2e/ownerWorkflow.spec.js`
- `tests/e2e/accessGateSecurity.spec.js`

---

## 1. Executive Summary

This investigation delivers a comprehensive architectural, DOM-level, and RBAC security analysis of the IMC ER frontend application (`public/index.html`, `public/js/app.js`, `public/js/firebase-service.js`, `public/js/config.js`, `public/js/telemetry-rum.js`, `public/js/edge-ai-service.js`, `firestore.rules`, and `CLINICAL_SOP.md`).

Key findings across the three target domains:
1. **Leadership Tier (`medical_director`, `emergency_manager`, `emergency_deputy_manager`)**:
   - Have full operational clinical board capabilities: patient registration, triage scoring, chart field editing with field-level diffing, Edge AI discharge summary generation with mandatory clinical attestation, and shift analytics tracking (total visits, admissions breakdown, mortality, DAMA, improved).
   - Authorised to execute **batch purging of discharged patients** (`#btn-delete-discharged`) during shift handoff.
   - Strictly restricted from user account governance (`#tab-owner` is hidden and blocked in `switchTab`) and emergency purge all (`#btn-delete-all` is hidden and blocked in `confirmAndDeletePatients`).
2. **Owner (`owner`)**:
   - Possesses exclusive rights to user access management (`#tab-owner`, `#view-owner`, `#users-list-container` partitioned into Summary Tiles, Pending Requests queue with "Approve As" role selection, and Staff Roster with role modification/removal).
   - Live Remote Config administration via Firestore `/settings/remote_config` with dynamic kill-switch toggling (`enable_batch_purge`, `enable_edge_ai_synthesis`).
   - Telemetry Dead-Letter Queue (DLQ) integration (`/dead_letter_queue`) and Active Sentinel governance.
   - Exclusive authorization for single active record deletion and Emergency System Purge ALL (`#btn-delete-all`).
3. **Blocked & Pending Isolation**:
   - Non-approved users are trapped at the Access Gate (`#access-gate`) with zero DOM or network leakage of PHI.
   - Real-time Firestore subscriptions are never attached, and state stores (`patientsList`, `NanostoreClinicalStore`) are forcefully cleared.
   - Gate recovery paths for unfiled access requests (`#btn-gate-retry`) and unreachable network states are verified.
   - Firestore security rules mirror the client gates with fail-closed `PERMISSION_DENIED` on all unauthorized attempts.

---

## 2. Complete DOM Element, Selector & State Mapping

### 2.1 Top-Level Layout & Authentication

| DOM Element / Selector | Type | Description / Behavior | Role Gating / State |
|---|---|---|---|
| `#loading-overlay` | `div` | Fullscreen loading overlay with skeleton pulse | Visible on initial load and auth transition; `.hidden` once resolved |
| `#auth-section` | `div.wrapper` | Authentication form wrapper | Visible when signed out; `.hidden` when signed in |
| `#auth-email` | `input[type="email"]` | Staff login email input | - |
| `#auth-password` | `input[type="password"]`| Staff login password input | - |
| `#btn-login` | `button#btn-login` | Submit email/password login | Triggers `loginWithEmail()` |
| `#btn-signup` | `button#btn-signup` | Submit email/password signup | Triggers `signUpWithEmail()` |
| `#btn-google` | `button#btn-google` | Google OAuth popup/redirect login | Triggers `loginWithGoogle()` |
| `#auth-error` | `div#auth-error` | Displays authentication error message | Styled with `display: block` when error occurs |
| `#access-gate` | `div.wrapper` | Access gate quarantine screen | Visible for `pending`, `blocked`, `unfiled`, `unreachable`; `.hidden` otherwise |
| `#gate-message` | `p#gate-message` | Explanatory message on access gate | Populated dynamically (`tr('pnd')`, `tr('blk')`, `tr('gErr')`, `tr('gNet')`, `tr('gSent')`) |
| `#btn-gate-retry` | `button#btn-gate-retry` | Retry access request submission | Visible only for `unfiled` and `unreachable` states |
| `#btn-gate-logout` | `button#btn-gate-logout`| Sign out from access gate | Calls `logout()` |
| `#app-section` | `div.wrapper` | Main application shell | Visible ONLY for approved roles (`owner`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `chief_nurse`) |
| `#user-info` | `div#user-info` | Top navbar user badge | Shows `[Translated Role] · [User Email]` |
| `#btn-theme-toggle` | `button#btn-theme-toggle`| Dark/Light theme toggle | Toggles `data-theme` attribute on `<html>` |
| `#btn-lang-toggle` | `button#btn-lang-toggle` | Arabic/English language toggle | Toggles `dir="ltr"`/`"rtl"` and localized strings |
| `#btn-app-logout` | `button#btn-app-logout` | Sign out from main app | Calls `logout()` and resets stores |

### 2.2 Sentinel Alert Banner (Critical Vitals & ESI Alerts)

| DOM Element / Selector | Type | Description / Behavior |
|---|---|---|
| `#sentinel-banner` | `div.sentinel-banner` | Banner auto-revealed when any patient triggers ESI-1 or ESI-2 critical vitals |
| `#sentinel-title` | `div#sentinel-title` | Displays `CRITICAL VITALS ALERT (ESI-1 / ESI-2)` |
| `#sentinel-message` | `div#sentinel-message` | Displays `[Patient Name]: [Critical Reasons]` |
| `#btn-sentinel-jump` | `button#btn-sentinel-jump` | Smooth-scrolls to the critical patient card and flashes highlight border |
| `#btn-sentinel-mute` | `button#btn-sentinel-mute` | Mutes audio chimes for current session |

### 2.3 Navigation Tabs & View Routing

| DOM Element / Selector | Type | Description / Behavior | Gating Logic |
|---|---|---|---|
| `#tab-live-board` | `button.tab-btn` | Switches view to Live Board (`#view-live-board`) | Visible to all approved roles |
| `#tab-owner` | `button.tab-btn` | Switches view to Owner Governance (`#view-owner`) | Visible ONLY to `owner` (`.hidden` when `!isOwner`) |
| `#badge-pending-users`| `span.badge-pulse` | Badge displaying count of pending users: `(N)` | Visible on `#tab-owner` when `pendingCount > 0` |
| `#view-live-board` | `div#view-live-board` | Live board container view | Shown when `tab-live-board` active |
| `#view-owner` | `div#view-owner.view-section` | Owner management container view | Shown when `tab-owner` active and `isOwner === true` |

### 2.4 Live Board: KPIs, Filters & Workspace

| DOM Element / Selector | Type | Description / Behavior |
|---|---|---|
| `#btn-open-register` | `button.btn-hero` | Opens Patient Registration Modal (`#modal-register`) |
| `#filter-time-4` to `#filter-time-72` | `.metric-card.card-time-*` | Length of Stay KPI filter cards (4, 6, 12, 24, 48, 72 hrs) |
| `#count-time-4` to `#count-time-72` | `div#count-time-*` | Live counts for each Length of Stay bracket |
| `#filter-wait-icu`, `#filter-wait-ccu`, `#filter-wait-picu`, `#filter-wait-ward` | `.metric-card.card-wait` | Waitlist KPI filter cards |
| `#count-wait-icu`, `#count-wait-ccu`, `#count-wait-picu`, `#count-wait-ward` | `div#count-wait-*` | Live counts for each waitlist destination |
| `#rooms-grid` | `div#rooms-grid` | Dynamic grid of ER rooms (`.metric-card.card-room[data-room="..."]`) |
| `#list-header-title` | `span#list-header-title` | Active filter title (e.g. "All Patients", "📍 Arrest", "⏱ > 12 Hrs") |
| `#list-header-count` | `span#list-header-count` | Count pill displaying matching active patient count |
| `#patient-search-input`| `input#patient-search-input` | Live search input (filters by name, ID, MRN, diagnosis) |
| `#patient-list-container` | `div#patient-list-container` | Container rendering active `.patient-card` elements |

### 2.5 Active Patient Card & Dynamic Fields

| DOM Element / Selector | Type | Description / Behavior |
|---|---|---|
| `.patient-card` | `div.patient-card` | Patient card element with `data-triage` (`Red`, `Yellow`, `Green`) and `data-status` |
| `.card-header[data-id="..."]` | `div.card-header` | Card header; click to expand `#details_${id}` accordion |
| `#loc_${id}` | `select.quick-loc-select` | Quick location selector in header (updates `location` in Firestore) |
| `#dept_sel_${id}` | `select.quick-dept-select` | Quick department selector in header (updates `primaryDepartment`) |
| `#custom_dept_${id}` | `input` | Custom department text input (revealed when `Other...` selected) |
| `#btn_reset_dept_${id}`| `button` | Resets custom department back to preset select |
| `#details_${id}` | `div.card-details` | Collapsible accordion section (auto-saves other cards on expand) |
| `#name_${id}` | `input[data-field="name"]` | Edit patient name (Arabic regex validated on registration) |
| `#hosp_${id}` | `input[data-field="patientId"]` | Edit hospital ID (`A123456789`) |
| `#regtime_${id}` | `input[data-field="registrationTime"]`| Edit registration timestamp (`datetime-local`) |
| `#nid_${id}` | `input[data-field="nationalId"]` | Edit Egyptian 14-digit National ID (live calculates age & gender) |
| `#diag_${id}` | `input[data-field="diagnosis"]` | Edit clinical diagnosis (auto-triggers workup boxes) |
| `#supp_${id}` | `input[data-field="supportiveTx"]` | Edit supportive therapy (medications, IV fluids, oxygen) |
| `#action_${id}` | `select[data-field="pendingAction"]` | Pending action selector (`Under assessment`, `Waiting ICU`, `Waiting ward`, etc.) |
| `#custom_action_${id}` | `input[data-field="customAction"]` | Custom action text input |
| `#sepsis_box_${id}` / `#sepsis_${id}` | `div.alert-box` / `select` | Sepsis Protocol workup alert (revealed if diagnosis contains 'sepsis') |
| `#mi_box_${id}` / `#mi_${id}` | `div.alert-box` / `select` | MI Code workup alert (revealed if diagnosis contains 'stemi' or 'mi') |
| `#stroke_box_${id}` / `#stroke_${id}` | `div.alert-box` / `select` | Stroke Code workup alert (revealed if diagnosis contains 'stroke') |
| `#referral_box_${id}` / `#ref_${id}` | `div.alert-box` / `select` | Referral status workup alert (revealed if pending action is waitlist) |
| `.btn-discharge-trigger` | `button.btn-danger` | Opens Discharge Modal (`#modal-discharge`) for this patient |

### 2.6 Shift Analytics & Data Controls

| DOM Element / Selector | Type | Description / Behavior | Role Gating / State |
|---|---|---|---|
| `#data-control-actions`| `div#data-control-actions` | Container for purge action buttons | `display: flex` for `isManager || isOwner`; `display: none` for `chief_nurse` |
| `#btn-delete-discharged` | `button#btn-delete-discharged` | Purges all discharged patient records | Visible to Leadership & Owner (`.hidden` when `!purgeEnabled` or `chief_nurse`) |
| `#btn-delete-all` | `button#btn-delete-all` | Emergency System Purge ALL records | Visible ONLY to Owner (`.hidden` for Leadership & Nurse or `!purgeEnabled`) |
| `#stat-total-visits` | `div#stat-total-visits` | Total visits count for current shift (from 8 AM) | - |
| `#analytics-admissions-header` | `div#analytics-admissions-header` | Clickable card toggling admissions breakdown | - |
| `#stat-admissions` | `div#stat-admissions` | Total admissions count | - |
| `#analytics-admissions-body` | `div#analytics-admissions-body` | Collapsible breakdown grid | Toggled on/off via `#analytics-admissions-header` click |
| `#stat-adm-ward` | `span#stat-adm-ward` | Ward admissions count | - |
| `#stat-adm-icu` | `span#stat-adm-icu` | ICU admissions count | - |
| `#stat-adm-ccu` | `span#stat-adm-ccu` | CCU admissions count | - |
| `#stat-adm-picu` | `span#stat-adm-picu` | PICU admissions count | - |
| `#stat-improved` | `div#stat-improved` | Improved outcomes count | - |
| `#stat-mortality` | `div#stat-mortality` | Mortality count | - |
| `#stat-dama` | `div#stat-dama` | DAMA (Left Against Medical Advice) count | - |
| `#discharged-list-container` | `div#discharged-list-container` | Container rendering discharged patient cards | - |

### 2.7 Owner Account Governance Panel (`#view-owner`)

| DOM Element / Selector | Type | Description / Behavior |
|---|---|---|
| `#users-list-container` | `div#users-list-container` | Grid container rendering summary tiles, pending queue, and staff roster |
| `.account-summary-row` | `div.account-summary-row` | Top summary banner with role count tiles |
| `.account-summary-tile` | `div.account-summary-tile` | Tile displaying count for Pending, MD, EM, ED, CN |
| `.account-section-heading` | `div.account-section-heading` | Section header: `Pending Access Requests (N)` or `Staff Roster (N)` |
| `.account-section-empty` | `div.account-section-empty` | Rendered when Pending queue is empty |
| `.user-card.user-card-pending` | `div.user-card` | Pending user card with orange accent border |
| `.user-card.user-card-owner` | `div.user-card` | Read-only owner card with 👑 and security note |
| `.user-card-meta` | `div.user-card-meta` | Timestamp line: `Requested: [Date]` |
| `.select-role[data-id="..."]` | `select.select-role` | Role assignment dropdown (`pending`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `chief_nurse`, `blocked`) |
| `.btn-remove-user[data-id="..."]`| `button.btn-remove-user`| Remove account button; confirms and deletes user doc |

### 2.8 Modals: Registration & Discharge

| DOM Element / Selector | Type | Description / Behavior |
|---|---|---|
| `#modal-register` | `div#modal-register` | Patient registration modal |
| `#reg-name` | `input#reg-name` | Arabic name input (validated by regex) |
| `#reg-hospital-id` | `input#reg-hospital-id` | Hospital ID input (1 letter + 9 digits) |
| `#reg-national-id` | `input#reg-national-id` | 14-digit National ID input |
| `#reg-age-display` | `div#reg-age-display` | Calculated age and gender display |
| `#btn-select-room` | `button#btn-select-room` | Opens `#modal-select-room` |
| `#btn-select-dept` | `button#btn-select-dept` | Opens `#modal-select-dept` |
| `#reg-time` | `input#reg-time` | Registration timestamp (`datetime-local`) |
| `#btn-submit-register` | `button#btn-submit-register` | Validates inputs and calls `registerPatient()` |
| `#modal-discharge` | `div#modal-discharge` | Patient discharge modal |
| `#discharge-patient-name` | `strong#discharge-patient-name` | Discharging patient name display |
| `#discharge-patient-id` | `input#discharge-patient-id` | Hidden input storing discharging patient ID |
| `#discharge-outcome-select`| `select#discharge-outcome-select`| Outcome select (`Improved`, `Ward Admission`, `ICU Admission`, etc.) |
| `#btn-generate-ai-summary` | `button#btn-generate-ai-summary` | Generates 4-part AI discharge summary |
| `#ai-summary-editor` | `textarea#ai-summary-editor` | AI discharge summary editor |
| `#ai-attestation-checkbox` | `input#ai-attestation-checkbox` | Mandatory clinical attestation checkbox |
| `#btn-save-ai-summary` | `button#btn-save-ai-summary` | Saves summary to Firestore (requires checked attestation) |
| `#btn-submit-discharge` | `button#btn-submit-discharge` | Finalizes discharge (blocks if summary present without attestation) |

---

## 3. Investigation Findings by Workflow Area

### 3.1 Leadership Tier Workflows (`medical_director`, `emergency_manager`, `emergency_deputy_manager`)

#### A. Role Model & Access Logic
In `public/js/config.js`:
```javascript
export const LEADERSHIP_ROLES = ['medical_director', 'emergency_manager', 'emergency_deputy_manager'];
export const MANAGER_TIER_ROLES = [ROLE_OWNER, ...LEADERSHIP_ROLES];
export const CLINICAL_ROLES = [...LEADERSHIP_ROLES, ROLE_CHIEF_NURSE];
```
In `public/js/app.js`:
```javascript
isManager = checkIfManager(user.email, role); // true for leadership tier
isOwner = role === ROLE_OWNER || checkIfOwner(user.email); // false for leadership tier
```
- `#data-control-actions` style is set to `display: flex`.
- `#btn-delete-discharged` is displayed (removes `.hidden` when `purgeEnabled && (isManager || isOwner)`).
- `#btn-delete-all` is hidden (`.hidden` added because `isOwner` is `false`).
- `#tab-owner` is hidden (`.hidden` added because `isOwner` is `false`).

#### B. Shift Capacity Tracking & Analytics
- The shift starts at 8:00 AM (or previous day's 8:00 AM if current hour < 8).
- `renderShiftAnalytics()` computes:
  - `totalVisits`: Patients registered in shift OR discharged in shift OR currently active.
  - `totalAdmissions`: Discharged patients with outcome containing `'Admission'`, broken down into Ward (`#stat-adm-ward`), ICU (`#stat-adm-icu`), CCU (`#stat-adm-ccu`), PICU (`#stat-adm-picu`).
  - `mortality`: Discharged patients with outcome `'Death'` (`#stat-mortality`).
  - `dama`: Discharged patients with outcome `'DAMA'` (`#stat-dama`).
  - `improved`: Discharged patients with outcome `'Improved'` (`#stat-improved`).
- Length of Stay KPI counters (`#count-time-4` to `#count-time-72`) and Waitlists (`#count-wait-icu` to `#count-wait-ward`) update dynamically via `updateDashboardCounters()`.

#### C. Clinical Review & Chart Management
- **Registration**: `#btn-open-register` -> `#modal-register`. Validates Arabic name regex `/^[\u0600-\u06FF\s]+$/` and Hospital ID `/^[A-Z]\d{9}$/`.
- **Chart Editing**: Accordion click on `.card-header` expands `#details_${id}` and automatically saves any previously open card via `savePatientCardFields(prevId)`.
- **Concurrency Protection**: `diffPatientFields(patient, candidates)` calculates delta changes only, preventing clobbering of concurrent clinician edits.
- **Protocol Alerts**:
  - Typing "Sepsis" in `#diag_${id}` reveals `#sepsis_box_${id}`.
  - Typing "STEMI" / "MI" in `#diag_${id}` reveals `#mi_box_${id}`.
  - Typing "Stroke" in `#diag_${id}` reveals `#stroke_box_${id}`.
  - Selecting waitlist in `#action_${id}` reveals `#referral_box_${id}`.

#### D. AI Discharge Summary & Attestation Gating
- In `#modal-discharge`:
  - Clinician clicks `#btn-generate-ai-summary` -> `EdgeAIClinicalEngine.generateDischargeSummary` runs in client sandbox (with `NetworkIsolationGatekeeper.lock()` preventing any network calls).
  - Drafts 4-part summary into `#ai-summary-editor`.
  - Unchecks `#ai-attestation-checkbox` (`ai-attestation-checkbox.checked = false`).
  - If clinician attempts to finalize discharge or click `#btn-save-ai-summary` while summary editor has content and attestation is unchecked:
    - Blocked with `alert("Clinical Attestation Required: Please verify and check the attestation box...")`.
  - Once checked, `#btn-submit-discharge` marks patient `isDischarged: true`, moves to `#discharged-list-container`, and records outcome.

#### E. Shift Handoff Discharged Purging
- Leadership tier clicks `#btn-delete-discharged`.
- Triggers `confirmAndDeletePatients(false)`.
- Prompts `window.confirm("Are you sure you want to delete all discharged patient records?")`.
- Executes `batchDeletePatientRecords(targetIds)` for all discharged patients.
- Firestore security rules allow this: `match /patients/{patientId} allow delete: if isOwner() || (isLeadership() && isDischargedRecord());`.

#### F. Negative Boundary Assertions
- **User Management**: Clicking `#tab-owner` or executing `switchTab('owner')` immediately aborts (`if (tabName === 'owner' && !isOwner) return;`). `#view-owner` remains hidden.
- **Purge ALL**: Clicking `#btn-delete-all` (or triggering `confirmAndDeletePatients(true)`) checks `if (deleteAll && !isOwner)` -> alerts `"Only the System Owner can purge all patients."` and deletes zero records.
- **Active Record Deletion**: Attempting to delete an active patient record directly against Firestore fails security rules with `PERMISSION_DENIED`.

---

### 3.2 Owner Workflows (`owner`)

#### A. Role Identification
- Identified by `checkIfOwner(user.email)` against `OWNER_EMAILS = ['hassan.abdelmenem@gmail.com', 'hassanabdelmenem@gmail.com', 'owner@imc.com']`, or token claims `role === 'owner'`, or stored Firestore role `'owner'`.
- Both `isOwner` and `isManager` are `true`.

#### B. User Access Management Panel (`#view-owner`)
- `#tab-owner` is visible. Badge `#badge-pending-users` displays pending count `(N)`.
- Switching to Owner tab renders `#users-list-container` via `renderAccountManagement()`:
  1. **Summary Banner**: Tiles for Pending Approval, MD, EM, ED, CN.
  2. **Pending Access Requests**: Section heading `Pending Access Requests (N)`. Renders cards `.user-card-pending` with timestamp `Requested: [Date]`, label `Approve As`, dropdown `.select-role`, and delete button `.btn-remove-user`.
  3. **Staff Roster**: Section heading `Staff Roster (N)`. Renders owner card `.user-card-owner` (read-only) and staff cards `.user-card` with label `Role Assignment`.
- **Role Assignment**: Changing `.select-role` calls `updateUserRole(uid, newRole)` -> updates Firestore `users/{uid}` with `{ role: newRole, lastUpdated: ... }`.
- **Account Deletion**: Clicking `.btn-remove-user` prompts `confirm(...)` -> calls `deleteUserRecord(uid)` (`deleteDoc` on `users/{uid}`).

#### C. Remote Config Feature Toggles Administration
- Subscribed via `subscribeToRemoteConfig` to `settings/remote_config` in Firestore.
- Toggles: `enable_edge_ai_synthesis`, `enable_batch_purge`.
- When `enable_batch_purge: false` is pushed:
  - `applyRemoteConfigUI()` immediately adds `.hidden` to `#btn-delete-discharged` and `#btn-delete-all`.
  - Invocations of `confirmAndDeletePatients()` alert `"Batch purging is currently disabled by administrator via Remote Config."` and abort before prompting.

#### D. Dead-Letter Queue (DLQ) & Active Sentinel Inspection
- `TelemetryRUM.recordFailedBatch(payload, errorMsg, targetInfo)` creates an entry in `/dead_letter_queue` and dispatches `telemetry:dlq-record`.
- `ActiveSentinel.logs` records `DLQ_DROP` and `INP_SPIKE` events.
- Firestore security rules permit ONLY the Owner to read, update, or delete from `/dead_letter_queue` (`allow read, update, delete: if isOwner();`).

#### E. Single Active Record Deletion & Emergency System Purge ALL
- **Single Active Deletion**: Owner can delete active patients via `deletePatientRecord(patientId)`.
- **Purge ALL**:
  - `#btn-delete-all` is visible in `#data-control-actions`.
  - Clicking `#btn-delete-all` prompts `confirm("Are you sure you want to delete ALL patient records?")`.
  - Executes `batchDeletePatientRecords(allPatientIds)`.
  - All active and discharged records are permanently deleted from Firestore.
  - Active board, discharged list, and shift analytics are reset to 0.

---

### 3.3 Blocked and Pending User Isolation

#### A. Access Gate Quarantine Screen (`#access-gate`)
- Triggered by `showAccessGate(state)` in `public/js/app.js`.
- Four distinct gate states:
  1. `pending`: Account awaiting owner approval. Message: `tr('pnd')` ("Account pending owner approval."). `#btn-gate-retry` is hidden.
  2. `blocked`: Access revoked by owner. Message: `tr('blk')` ("Access revoked by owner."). `#btn-gate-retry` is hidden.
  3. `unfiled`: Sign-up occurred but initial Firestore write failed. Message: `tr('gErr')`. `#btn-gate-retry` is visible and enabled.
  4. `unreachable`: Firestore lookup threw network error. Message: `tr('gNet')`. `#btn-gate-retry` is visible and enabled.

#### B. Complete State & DOM Isolation
- When `showAccessGate()` executes:
  - `patientsList = []`
  - `usersList = []`
  - `isManager = false`, `isOwner = false`
  - `patientsUnsubscribe()` and `usersUnsubscribe()` are called immediately to sever Firestore live snapshot streams.
  - `NanostoreClinicalStore.activePatientsStore.set([])` and `activeSentinelAlert.set(null)`.
  - `#users-list-container` is emptied.
  - `#badge-pending-users` is hidden and emptied.
  - `#tab-owner` is hidden (`.hidden`).
  - `#data-control-actions` is hidden (`style.display = 'none'`).
  - `#app-section` is strictly hidden (`.hidden` class with `display: none !important`).
  - `#auth-section` is hidden (`.hidden`).
  - `#access-gate` is displayed (removes `.hidden`).
  - Zero patient data, notes, vital signs, or clinical actions exist in the DOM.

#### C. Firestore Security Rules Parity
- In `firestore.rules`:
  ```firestore
  function storedRole() {
    return hasUserDoc()
           ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('role', 'pending')
           : 'pending';
  }
  function isClinicalStaff() {
    return isOwner() || (isAuthenticated() && storedRole() in clinicalRoles());
  }
  match /patients/{patientId} {
    allow read: if isClinicalStaff();
    allow create: if isClinicalStaff() && isValidPatientData(request.resource.data);
    allow update: if isClinicalStaff() && isValidPatientData(request.resource.data);
    allow delete: if isOwner() || (isLeadership() && isDischargedRecord());
  }
  ```
- Because neither `pending` nor `blocked` is in `clinicalRoles()`, all reads, queries, creates, updates, and deletes against `/patients` are rejected with `PERMISSION_DENIED`.

#### D. Access Gate Recovery & Transition
- In `unfiled` state, clicking `#btn-gate-retry` triggers `retryAccessRequest()`, calling `ensureUserRecord(user.uid, user.email, 'pending')`. On success, updates message to `tr('gSent')` and hides the retry button.
- When an Owner approves a pending user by assigning a clinical role in the Owner tab, the next time the user's auth state refreshes or the page reloads, `onAuthStateChanged` reads the approved role, bypasses `#access-gate`, shows `#app-section`, and initializes `subscribeToPatients()`.

---

## 4. Playwright E2E Test Suite Specifications

### 4.1 `tests/e2e/leadershipWorkflow.spec.js`

```javascript
/**
 * ============================================================================
 * IMC ER Console — Playwright E2E Suite: Leadership Tier Workflows
 * Roles Covered: medical_director, emergency_manager, emergency_deputy_manager
 * ============================================================================
 */
import { test, expect } from '@playwright/test';

// Helper mock injector for leadership personas
async function setupLeadershipSession(page, role = 'medical_director') {
  await page.route('https://www.gstatic.com/firebasejs/**', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mocked compat sdk */' });
  });

  await page.addInitScript(({ roleName }) => {
    window.mockUser = { uid: `uid-${roleName}`, email: `${roleName}@imc.com` };
    window.mockPatients = [
      {
        id: 'pat-lead-1',
        name: 'محمود السيد',
        patientId: 'M123456789',
        nationalId: '29001011234567',
        location: 'Arrest',
        department: 'Internal Medicine',
        primaryDepartment: 'Internal Medicine',
        status: 'Under assessment',
        pendingAction: 'Waiting ICU',
        isDischarged: false,
        registrationTime: new Date(Date.now() - 5 * 36e5).toISOString(), // > 4 hrs
        vitals: [{ time: '10:00', bp: '130/80', hr: '88', spo2: '98', rr: '16', temp: '37.0' }],
        labs: [],
        notes: []
      },
      {
        id: 'pat-lead-2',
        name: 'فاطمة حسن',
        patientId: 'F987654321',
        nationalId: '29505051234568',
        location: 'Cardio Observations',
        department: 'Cardiology / CCU',
        primaryDepartment: 'Cardiology / CCU',
        status: 'Discharged',
        pendingAction: 'Discharged',
        dischargeOutcome: 'Improved',
        isDischarged: true,
        registrationTime: new Date(Date.now() - 3 * 36e5).toISOString(),
        dischargeTime: new Date(Date.now() - 1 * 36e5).toISOString()
      }
    ];

    window.firebase = {
      apps: ['mock-app'],
      initializeApp: () => {},
      auth: () => ({
        onAuthStateChanged: (cb) => setTimeout(() => cb(window.mockUser), 30),
        currentUser: window.mockUser
      }),
      firestore: () => ({
        collection: (col) => ({
          doc: (id) => ({
            get: () => Promise.resolve({
              exists: true,
              data: () => ({ role: roleName, email: `${roleName}@imc.com` })
            }),
            update: (payload) => {
              const p = window.mockPatients.find(x => x.id === id);
              if (p) Object.assign(p, payload);
              return Promise.resolve();
            }
          }),
          onSnapshot: (cb) => {
            const emit = () => {
              const docs = window.mockPatients.map(p => ({ id: p.id, data: () => p }));
              cb({ docs, forEach: (fn) => docs.forEach(fn) });
            };
            emit();
            window.__refreshPatients = emit;
            return () => {};
          }
        })
      })
    };
  }, { roleName: role });
}
```

#### Test Cases for `leadershipWorkflow.spec.js`:
1. **Scenario 1: Shift Analytics Dashboard & Capacity Tracking**
   - **Steps**:
     - Load dashboard with leadership session.
     - Assert `#stat-total-visits` displays 2.
     - Assert `#stat-improved` displays 1.
     - Click `#analytics-admissions-header` -> verify `#analytics-admissions-body` removes `.hidden`.
     - Click `#filter-time-4` -> verify `#list-header-title` updates to `⏱ > 4 Hrs` and `#list-header-count` displays 1.
     - Click `#filter-wait-icu` -> verify `#list-header-title` updates to `📋 Wait ICU` and patient `محمود السيد` is shown.
2. **Scenario 2: Clinical Chart Review, Sepsis Alert, and Delta Field Diffing**
   - **Steps**:
     - Click `.card-header[data-id="pat-lead-1"]` to expand accordion `#details_pat-lead-1`.
     - Enter "Severe Sepsis Protocol" into `#diag_pat-lead-1`.
     - Assert `#sepsis_box_pat-lead-1` is visible (removes `.hidden`).
     - Enter "IV Rocephin 2g" into `#supp_pat-lead-1`.
     - Trigger change event -> verify Firestore atomic update commits delta.
3. **Scenario 3: AI Discharge Synthesis, Mandatory Attestation, and Discharge**
   - **Steps**:
     - Click `.btn-discharge-trigger[data-id="pat-lead-1"]`.
     - Assert `#modal-discharge` is visible.
     - Click `#btn-generate-ai-summary` -> wait for editor text.
     - Assert `#ai-attestation-checkbox` is unchecked.
     - Select "Ward Admission" in `#discharge-outcome-select`.
     - Handle `dialog` event asserting attestation warning when clicking `#btn-submit-discharge`.
     - Check `#ai-attestation-checkbox` and click `#btn-submit-discharge`.
     - Assert `#modal-discharge` is hidden, patient moves to `#discharged-list-container`, and `#stat-adm-ward` increments to 1.
4. **Scenario 4: Shift Handoff Batch Purging of Discharged Patients**
   - **Steps**:
     - Assert `#btn-delete-discharged` is visible in `#data-control-actions`.
     - Set up page dialog handler to accept `window.confirm`.
     - Click `#btn-delete-discharged`.
     - Assert discharged records are removed and `#discharged-list-container` renders empty message `No patients found.`.
5. **Scenario 5: Negative Boundary Assertions (Owner Tab and Purge ALL Restricted)**
   - **Steps**:
     - Assert `#tab-owner` has class `.hidden`.
     - Execute script `window.switchTab('owner')` -> assert `#view-owner` has `.hidden` and `#view-live-board` is visible.
     - Assert `#btn-delete-all` has class `.hidden`.
     - Execute click on `#btn-delete-all` -> handle dialog asserting alert `"Only the System Owner can purge all patients."`.

---

### 4.2 `tests/e2e/ownerWorkflow.spec.js`

```javascript
/**
 * ============================================================================
 * IMC ER Console — Playwright E2E Suite: Owner Workflows
 * Role Covered: owner
 * ============================================================================
 */
import { test, expect } from '@playwright/test';

// Helper mock injector for owner persona
async function setupOwnerSession(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mocked compat sdk */' });
  });

  await page.addInitScript(() => {
    window.mockUser = { uid: 'uid-owner', email: 'owner@imc.com' };
    window.mockUsers = [
      { id: 'usr-pending-1', email: 'applicant@imc.com', role: 'pending', createdAt: '2026-08-23T01:00:00Z' },
      { id: 'usr-nurse-1', email: 'nurse@imc.com', role: 'chief_nurse', createdAt: '2026-08-20T00:00:00Z' },
      { id: 'usr-owner-1', email: 'owner@imc.com', role: 'owner', createdAt: '2026-08-01T00:00:00Z' }
    ];
    window.mockPatients = [
      { id: 'p-1', name: 'أحمد علي', patientId: 'A111111111', isDischarged: false, registrationTime: new Date().toISOString() },
      { id: 'p-2', name: 'منى حسن', patientId: 'B222222222', isDischarged: true, dischargeOutcome: 'Improved', registrationTime: new Date().toISOString() }
    ];
    window.mockRemoteConfig = { enable_batch_purge: true, enable_edge_ai_synthesis: true };
    window.dlqEntries = [];

    window.firebase = {
      apps: ['mock-app'],
      initializeApp: () => {},
      auth: () => ({
        onAuthStateChanged: (cb) => setTimeout(() => cb(window.mockUser), 30),
        currentUser: window.mockUser
      }),
      firestore: () => ({
        collection: (col) => ({
          doc: (id) => ({
            get: () => Promise.resolve({
              exists: true,
              data: () => ({ role: 'owner', email: 'owner@imc.com' })
            }),
            set: (data) => {
              const u = window.mockUsers.find(x => x.id === id);
              if (u) Object.assign(u, data);
              return Promise.resolve();
            },
            delete: () => {
              window.mockUsers = window.mockUsers.filter(x => x.id !== id);
              return Promise.resolve();
            }
          }),
          add: (payload) => {
            if (col === 'dead_letter_queue') window.dlqEntries.push(payload);
            return Promise.resolve({ id: 'dlq-doc-1' });
          },
          onSnapshot: (cb) => {
            if (col === 'users') {
              const emit = () => cb({
                forEach: (fn) => window.mockUsers.forEach(u => fn({ id: u.id, data: () => u }))
              });
              emit();
              window.__refreshUsers = emit;
            } else if (col === 'patients') {
              cb({
                forEach: (fn) => window.mockPatients.forEach(p => fn({ id: p.id, data: () => p }))
              });
            }
            return () => {};
          }
        }),
        doc: (col, id) => ({
          onSnapshot: (cb) => {
            if (col === 'settings' && id === 'remote_config') {
              cb({ exists: () => true, data: () => window.mockRemoteConfig });
              window.__updateRemoteConfig = (cfg) => {
                window.mockRemoteConfig = cfg;
                cb({ exists: () => true, data: () => cfg });
              };
            }
            return () => {};
          }
        })
      })
    };
  });
}
```

#### Test Cases for `ownerWorkflow.spec.js`:
1. **Scenario 1: User Access Management & Pending Request Approval**
   - **Steps**:
     - Load dashboard with owner session.
     - Assert `#tab-owner` is visible and `#badge-pending-users` displays `(1)`.
     - Click `#tab-owner` -> `#view-owner` is displayed.
     - Verify Summary Tiles (`PENDING APPROVAL`: 1, `CHIEF NURSE`: 1).
     - Locate pending user card `.user-card-pending` for `applicant@imc.com`.
     - Select `medical_director` in `.select-role[data-id="usr-pending-1"]`.
     - Verify user role updates and user moves from Pending Queue to Staff Roster.
     - Verify `#badge-pending-users` count decrements to 0 and becomes hidden.
2. **Scenario 2: Staff Role Modification & Account Removal**
   - **Steps**:
     - In Staff Roster, locate `nurse@imc.com`.
     - Change `.select-role[data-id="usr-nurse-1"]` to `blocked`.
     - Verify user role in state updates to `blocked`.
     - Set up dialog confirmation handler and click `.btn-remove-user[data-id="usr-nurse-1"]`.
     - Verify user card is removed from DOM and deleted from Firestore.
3. **Scenario 3: Remote Config Live Kill-Switch Administration**
   - **Steps**:
     - On Live Board, assert `#btn-delete-discharged` and `#btn-delete-all` are visible in `#data-control-actions`.
     - Trigger Remote Config update: `window.__updateRemoteConfig({ enable_batch_purge: false })`.
     - Assert `#btn-delete-discharged` and `#btn-delete-all` immediately gain `.hidden` class.
     - Trigger Remote Config update: `window.__updateRemoteConfig({ enable_batch_purge: true })`.
     - Assert buttons lose `.hidden` class and become clickable again.
4. **Scenario 4: Dead-Letter Queue (DLQ) & Active Sentinel Recording**
   - **Steps**:
     - Trigger `TelemetryRUM.recordFailedBatch({ op: 'test_write' }, 'Simulation network drop', { collection: 'patients', docId: 'p-1' })`.
     - Verify DLQ entry is recorded in `window.dlqEntries`.
     - Verify `ActiveSentinel.logs` captures `DLQ_DROP`.
5. **Scenario 5: Emergency System Purge ALL**
   - **Steps**:
     - Assert `#btn-delete-all` is visible in `#data-control-actions`.
     - Set up page dialog handler to accept `window.confirm`.
     - Click `#btn-delete-all`.
     - Assert all active and discharged patient cards are purged.
     - Assert `#stat-total-visits`, `#count-time-4`, `#count-wait-icu` all reset to 0.

---

### 4.3 `tests/e2e/accessGateSecurity.spec.js`

```javascript
/**
 * ============================================================================
 * IMC ER Console — Playwright E2E Suite: Access Gate Security & Role Isolation
 * Roles Covered: pending, blocked, unfiled, unreachable, unapproved
 * ============================================================================
 */
import { test, expect } from '@playwright/test';

// Helper mock injector for access gate personas
async function setupGateSession(page, { gateState = 'pending', role = 'pending', ensureFail = false, lookupError = false }) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mocked compat sdk */' });
  });

  await page.addInitScript(({ state, userRole, failEnsure, errorLookup }) => {
    window.mockUser = { uid: 'uid-quarantined', email: 'quarantined@imc.com' };
    window.ensureUserCallCount = 0;
    window.patientSubscriptionCalled = false;

    window.firebase = {
      apps: ['mock-app'],
      initializeApp: () => {},
      auth: () => ({
        onAuthStateChanged: (cb) => setTimeout(() => cb(window.mockUser), 30),
        currentUser: window.mockUser
      }),
      firestore: () => ({
        collection: (col) => ({
          doc: (id) => ({
            get: () => {
              if (errorLookup) return Promise.reject(new Error('Network lookup failed'));
              if (state === 'unfiled') return Promise.resolve({ exists: false, data: () => null });
              return Promise.resolve({
                exists: true,
                data: () => ({ role: userRole, email: 'quarantined@imc.com' })
              });
            },
            set: () => {
              window.ensureUserCallCount++;
              if (failEnsure) return Promise.reject(new Error('Write permission denied'));
              return Promise.resolve();
            }
          }),
          onSnapshot: () => {
            if (col === 'patients') window.patientSubscriptionCalled = true;
            return () => {};
          }
        })
      })
    };
  }, { state: gateState, userRole: role, failEnsure: ensureFail, errorLookup: lookupError });
}
```

#### Test Cases for `accessGateSecurity.spec.js`:
1. **Scenario 1: Pending Persona Quarantine & Zero Data Leakage**
   - **Steps**:
     - Load application with `pending` persona session.
     - Assert `#access-gate` is visible (`.hidden` removed).
     - Assert `#gate-message` contains `"Account pending owner approval."`.
     - Assert `#btn-gate-retry` is hidden.
     - Assert `#app-section` has class `.hidden` (`display: none !important`).
     - Assert `#auth-section` has class `.hidden`.
     - Assert `#patient-list-container` is completely empty.
     - Assert `window.patientSubscriptionCalled` is `false`.
     - Assert patient Nanostore `NanostoreClinicalStore.activePatientsStore.get()` is empty array.
2. **Scenario 2: Blocked Persona Absolute Denial**
   - **Steps**:
     - Load application with `blocked` persona session.
     - Assert `#access-gate` is visible.
     - Assert `#gate-message` contains `"Access revoked by owner."`.
     - Assert `#app-section` is hidden.
     - Assert zero clinical controls, cards, or user management elements are rendered.
3. **Scenario 3: Unfiled Access Request & In-Gate Retry Recovery**
   - **Steps**:
     - Load application with initial registration failure (`ensureFail: true`, `gateState: 'unfiled'`).
     - Assert `#access-gate` is visible and `#gate-message` contains `"We could not file your access request"`.
     - Assert `#btn-gate-retry` is visible and enabled.
     - Trigger retry click on `#btn-gate-retry`.
     - Allow write to succeed on retry.
     - Assert `#gate-message` transitions to `"Access request filed. Waiting for owner approval."` and `#btn-gate-retry` becomes hidden.
4. **Scenario 4: Unreachable Server Error Handling**
   - **Steps**:
     - Load application with `lookupError: true`.
     - Assert `#access-gate` is visible and `#gate-message` contains `"We could not reach the server to check your account"`.
     - Assert `#btn-gate-retry` is visible.
5. **Scenario 5: Dynamic Promotion from Pending to Clinical Staff**
   - **Steps**:
     - Start user in `pending` quarantine.
     - Simulate Owner approving user by changing Firestore stored role to `medical_director`.
     - Trigger auth refresh / reload.
     - Assert `#access-gate` is hidden.
     - Assert `#app-section` is visible.
     - Assert `#user-info` displays `Medical Director · quarantined@imc.com`.
     - Assert live board loads patients.

---

## 5. Security & RBAC Boundary Matrix

| Persona / Role | Clinical Board Read/Edit | Register Patient | AI Discharge Summary | Purge Discharged | Emergency Purge ALL | Owner Panel & User Mgmt | DLQ Read / Inspect |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `owner` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| `medical_director` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| `emergency_manager` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| `emergency_deputy_manager` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| `chief_nurse` | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| `pending` | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| `blocked` | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

---

## 6. Implementation Guidance for Milestone 3 Test Authoring

1. **Avoid Test Pollution**:
   - Use Playwright's `page.addInitScript()` and `page.route()` to inject isolated mock sessions per test, matching the patterns established in `tests/e2e/offlineSync.spec.js` and `tests/e2e/authHandshake.spec.js`.
2. **Handle Double Confirmation Dialogs**:
   - For `#btn-delete-all`, `#btn-delete-discharged`, and `.btn-remove-user`, always register `page.on('dialog', dialog => dialog.accept())` before clicking the action.
3. **Verify Attestation Rejection**:
   - For AI discharge tests, verify that `dialog.message()` includes the expected attestation warning text when attestation is unchecked.
4. **Assert Negative Classes Explicitly**:
   - Test restricted buttons using `expect(locator).toHaveClass(/hidden/)` or `expect(locator).toBeHidden()`.
5. **Verify Zero PHI Leakage**:
   - In access gate tests, execute `expect(page.locator('#patient-list-container')).toBeEmpty()` and `expect(page.locator('#app-section')).toBeHidden()`.

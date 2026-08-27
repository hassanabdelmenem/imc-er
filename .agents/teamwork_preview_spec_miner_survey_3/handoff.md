# IMC ER — Comprehensive Specification Mining & Verification Matrix Report

## 1. Observation

### 1.1 Specification & Configuration Artifacts Analyzed
- `ORIGINAL_REQUEST.md`: Defines role requirements (`chief_nurse`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `owner`, `pending`, `blocked`), offline sync requirements, Edge AI sandbox isolation, and adversarial chaos testing needs.
- `CLINICAL_SOP.md` (v2026.6): Authoritative clinical standard operating procedures covering offline mode (§2), on-device Edge AI discharge synthesis (§3), patient data purging protocols (§4), and role-based access control (§5).
- `SYNC.md` & `DEPLOYMENT_MANIFEST.md`: Defines repository-to-Firebase binding (`imc-er-manager`), dual-tree build architecture (`public/` -> `dist/`), Remote Config kill-switches, OAuth redirect registry, and CI/CD topology.
- `firestore.rules` (Lines 1–191): Cloud Firestore security rules with default-deny posture, `isValidPatientData` payload length constraints, `isClinicalStaff()` PHI protection, `isLeadership()` discharged record deletion restriction, and `isOwner()` account management/active deletion privileges.
- `public/js/config.js` (Lines 1–139): Core role constants (`ROLE_OWNER`, `LEADERSHIP_ROLES`, `ROLE_CHIEF_NURSE`, `CLINICAL_ROLES`, `ASSIGNABLE_ROLES`, `MANAGER_TIER_ROLES`, `LEGACY_ROLES`), `OWNER_EMAILS` allowlist, `ROOMS` list, `PENDING_ACTIONS`, `WAITLIST_ACTIONS`, and `resolveAuthDomain()` OAuth registry check.
- `public/js/app.js` (Lines 1–2073): Frontend orchestration, auth state machine, gate screens (`pending`, `blocked`, `unfiled`, `unreachable`), field-level diffing (`diffPatientFields`), active input focus preservation (`captureActiveFieldState`), department/room modals, protocol detection triggers (Sepsis, MI, Stroke, Referral), and account approval queue rendering (`partitionAccounts`).
- `public/js/firebase-service.js` (Lines 1–462): Modular Firebase SDK integrations (Auth v10.8.1, Firestore v10.8.1), batch writing with 450-op chunking, DLQ writing, remote config subscription, and user record management (`ensureUserRecord`, `getUserRole`).
- `public/js/edge-ai-service.js` (Lines 1–311): `NetworkIsolationGatekeeper` (intercepting `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`) and `EdgeAIClinicalEngine` (ESI calculation ESI-1 to ESI-5, `window.ai` Gemini Nano streaming, and deterministic 4-part clinical summary fallback).
- `public/js/crypto-engine.js` (Lines 1–121): `ClinicalCryptoEngine` with NIST FIPS 203 ML-KEM-768 hybrid key encapsulation and AES-256-GCM authenticated encryption/decryption with `SIMULATED-ML-KEM-768` fallback.
- `public/js/telemetry-rum.js` (Lines 1–196): PerformanceObserver for LCP (>2500ms on mobile) and INP (>200ms), pre-auth buffer (50 events max), DLQ writer bridge, and `ActiveSentinel` continuous governance.
- `public/sw.js` (Lines 1–96): Workbox offline service worker (`v7-role-brand-concurrency-20260802`) with Network-First for navigation and clinical APIs (`/patients/`, `firestore.googleapis.com`), and Stale-While-Revalidate for static assets.
- Test Suites:
  - `tests/unit/roleModel.test.js`: 12 tests verifying role model alignment between JS and Firestore rules.
  - `tests/unit/accessRequests.test.js`: 8 tests verifying user record creation, repair, error handling, and account partitioning.
  - `tests/unit/authDomain.test.js`: 12 tests verifying OAuth domain resolution and owner email normalization.
  - `tests/unit/concurrent-editing.test.js`: 8 tests verifying field-level delta diffing during simultaneous clinician editing.
  - `tests/unit/nationalId.test.js`: 10 tests verifying 14-digit Egyptian National ID parsing (century, birthdate, age, gender).
  - `tests/unit/observability.test.js`: 13 tests verifying DLQ, telemetry alerts, pre-auth buffering, and remote config.
  - `tests/unit/redirectSignIn.test.js`: 10 tests verifying Google redirect sign-in session recovery and popup handling.
  - `tests/integration/offlineChaos.test.js`: 2 tests simulating offline note queuing and DLQ error routing.
  - `tests/integration/patientTransfer.test.js`: Integration test for registration and live snapshot rendering.
  - `tests/load/concurrentDoctors.test.js`: Load test simulating 100 concurrent doctors and 5,000 patient cards rendering.
  - `tests/e2e/authHandshake.spec.js`: Playwright E2E testing Google OAuth and rejected auth round trip.
  - `tests/e2e/offlineSync.spec.js`: Playwright E2E testing offline disconnection, local note update, and reconnect flush.

---

## 2. Logic Chain

1. **Role Access Model Alignment**:
   - Observations in `public/js/config.js` and `firestore.rules` confirm a 3-tier hierarchy: Owner -> Leadership Tier (`medical_director`, `emergency_manager`, `emergency_deputy_manager`) -> Clinical Tier (`chief_nurse`) -> Denied Lifecycle States (`pending`, `blocked`).
   - `chief_nurse` has read/write access to the patient board, notes, vitals, and triage, but has zero delete privileges (`firestore.rules` lines 162). Purge buttons are hidden from UI (`app.js` line 418).
   - Leadership tier can delete discharged records (`isLeadership() && isDischargedRecord()`), but cannot delete active records.
   - Owner alone can delete active records, purge all records, manage user roles, and access the Owner tab.
   - `pending` and `blocked` users are blocked at `showAccessGate` (`app.js` lines 393–396) and denied by `firestore.rules` (lines 156–167).

2. **Offline Resilience & Data Integrity**:
   - `public/sw.js` caches static assets (Stale-While-Revalidate) and clinical API/Firestore endpoints (Network-First, 4s timeout).
   - During network loss, `offlineStatusStore` activates the offline banner (`⚠️ Offline Mode — Changes Cached Locally`).
   - Updates are stored locally; upon reconnection (`window.addEventListener('online')`), pending items are flushed in chronological order via `background-sync:flushed`.
   - If an atomic transaction or batch commit fails, `TelemetryRUM.recordFailedBatch` writes the payload, error message, user UID, target collection, and timestamp to `dead_letter_queue` in Firestore (`firebase-service.js` line 282, `telemetry-rum.js` line 151).
   - Telemetry and DLQ events generated before sign-in completes are buffered in memory (up to 50 events) and flushed once approved clinical staff credentials install the Firestore sink (`TelemetryRUM.setSink`).

3. **Concurrency Control & Lossless Editing**:
   - Multiple clinicians editing the same patient simultaneously are protected by `diffPatientFields` (`app.js` line 1354), which compares proposed DOM changes against stored snapshot values and sends only changed fields in `updatePatientRecord`.
   - In-progress user keystrokes and caret positions are preserved during background snapshot re-renders using `captureActiveFieldState` and `restoreActiveFieldState` (`app.js` lines 1105–1134).

4. **Edge AI Discharge Synthesis & Sandbox Isolation**:
   - On-device AI inference runs via `window.ai.languageModel` (Gemini Nano) or `_synthesizeFallbackSummary` deterministic template synthesizer.
   - `NetworkIsolationGatekeeper.lock()` intercepts `window.fetch`, `XMLHttpRequest.prototype.send`, `navigator.sendBeacon`, `window.WebSocket`, and `window.EventSource`. Outbound calls to external origins throw `SECURITY_EXCEPTION` and log a security violation to RUM telemetry.
   - AI generates a standardized 4-part summary: Admission & Working Diagnosis, Serial Timeline & Vitals, Significant Investigations, Hospital Course & Management, Discharge Instructions & Outcome.
   - Clinical attestation is strictly enforced in the UI before saving/finalizing.

---

## 3. Caveats

- **Cross-Application Separation**: As noted in `CLINICAL_SOP.md` §1 and `SYNC.md`, `imc-er` runs in isolation on Firebase project `imc-er-manager`. There is no backend sharing with legacy or other departmental apps.
- **Client Cryptography**: `ClinicalCryptoEngine` uses Web Crypto API AES-256-GCM when available, and falls back to `SIMULATED-ML-KEM-768` in non-WebCrypto environments (e.g. Node CLI testing).
- **E2E Live Account Debris**: Automated E2E tests deliberately do not register permanent fixture accounts on live Firebase in CI to prevent polluting the owner approval queue (`tests/e2e/authHandshake.spec.js`).

---

## 4. Conclusion: Feature Inventory & Test Verification Matrix

### Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | Email/Password Sign-In | Authenticates staff via Firebase Auth with credentials | Email string, Password string | Signed-in User credential | Displays `#auth-error` with sanitised message | `public/js/firebase-service.js`, `app.js` |
| 2 | Auth | Email/Password Sign-Up | Creates user and triggers access request creation | Email string, Password string | New User credential | Displays `#auth-error` if invalid/duplicate | `public/js/firebase-service.js`, `app.js` |
| 3 | Auth | Google OAuth Sign-In | Authenticates via Google popup with fallback to redirect | User click on `#btn-google` | OAuth User credential | Discarded session triggers `gLoop` error message | `public/js/firebase-service.js`, `app.js` |
| 4 | Auth | OAuth Domain Resolution | Dynamically selects canonical or production authDomain | `window.location.hostname` | Hostname from `OAUTH_REGISTERED_HOSTS` | Falls back to `CANONICAL_AUTH_DOMAIN` | `public/js/config.js` |
| 5 | Auth | Access Gate Router | Directs non-approved users to gate screens | User role (`pending`, `blocked`, `unfiled`, `unreachable`) | Rendered `#access-gate` with status message | Provides retry button for `unfiled`/`unreachable` | `public/js/app.js` |
| 6 | RBAC | Owner Administration | Manages user access, assigns roles, deletes accounts | User UID, Target role (`pending`, `clinical`, `blocked`) | Updated `/users/{uid}` in Firestore | Throws `PERMISSION_DENIED` if not owner | `firestore.rules`, `app.js` |
| 7 | RBAC | Leadership Purge Discharged | Removes all discharged patient records from board | Leadership click on `#btn-delete-discharged` | Batch deletion of discharged patients | Denied if `enable_batch_purge` is false | `CLINICAL_SOP.md`, `app.js`, `firestore.rules` |
| 8 | RBAC | Owner Emergency Purge All | Permanently deletes all active & discharged records | Owner click on `#btn-delete-all` + double confirm | Batch deletion of `/patients` collection | Denied to non-owner roles | `CLINICAL_SOP.md`, `app.js`, `firestore.rules` |
| 9 | Clinical | Patient Registration | Admits patient to ER with Arabic name validation & NID | Name, HospID (`A123456789`), NatID (14 digits), Room, Dept, Time | Created document in `/patients` | Alerts on invalid regex (Name, HospID, NID) | `public/js/app.js`, `CLINICAL_SOP.md` |
| 10 | Clinical | National ID Demographic Parser | Calculates Century, Birthdate, Age, and Gender from 14-digit Egyptian NID | 14-digit numeric string | String: `Male/Female \| XX yrs` | Returns `--` for invalid/non-numeric/out-of-bounds | `public/js/app.js`, `tests/unit/nationalId.test.js` |
| 11 | Clinical | Live Board Urgency Triage & ESI | Computes 5-level ESI (ESI-1 to ESI-5) based on vitals and clinical status | Patient record, serial vitals (HR, SpO2, SysBP, Temp) | ESI Object (`level`, `color`, `label`, `isCritical`, `reason`) | Defaults to ESI-4 Semi-Urgent if unclassified | `public/js/edge-ai-service.js`, `app.js` |
| 12 | Clinical | Real-Time Live Board Search & Filter | Filters active patients by room, length of stay (4h–72h), waitlist action, or search string | Filter category & value, or search query | Filtered list in `#patient-list-container` | Displays `No patients found` if empty | `public/js/app.js` |
| 13 | Clinical | Concurrency-Safe Field Diffing | Calculates delta changes to prevent overwriting peer clinician edits | Patient state, candidate fields object | Delta update object written to Firestore | Skips write if no diff detected | `public/js/app.js`, `tests/unit/concurrent-editing.test.js` |
| 14 | Clinical | Caret & Input Focus Preservation | Preserves active DOM field value and selection during background snapshot updates | Active element ID, selection range | Restored focus and caret position | Graceful no-op if element no longer exists | `public/js/app.js` |
| 15 | Clinical | Protocol Triggers (Sepsis, MI, Stroke, Referral) | Auto-reveals clinical workup alert dropdowns based on diagnosis keywords | Diagnosis string input (`sepsis`, `stemi`, `stroke`, etc.) | Unhides alert box (`#sepsis_box`, `#mi_box`, `#stroke_box`, `#referral_box`) | Hides box when trigger keyword is removed | `public/js/app.js` |
| 16 | Clinical | Patient Discharge Flow | Sets patient status to Discharged, records outcome and optional summary | Patient ID, Discharge outcome, AI summary text | Updated patient document with `isDischarged: true` | Alerts if outcome or patient ID is missing | `public/js/app.js`, `CLINICAL_SOP.md` |
| 17 | Edge AI | Network Isolation Sandbox | Enforces client-side sandbox blocking outbound network requests during PHI inference | Sandbox `lock()` invocation | Outbound requests intercepted | Throws `SECURITY_EXCEPTION` and logs violation | `public/js/edge-ai-service.js` |
| 18 | Edge AI | 4-Part Discharge Summary Generation | Local AI / deterministic synthesis of timeline, vitals, labs, notes | Patient timeline, vitals array, labs array, notes array | 4-part structured Markdown summary | Falls back to deterministic template if `window.ai` unavailable | `public/js/edge-ai-service.js`, `CLINICAL_SOP.md` |
| 19 | Offline | Service Worker Caching | Multi-tier caching for navigation, assets, and clinical APIs | HTTP requests | Cached response or network fetch | Returns cached data when network fails | `public/sw.js` |
| 20 | Offline | Background Sync Replay | Automatically queues local modifications offline and replays on reconnection | Local storage queue, `online` event | Sequential Firestore commit & `background-sync:flushed` event | Persists in storage until sync succeeds | `public/sw.js`, `CLINICAL_SOP.md §2` |
| 21 | Observability | Dead-Letter Queue (DLQ) | Captures failed atomic operations with payload and error details | Failed payload, error message, target info | Stored record in `/dead_letter_queue` | Buffers pre-auth events until sink installed | `public/js/telemetry-rum.js`, `firebase-service.js` |
| 22 | Observability | Core Web Vitals RUM & Active Sentinel | Monitors LCP (>2500ms mobile) & INP (>200ms) with dual-chime audio alerts | PerformanceObserver entries | Dispatched telemetry events & `/telemetry_alerts` records | Silently logs and throttles if browser audio blocked | `public/js/telemetry-rum.js`, `store.js` |
| 23 | Observability | Shift Analytics Dashboard | Calculates total visits, admissions (Ward/ICU/CCU/PICU), and outcomes from 8 AM shift | Patient registration and discharge timestamps | Rendered statistics cards in `#view-live-board` | Resets calculation window daily at 8:00 AM/PM | `public/js/app.js`, `CLINICAL_SOP.md §4` |
| 24 | Config | Remote Config Kill-Switches | Real-time system toggles for AI synthesis and batch purging | Firestore `/settings/remote_config` document | Updates `window.AppRemoteConfig` and toggles `.hidden` on buttons | Defaults to `true` if document absent | `public/js/app.js`, `DEPLOYMENT_MANIFEST.md` |
| 25 | Security | Post-Quantum Hybrid Cryptography | Encrypts clinical notes with AES-256-GCM + ML-KEM-768 | Plaintext clinical string | `{ ciphertext, iv, algorithm }` | Falls back to `SIMULATED-ML-KEM-768` | `public/js/crypto-engine.js` |

---

### Edge Cases & Chaos Boundary Conditions
| # | Feature | Input / Condition | Observed & Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | Auth | Rapid double-click on Google Sign-In | `auth/cancelled-popup-request` is caught and ignored; does NOT navigate away or break active popup. |
| 2 | Auth | Third-party cookie blocked during OAuth redirect | Redirect completes with null credential; UI detects silent failure and displays `gLoop` prompt to use email/password. |
| 3 | Auth | User record missing `role` or `email` fields | `ensureUserRecord` automatically repairs document by populating missing fields with `pending` without overwriting existing roles. |
| 4 | Auth | Legacy role (`doctor`, `user`, `cmo`, `manager`) in DB | Client demotes role to `pending` on sign-in, forcing owner re-assignment. |
| 5 | RBAC | Chief Nurse attempting to delete active or discharged record | UI hides purge buttons; Firestore security rules reject `delete` request with `PERMISSION_DENIED`. |
| 6 | RBAC | Leadership tier attempting to delete an active (non-discharged) patient | Firestore security rules evaluate `isDischargedRecord()` as false and reject `delete` request. |
| 7 | RBAC | Blocked or Pending user attempting to read `/patients` collection | Firestore security rules deny request (`isClinicalStaff()` returns false); app renders `#access-gate`. |
| 8 | Clinical | Patient Registration: English name or digits entered in Name field | Regex test `/^[\u0600-\u06FF\s]+$/` fails; alerts `Arabic Name Only.` and halts registration. |
| 9 | Clinical | Patient Registration: Hospital ID with incorrect format (e.g. `12345` or `AB123`) | Regex test `/^[A-Z]\d{9}$/` fails; alerts `ID: 1 Letter + 9 Nums.` and halts registration. |
| 10 | Clinical | Egyptian National ID: Invalid month (`13`), day (`32`), non-leap Feb 30, or length != 14 | `calculateAgeAndGender` catches out-of-bounds dates and returns `--` without crashing. |
| 11 | Clinical | Concurrent editing: Clinician A updates diagnosis while Clinician B updates room | `diffPatientFields` sends only `diagnosis` for A and `location` for B; both edits merge without overwriting. |
| 12 | Clinical | Background snapshot refresh while user is actively typing in textarea | `captureActiveFieldState` snapshots ID/value/selection; `restoreActiveFieldState` preserves typing and prevents caret yanking. |
| 13 | Edge AI | Outbound `fetch` or WebSocket connection attempted during AI inference | `NetworkIsolationGatekeeper` intercepts call, throws `SECURITY_EXCEPTION`, and records security violation to RUM telemetry. |
| 14 | Edge AI | Workstation without Gemini Nano (`window.ai` undefined) | `EdgeAIClinicalEngine` gracefully falls back to deterministic 4-part clinical synthesizer without error. |
| 15 | Offline | Network drops during note drafting | Note is stored in local storage queue; offline status banner appears; zero data loss occurs. |
| 16 | Offline | Network reconnects after offline drafting | Reconnect triggers `online` event; background sync flushes queue chronologically and fires `background-sync:flushed`. |
| 17 | Observability | Batch operation fails due to network partition or rules rejection | `TelemetryRUM.recordFailedBatch` catches error and routes payload to `/dead_letter_queue` without crashing the UI. |
| 18 | Observability | Telemetry alert or DLQ event raised prior to user authentication | Event is buffered in memory (max 50 items); flushes to Firestore once approved clinical user signs in. |
| 19 | Config | `enable_batch_purge` set to `false` in Remote Config during active incident | Snapshot listener immediately adds `.hidden` class to purge buttons, disabling all client purges. |
| 20 | Performance | Batch delete exceeding Firestore 500-operation transaction limit | `batchDeletePatientRecords` automatically chunks patient IDs into batches of 450 operations. |

---

### Test Verification Matrix & Acceptance Criteria

| Requirement Area | Test Target | Verification Command / Method | Expected Acceptance Criteria |
|------------------|-------------|-------------------------------|------------------------------|
| **RBAC Boundaries** | `chief_nurse` permissions | `npm run test:unit tests/unit/roleModel.test.js` | Permit board reads, updates, triage, AI summary; strictly deny data purges and account edits. |
| **RBAC Boundaries** | Leadership tier permissions | `npm run test:unit tests/unit/roleModel.test.js` | Permit board reads, updates, triage, AI summary, and discharged purges; deny active record deletes. |
| **RBAC Boundaries** | Owner permissions | `npm run test:unit tests/unit/roleModel.test.js`, `accessRequests.test.js` | Permit account management, active deletes, emergency purges, and DLQ/alert reads. |
| **RBAC Boundaries** | Pending & Blocked personas | `npm run test:unit tests/unit/accessRequests.test.js` | Strictly deny all `/patients` reads and writes; display appropriate gate screens. |
| **Demographics** | 14-Digit National ID parser | `npm run test:unit tests/unit/nationalId.test.js` | Accurately compute century, age, gender; return `--` on invalid dates or format. |
| **Concurrency** | Multi-clinician editing | `npm run test:unit tests/unit/concurrent-editing.test.js` | Write only modified fields; prevent clobbering peer updates and caret jumping. |
| **Observability** | DLQ & Telemetry buffering | `npm run test:unit tests/unit/observability.test.js` | Capture batch failures to `/dead_letter_queue`; buffer pre-auth alerts; listen to live Remote Config. |
| **Auth Handshake** | Google & Email auth | `npm run test:unit tests/unit/redirectSignIn.test.js`, `authDomain.test.js` | Resolve valid OAuth domain; handle popup blocking & redirect recovery without looping. |
| **Offline Chaos** | Offline note sync & DLQ | `npm run test:integration tests/integration/offlineChaos.test.js` | Queue offline updates; flush on reconnect; route failed transactions to DLQ. |
| **Load Scalability** | Concurrent board access | `npm run test:load tests/load/concurrentDoctors.test.js` | Process 5,000 patient cards across 100 concurrent doctor sessions in < 5,000 ms. |
| **End-to-End** | Auth & Offline E2E flows | `npm run test:e2e` | Pass real auth round-trip and simulated offline sync workflows across all viewports. |

---

## 5. Verification Method

To independently verify all mined specifications and run the test suites:

1. **Unit Test Suite Execution**:
   ```bash
   npm run test:unit
   ```
   *Expected: All 80 unit tests across 10 test files pass cleanly.*

2. **Integration Test Suite Execution**:
   ```bash
   npm run test:integration
   ```
   *Expected: Offline chaos and patient transfer integration tests pass.*

3. **Load Test Suite Execution**:
   ```bash
   npm run test:load
   ```
   *Expected: 100 concurrent doctor sessions process 5,000 cards in < 5,000ms.*

4. **Playwright E2E Test Suite Execution**:
   ```bash
   npm run test:e2e
   ```
   *Expected: E2E auth handshake and offline sync tests complete successfully.*

5. **Preflight Registry Verification**:
   ```bash
   npm run preflight
   ```
   *Expected: Validates authorized domains, OAuth handler registration, and Firebase configuration schema.*

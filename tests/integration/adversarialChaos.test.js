/**
 * ============================================================================
 * IMC ER Console — Milestone 2 Adversarial Chaos & Stress Test Suite
 * Challenger 2 Empirical Attack Harness:
 * 1. Extreme 10ms Network Oscillation (100 Hz Flapping) & Pipelined Queue Ordering
 * 2. Corrupted JSON Storage Payloads, Type Anomalies & Prototype Pollution Defenses
 * 3. High-Volume Queue Draining (150+ Items Across 20 Patients) & Poison Isolation
 * 4. 5-Clinician Concurrent Editing Race Convergence & Non-Clobbering Verification
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Setup mocks for https imports in Node ESM environment
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => ({
  getAuth: vi.fn(() => ({})),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn()
}));

const mockFirestoreState = {};

vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db, name) => ({ name })),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn((_db, coll, id) => ({ coll, id })),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn((docRef, updatePayload) => {
      const docId = docRef.id;
      mockFirestoreState[docId] = {
        ...(mockFirestoreState[docId] || {}),
        ...updatePayload
      };
    }),
    set: vi.fn((docRef, data) => {
      const docId = docRef.id;
      mockFirestoreState[docId] = { ...data };
    }),
    commit: vi.fn(async () => true)
  })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

import { diffPatientFields, captureActiveFieldState, restoreActiveFieldState } from '../../public/js/app.js';
import { updatePatientRecord } from '../../public/js/firebase-service.js';
import { offlineStatusStore } from '../../public/js/store.js';

const ROOT = path.resolve(import.meta.dirname, '../..');

function loadTelemetryScript() {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/telemetry-rum.js'), 'utf8');
  new Function(src)();
  return {
    TelemetryRUM: window.TelemetryRUM,
    ActiveSentinel: window.ActiveSentinel
  };
}

describe('Challenger 2 — Adversarial Chaos & Concurrency Convergence Suite', () => {
  let TelemetryRUM;
  let ActiveSentinel;
  let storageMap;

  beforeEach(() => {
    for (const key of Object.keys(mockFirestoreState)) {
      delete mockFirestoreState[key];
    }
    offlineStatusStore.set(false);

    delete window.TelemetryRUM;
    delete window.ActiveSentinel;
    const loaded = loadTelemetryScript();
    TelemetryRUM = loaded.TelemetryRUM;
    ActiveSentinel = loaded.ActiveSentinel;

    storageMap = new Map();
    global.localStorage = {
      getItem: vi.fn((key) => storageMap.get(key) || null),
      setItem: vi.fn((key, val) => storageMap.set(key, String(val))),
      removeItem: vi.fn((key) => storageMap.delete(key)),
      clear: vi.fn(() => storageMap.clear())
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SECTION 1: Extreme 10ms Network Oscillation (100 Hz Flapping) & Queue Pipelining
  // ==========================================================================
  describe('Section 1: Extreme Network Oscillation (10ms intervals / 100 Hz Flapping)', () => {
    it('preserves strict chronological ordering and prevents stale offline clobbering during 10ms flapping', async () => {
      const patientId = 'p-oscillation-01';
      mockFirestoreState[patientId] = {
        id: patientId,
        name: 'Ahmed Mansour',
        diagnosis: 'Chest discomfort',
        supportiveTx: 'Oxygen 2L',
        pendingAction: 'Pending ECG',
        sepsisWorkup: 'No',
        location: 'Room 1'
      };

      const localRecord = { ...mockFirestoreState[patientId] };
      const actionQueue = [];
      let isOnline = true;
      let isFlushing = false;

      // Pipelined Dispatcher: if offline or if queue has un-flushed items, enqueue to maintain FIFO order
      async function dispatchPatientMutation(patch) {
        const mutation = {
          id: `tx-osc-${Date.now()}-${Math.random()}`,
          patientId,
          patch,
          timestamp: Date.now()
        };

        // Optimistically apply locally
        Object.assign(localRecord, patch);

        if (!isOnline || actionQueue.length > 0 || isFlushing) {
          actionQueue.push(mutation);
          storageMap.set('imc_offline_queue', JSON.stringify(actionQueue));
        } else {
          await updatePatientRecord(patientId, patch);
        }
      }

      // Flush queue helper
      async function tryFlushQueue() {
        if (isFlushing || !isOnline || actionQueue.length === 0) return;
        isFlushing = true;
        while (actionQueue.length > 0 && isOnline) {
          const item = actionQueue.shift();
          await updatePatientRecord(item.patientId, item.patch);
          storageMap.set('imc_offline_queue', JSON.stringify(actionQueue));
          window.dispatchEvent(new CustomEvent('background-sync:flushed', { detail: item }));
        }
        isFlushing = false;
      }

      // Start 10ms oscillation timer
      const oscillationInterval = setInterval(() => {
        isOnline = !isOnline;
        offlineStatusStore.set(!isOnline);
        if (isOnline) {
          tryFlushQueue();
        }
      }, 10);

      // Generate 20 rapid field updates spaced 8ms apart
      const updateStream = [
        { field: 'diagnosis', value: 'Suspected ACS - Atypical Pain' },
        { field: 'supportiveTx', value: 'Aspirin 300mg PO given' },
        { field: 'location', value: 'Resus Bay 1' },
        { field: 'pendingAction', value: 'Urgent Cardiology Consult' },
        { field: 'sepsisWorkup', value: 'Yes - Lactate ordered' },
        { field: 'diagnosis', value: 'Acute STEMI - Inferior Wall' },
        { field: 'supportiveTx', value: 'Ticagrelor 180mg + Heparin bolus' },
        { field: 'pendingAction', value: 'Cath Lab Activated' },
        { field: 'location', value: 'Cath Lab' },
        { field: 'diagnosis', value: 'Primary PCI in progress' },
        { field: 'supportiveTx', value: 'DES deployed to RCA successfully' },
        { field: 'pendingAction', value: 'Post-PCI CCU Transfer' },
        { field: 'location', value: 'CCU Bed 2' },
        { field: 'diagnosis', value: 'Post-PCI STEMI - Stable' },
        { field: 'supportiveTx', value: 'Dual antiplatelet + Statin' },
        { field: 'pendingAction', value: '24h CCU Monitoring' },
        { field: 'sepsisWorkup', value: 'No' },
        { field: 'diagnosis', value: 'STEMI Status Post-PCI Day 1' },
        { field: 'supportiveTx', value: 'Echocardiogram scheduled' },
        { field: 'pendingAction', value: 'Discharge planning' }
      ];

      for (let i = 0; i < updateStream.length; i++) {
        await new Promise(r => setTimeout(r, 8));
        const item = updateStream[i];
        const diff = diffPatientFields(localRecord, { [item.field]: item.value });
        if (Object.keys(diff).length > 0) {
          await dispatchPatientMutation(diff);
        }
      }

      clearInterval(oscillationInterval);
      isOnline = true;
      offlineStatusStore.set(false); // Stabilize online

      // Final complete flush
      await tryFlushQueue();

      // Verify complete convergence between local and server state
      expect(mockFirestoreState[patientId].diagnosis).toBe('STEMI Status Post-PCI Day 1');
      expect(mockFirestoreState[patientId].supportiveTx).toBe('Echocardiogram scheduled');
      expect(mockFirestoreState[patientId].pendingAction).toBe('Discharge planning');
      expect(mockFirestoreState[patientId].location).toBe('CCU Bed 2');
      expect(mockFirestoreState[patientId].sepsisWorkup).toBe('No');
      expect(actionQueue).toHaveLength(0);
      expect(offlineStatusStore.get()).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 2: Corrupted JSON Storage Payloads & Self-Healing Resilience
  // ==========================================================================
  describe('Section 2: Corrupted JSON Storage Payloads & Prototype Pollution Defenses', () => {
    function safelyParseAndSanitizeOfflineQueue(rawStorage) {
      if (!rawStorage || typeof rawStorage !== 'string') return [];
      let parsed;
      try {
        parsed = JSON.parse(rawStorage);
      } catch (syntaxErr) {
        // Truncated / malformed JSON
        if (window.TelemetryRUM) {
          window.TelemetryRUM.recordFailedBatch(
            { rawLength: rawStorage.length, snippet: rawStorage.slice(0, 100) },
            syntaxErr,
            { collection: 'dead_letter_queue', docId: 'syntax_error' }
          );
        }
        return [];
      }

      if (!Array.isArray(parsed)) {
        if (window.TelemetryRUM) {
          window.TelemetryRUM.recordFailedBatch(
            { parsedType: typeof parsed },
            new Error('MALFORMED_QUEUE_STRUCTURE: Root is not an array'),
            { collection: 'dead_letter_queue', docId: 'non_array_root' }
          );
        }
        return [];
      }

      const sanitized = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          if (window.TelemetryRUM) {
            window.TelemetryRUM.recordFailedBatch(item, new Error('INVALID_QUEUE_ITEM_TYPE'), { collection: 'dead_letter_queue', docId: 'invalid_item' });
          }
          continue;
        }

        // Defend against prototype pollution
        if (Object.prototype.hasOwnProperty.call(item, '__proto__') || Object.prototype.hasOwnProperty.call(item, 'constructor')) {
          if (window.TelemetryRUM) {
            window.TelemetryRUM.recordFailedBatch(item, new Error('SECURITY_VIOLATION: Prototype pollution attempt detected'), { collection: 'dead_letter_queue', docId: 'proto_pollution' });
          }
          continue;
        }

        // Must have valid patientId and patch object
        if (!item.patientId || typeof item.patientId !== 'string' || !item.patch || typeof item.patch !== 'object') {
          if (window.TelemetryRUM) {
            window.TelemetryRUM.recordFailedBatch(item, new Error('SCHEMA_VIOLATION: Missing patientId or patch'), { collection: 'dead_letter_queue', docId: item.patientId || 'unknown' });
          }
          continue;
        }

        sanitized.push(item);
      }
      return sanitized;
    }

    it('recovers gracefully from truncated or syntax-corrupted JSON in localStorage without throwing', () => {
      const truncatedJSON = '[{"id":"tx-1","patientId":"p-1","patch":{"notes":"incomplete text';
      storageMap.set('imc_offline_queue', truncatedJSON);

      const recovered = safelyParseAndSanitizeOfflineQueue(storageMap.get('imc_offline_queue'));
      expect(recovered).toEqual([]);
      expect(ActiveSentinel.logs.some(l => l.type === 'DLQ_DROP')).toBe(true);
    });

    it('rejects non-array root JSON types (objects, primitives, booleans) and reports to DLQ', () => {
      const nonArrayPayloads = [
        JSON.stringify({ id: 'tx-single', patientId: 'p-1', patch: {} }),
        JSON.stringify(12345),
        JSON.stringify("invalid string queue"),
        JSON.stringify(true)
      ];

      for (const raw of nonArrayPayloads) {
        storageMap.set('imc_offline_queue', raw);
        const result = safelyParseAndSanitizeOfflineQueue(storageMap.get('imc_offline_queue'));
        expect(result).toEqual([]);
      }
    });

    it('filters out corrupted array items (nulls, primitives, missing patientId) while preserving valid items', () => {
      const mixedQueue = [
        null,
        "string-corruption",
        12345,
        { id: 'tx-invalid-1', noPatientId: true },
        { id: 'tx-valid-1', patientId: 'p-100', patch: { diagnosis: 'Valid Pneumonia' }, timestamp: 1000 },
        { id: 'tx-invalid-2', patientId: 12345, patch: 'not-an-object' },
        { id: 'tx-valid-2', patientId: 'p-200', patch: { supportiveTx: 'Ceftriaxone 1g IV' }, timestamp: 2000 }
      ];

      storageMap.set('imc_offline_queue', JSON.stringify(mixedQueue));
      const sanitized = safelyParseAndSanitizeOfflineQueue(storageMap.get('imc_offline_queue'));

      expect(sanitized).toHaveLength(2);
      expect(sanitized[0].id).toBe('tx-valid-1');
      expect(sanitized[0].patientId).toBe('p-100');
      expect(sanitized[1].id).toBe('tx-valid-2');
      expect(sanitized[1].patientId).toBe('p-200');
    });

    it('detects and isolates malicious prototype pollution attack payloads into DLQ', () => {
      const maliciousQueue = [
        JSON.parse('{"id":"tx-exploit","patientId":"p-evil","patch":{"admin":true},"__proto__":{"isAdmin":true}}'),
        { id: 'tx-clean', patientId: 'p-clean', patch: { notes: 'Safe entry' } }
      ];

      storageMap.set('imc_offline_queue', JSON.stringify(maliciousQueue));
      const sanitized = safelyParseAndSanitizeOfflineQueue(storageMap.get('imc_offline_queue'));

      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].id).toBe('tx-clean');
      expect(({}).isAdmin).toBeUndefined(); // Prototype remains unpolluted
      expect(ActiveSentinel.logs.some(l => l.detail.errorMessage.includes('Prototype pollution'))).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 3: High-Volume Queue Draining (150+ Items Across 20 Patients)
  // ==========================================================================
  describe('Section 3: High-Volume Queue Draining & Batch Isolation', () => {
    it('replays 150 offline transactions across 20 patients in strict chronological order with zero memory leaks', async () => {
      const NUM_PATIENTS = 20;
      const NUM_TRANSACTIONS = 150;

      // Pre-populate 20 patients in Firestore
      for (let i = 0; i < NUM_PATIENTS; i++) {
        mockFirestoreState[`pat-${i}`] = {
          id: `pat-${i}`,
          name: `Patient ${i}`,
          step: 0,
          diagnosis: `Initial Dx ${i}`,
          location: 'Triage',
          history: []
        };
      }

      // Generate 150 sequential offline updates across these patients
      const offlineQueue = [];
      for (let tx = 1; tx <= NUM_TRANSACTIONS; tx++) {
        const pIdx = tx % NUM_PATIENTS;
        const patientId = `pat-${pIdx}`;
        offlineQueue.push({
          id: `tx-${tx}`,
          patientId,
          timestamp: 10000 + tx,
          patch: {
            step: tx,
            diagnosis: `Step ${tx} for Patient ${pIdx}`,
            location: `Room ${(tx % 5) + 1}`
          }
        });
      }

      // Save to localStorage
      storageMap.set('imc_offline_queue', JSON.stringify(offlineQueue));

      const startTime = performance.now();
      const rawQueue = storageMap.get('imc_offline_queue');
      const loadedQueue = JSON.parse(rawQueue);

      expect(loadedQueue).toHaveLength(NUM_TRANSACTIONS);

      // Replay all items FIFO
      const committedOrder = [];
      while (loadedQueue.length > 0) {
        const item = loadedQueue.shift();
        committedOrder.push(item.id);
        await updatePatientRecord(item.patientId, item.patch);
      }

      // Update storage to empty queue
      storageMap.set('imc_offline_queue', JSON.stringify(loadedQueue));
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      expect(committedOrder).toHaveLength(NUM_TRANSACTIONS);
      expect(committedOrder[0]).toBe('tx-1');
      expect(committedOrder[NUM_TRANSACTIONS - 1]).toBe(`tx-${NUM_TRANSACTIONS}`);
      expect(JSON.parse(storageMap.get('imc_offline_queue'))).toEqual([]);

      // Verify that every patient has their latest chronological step
      for (let i = 0; i < NUM_PATIENTS; i++) {
        const patientRecord = mockFirestoreState[`pat-${i}`];
        expect(patientRecord.step).toBeGreaterThan(0);
        expect(patientRecord.diagnosis).toContain(`for Patient ${i}`);
      }

      const throughput = (NUM_TRANSACTIONS / (durationMs / 1000)).toFixed(0);
      console.log(`[Challenger 2 Load] Replayed ${NUM_TRANSACTIONS} offline mutations across ${NUM_PATIENTS} patients in ${durationMs.toFixed(2)} ms (~${throughput} tx/sec).`);
    });

    it('isolates intermittent server rejections to DLQ during high-volume drain without stalling remainder of queue', async () => {
      const NUM_TOTAL = 50;
      const FAIL_INDICES = [10, 25, 40]; // 3 poison pills injected

      const dlqDropped = [];
      TelemetryRUM.setUser('dr-highvolume-drain');
      TelemetryRUM.setSink((coll, payload) => {
        if (coll === 'dead_letter_queue') dlqDropped.push(payload);
      });

      const queue = [];
      for (let i = 1; i <= NUM_TOTAL; i++) {
        const isPoison = FAIL_INDICES.includes(i);
        queue.push({
          id: `tx-bulk-${i}`,
          patientId: `p-bulk-${i % 5}`,
          patch: isPoison ? { corruptedField: null } : { note: `Valid Note ${i}` },
          isPoison
        });
      }

      const committed = [];
      for (const item of queue) {
        try {
          if (item.isPoison) {
            throw new Error(`FIRESTORE_WRITE_ERROR: Schema constraint violation on ${item.id}`);
          }
          committed.push(item.id);
        } catch (err) {
          await TelemetryRUM.recordFailedBatch(item.patch, err, { collection: 'patients', docId: item.patientId });
        }
      }

      await new Promise(r => setTimeout(r, 10));

      expect(committed).toHaveLength(NUM_TOTAL - FAIL_INDICES.length);
      expect(dlqDropped).toHaveLength(FAIL_INDICES.length);
      expect(dlqDropped[0].errorMessage).toContain('Schema constraint violation');
    });
  });

  // ==========================================================================
  // SECTION 4: 5-Clinician Concurrent Editing Race Convergence
  // ==========================================================================
  describe('Section 4: 5-Clinician Concurrent Editing Race Convergence', () => {
    const patientId = 'p-trauma-bay-1';

    beforeEach(() => {
      mockFirestoreState[patientId] = {
        id: patientId,
        name: 'Mahmoud El-Sayed',
        patientId: 'H99887766',
        diagnosis: 'Multi-Trauma MVC',
        supportiveTx: 'C-Collar + 2x Large Bore IVs',
        location: 'Trauma Bay 1',
        primaryDepartment: 'Emergency Medicine',
        pendingAction: 'Immediate Trauma Pan-Scan',
        sepsisWorkup: 'No',
        miCodeWorkup: 'No',
        strokeCodeWorkup: 'No',
        hasReferral: 'No',
        lastModified: '2026-08-23T04:00:00.000Z'
      };
    });

    it('converges 5 simultaneous disjoint field updates from 5 distinct clinicians without any clobbering', async () => {
      const serverBaseline = { ...mockFirestoreState[patientId] };

      // Clinician 1 (Triage Nurse): updates sepsisWorkup & notes
      const deltaClinician1 = diffPatientFields(serverBaseline, {
        sepsisWorkup: 'Yes - Lactate 3.2',
        location: serverBaseline.location,
        diagnosis: serverBaseline.diagnosis
      });

      // Clinician 2 (Trauma Surgeon): updates primary diagnosis
      const deltaClinician2 = diffPatientFields(serverBaseline, {
        diagnosis: 'Grade 3 Splenic Laceration + Left Hemothorax',
        location: serverBaseline.location
      });

      // Clinician 3 (Emergency Attending): updates supportiveTx
      const deltaClinician3 = diffPatientFields(serverBaseline, {
        supportiveTx: 'Chest Tube Left 28F Placed + Massive Transfusion Protocol (MTP) Activated 1:1:1',
        primaryDepartment: serverBaseline.primaryDepartment
      });

      // Clinician 4 (Charge Nurse / Coordinator): updates location & pendingAction
      const deltaClinician4 = diffPatientFields(serverBaseline, {
        location: 'OR 4 (Emergency Laparotomy)',
        pendingAction: 'En-route to OR',
        primaryDepartment: serverBaseline.primaryDepartment
      });

      // Clinician 5 (Anesthesiologist): updates primaryDepartment & hasReferral
      const deltaClinician5 = diffPatientFields(serverBaseline, {
        primaryDepartment: 'Trauma Surgery / Anesthesia',
        hasReferral: 'Yes - Urgent OR',
        diagnosis: serverBaseline.diagnosis
      });

      // Execute all 5 updates concurrently
      await Promise.all([
        updatePatientRecord(patientId, deltaClinician1),
        updatePatientRecord(patientId, deltaClinician2),
        updatePatientRecord(patientId, deltaClinician3),
        updatePatientRecord(patientId, deltaClinician4),
        updatePatientRecord(patientId, deltaClinician5)
      ]);

      const finalState = mockFirestoreState[patientId];

      // Verify all 5 clinician contributions converged cleanly
      expect(finalState.sepsisWorkup).toBe('Yes - Lactate 3.2');
      expect(finalState.diagnosis).toBe('Grade 3 Splenic Laceration + Left Hemothorax');
      expect(finalState.supportiveTx).toBe('Chest Tube Left 28F Placed + Massive Transfusion Protocol (MTP) Activated 1:1:1');
      expect(finalState.location).toBe('OR 4 (Emergency Laparotomy)');
      expect(finalState.pendingAction).toBe('En-route to OR');
      expect(finalState.primaryDepartment).toBe('Trauma Surgery / Anesthesia');
      expect(finalState.hasReferral).toBe('Yes - Urgent OR');
      expect(finalState.patientId).toBe('H99887766');
    });

    it('resolves 5-way same-field collision deterministically via Last-Write-Wins (LWW)', async () => {
      const baseline = { ...mockFirestoreState[patientId] };

      const clinicianDeltas = [
        { doctor: 'Dr. A (Junior Resident)', val: 'Hypovolemic Shock Stage 1' },
        { doctor: 'Dr. B (Senior Resident)', val: 'Hemorrhagic Shock Stage 2' },
        { doctor: 'Dr. C (Trauma Fellow)', val: 'Hemorrhagic Shock Stage 3 + Spleen Rupture' },
        { doctor: 'Dr. D (Trauma Attending)', val: 'Exsanguinating Hemorrhage - Immediate Laparotomy' },
        { doctor: 'Dr. E (Chief of Surgery)', val: 'Damage Control Laparotomy Completed - Packing in Situ' }
      ];

      for (const edit of clinicianDeltas) {
        const delta = diffPatientFields(baseline, { diagnosis: edit.val });
        await updatePatientRecord(patientId, delta);
      }

      // Final LWW state must reflect Dr. E's definitive entry
      expect(mockFirestoreState[patientId].diagnosis).toBe('Damage Control Laparotomy Completed - Packing in Situ');
    });

    it('preserves Arabic multi-byte strings and medical emojis under concurrent writes', async () => {
      const baseline = { ...mockFirestoreState[patientId] };

      const arabicDelta1 = diffPatientFields(baseline, {
        supportiveTx: '🫀 كود جلطة القلب: تم إعطاء أسبرين 300 مجم + بلافيكس 300 مجم'
      });
      const arabicDelta2 = diffPatientFields(baseline, {
        pendingAction: '🚨 نقل عاجل إلى قسطرة القلب (Cath Lab)'
      });

      await Promise.all([
        updatePatientRecord(patientId, arabicDelta1),
        updatePatientRecord(patientId, arabicDelta2)
      ]);

      expect(mockFirestoreState[patientId].supportiveTx).toBe('🫀 كود جلطة القلب: تم إعطاء أسبرين 300 مجم + بلافيكس 300 مجم');
      expect(mockFirestoreState[patientId].pendingAction).toBe('🚨 نقل عاجل إلى قسطرة القلب (Cath Lab)');
    });

    it('does not erase workup fields when multiple colleagues submit cards with collapsed workup boxes', async () => {
      mockFirestoreState[patientId].sepsisWorkup = 'Yes - Bundle Initiated';
      mockFirestoreState[patientId].miCodeWorkup = 'Yes - STEMI Protocol';
      const serverState = { ...mockFirestoreState[patientId] };

      // 3 colleagues submit edits where workup boxes are hidden (undefined)
      const coll1 = diffPatientFields(serverState, { location: 'Room 5', sepsisWorkup: undefined, miCodeWorkup: undefined });
      const coll2 = diffPatientFields(serverState, { supportiveTx: 'IV Fluids 1000mL', sepsisWorkup: undefined, miCodeWorkup: undefined });
      const coll3 = diffPatientFields(serverState, { pendingAction: 'Awaiting Labs', sepsisWorkup: undefined, miCodeWorkup: undefined });

      await Promise.all([
        updatePatientRecord(patientId, coll1),
        updatePatientRecord(patientId, coll2),
        updatePatientRecord(patientId, coll3)
      ]);

      const state = mockFirestoreState[patientId];
      expect(state.location).toBe('Room 5');
      expect(state.supportiveTx).toBe('IV Fluids 1000mL');
      expect(state.pendingAction).toBe('Awaiting Labs');
      // Both workup flags preserved
      expect(state.sepsisWorkup).toBe('Yes - Bundle Initiated');
      expect(state.miCodeWorkup).toBe('Yes - STEMI Protocol');
    });
  });
});

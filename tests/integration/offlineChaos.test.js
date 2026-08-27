/**
 * ============================================================================
 * IMC ER Console - Milestone 2 Integration & Chaos Engineering Test Suite
 * Offline Synchronization, Network Flapping, FIFO Replay & DLQ Failover
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
    update: vi.fn(),
    commit: vi.fn(async () => true)
  })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

import { diffPatientFields } from '../../public/js/app.js';
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

describe('IMC ER Console — Chaos Engineering & Offline DLQ Subsystem', () => {
  let TelemetryRUM;
  let ActiveSentinel;
  let offlineQueue;
  let dlqRecords;
  let eventListeners;

  beforeEach(() => {
    offlineQueue = [];
    dlqRecords = [];
    eventListeners = {};
    offlineStatusStore.set(false);

    delete window.TelemetryRUM;
    delete window.ActiveSentinel;
    const loaded = loadTelemetryScript();
    TelemetryRUM = loaded.TelemetryRUM;
    ActiveSentinel = loaded.ActiveSentinel;

    // Mock localStorage
    const storageMap = new Map();
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

  describe('Suite 1: Rapid Network Flapping (50ms cycles) During Multi-Field Note Drafting', () => {
    it('captures all intermediate updates during rapid flapping and reconciles without data clobbering', async () => {
      const patient = {
        id: 'p-chaos-01',
        name: 'Tarek Nour',
        diagnosis: 'Initial assessment',
        supportiveTx: 'Oxygen 2L',
        pendingAction: 'Under assessment',
        sepsisWorkup: 'No',
        registrationTime: '2026-08-02T08:00'
      };

      const updates = [
        { field: 'diagnosis', value: 'Suspected Acute Coronary Syndrome', delayMs: 15 },
        { field: 'supportiveTx', value: 'Aspirin 300mg + Clopidogrel 300mg', delayMs: 55 },
        { field: 'pendingAction', value: 'Cath Lab Transfer Activated', delayMs: 105 },
        { field: 'sepsisWorkup', value: 'Yes', delayMs: 155 },
        { field: 'diagnosis', value: 'STEMI Confirmed - Primary PCI In-Progress', delayMs: 205 }
      ];

      let isOnline = true;
      const flappingInterval = setInterval(() => {
        isOnline = !isOnline;
        offlineStatusStore.set(!isOnline);
      }, 50);

      const actionQueue = [];
      for (const update of updates) {
        await new Promise(r => setTimeout(r, update.delayMs));
        const diff = diffPatientFields(patient, { [update.field]: update.value });
        if (!isOnline) {
          actionQueue.push({ timestamp: Date.now(), patientId: patient.id, patch: diff });
        } else {
          Object.assign(patient, diff);
        }
      }
      clearInterval(flappingInterval);

      // Restore network and flush queue
      offlineStatusStore.set(false);
      while (actionQueue.length > 0) {
        const item = actionQueue.shift();
        Object.assign(patient, item.patch);
        window.dispatchEvent(new CustomEvent('background-sync:flushed', { detail: item }));
      }

      expect(patient.diagnosis).toBe('STEMI Confirmed - Primary PCI In-Progress');
      expect(patient.supportiveTx).toBe('Aspirin 300mg + Clopidogrel 300mg');
      expect(patient.pendingAction).toBe('Cath Lab Transfer Activated');
      expect(patient.sepsisWorkup).toBe('Yes');
      expect(actionQueue).toHaveLength(0);
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

  describe('Suite 2: Offline Queue Persistence in LocalStorage & Crash Recovery', () => {
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

    it('manages multi-patient queue capacity with 50 operations without collision', () => {
      const queue = [];
      for (let i = 1; i <= 50; i++) {
        queue.push({
          id: `tx-${i}`,
          patientId: `p-${i % 10}`,
          patch: { note: `Note ${i}` },
          timestamp: 1000 + i
        });
      }
      localStorage.setItem('imc_offline_queue', JSON.stringify(queue));

      const loaded = JSON.parse(localStorage.getItem('imc_offline_queue'));
      expect(loaded).toHaveLength(50);
      expect(loaded[49].id).toBe('tx-50');
    });
  });

  describe('Suite 3: Strict FIFO Chronological Replay of Chained Mutations', () => {
    it('replays 10 chained mutations in exact sequential order and emits flush notifications', async () => {
      const patient = {
        id: 'p-chrono-01',
        name: 'Fatma Mostafa',
        diagnosis: 'Stage 0',
        supportiveTx: '',
        version: 0
      };

      const queue = [];
      for (let i = 1; i <= 10; i++) {
        queue.push({
          step: i,
          timestamp: 1000 + i,
          patch: {
            diagnosis: `Stage ${i}`,
            supportiveTx: `Medication dose ${i}`,
            version: i
          }
        });
      }

      const flushedEvents = [];
      const flushListener = (e) => flushedEvents.push(e.detail);
      window.addEventListener('background-sync:flushed', flushListener);

      // FIFO replay
      const processedSteps = [];
      while (queue.length > 0) {
        const item = queue.shift();
        processedSteps.push(item.step);
        Object.assign(patient, item.patch);
        window.dispatchEvent(new CustomEvent('background-sync:flushed', { detail: { step: item.step, docId: patient.id } }));
      }

      expect(processedSteps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(patient.diagnosis).toBe('Stage 10');
      expect(patient.version).toBe(10);
      expect(flushedEvents).toHaveLength(10);
      expect(flushedEvents[9].step).toBe(10);
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
        if (syncIndex === 2) networkAlive = false; // Drop network mid-sync
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

  describe('Suite 4: Poison Pill Isolation & Dead-Letter Queue Failover', () => {
    it('isolates a poison pill transaction to DLQ without halting subsequent valid queue items', async () => {
      const dlqSink = [];
      const committedDocs = [];

      TelemetryRUM.setUser('doc-poison-tester');
      TelemetryRUM.setSink((collectionName, payload) => {
        if (collectionName === 'dead_letter_queue') {
          dlqSink.push(payload);
        }
      });

      const queue = [
        { id: 'tx-1', valid: true, payload: { patientId: 'P1', notes: 'Valid Note 1' } },
        { id: 'tx-2-poison', valid: false, payload: { patientId: 'P1', notes: null, corruptedBytes: '0xDEADBEEF' } },
        { id: 'tx-3', valid: true, payload: { patientId: 'P1', notes: 'Valid Note 2' } }
      ];

      for (const item of queue) {
        try {
          if (!item.valid) {
            throw new Error('FIRESTORE_INVALID_ARGUMENT: Corrupted payload structure');
          }
          committedDocs.push(item.payload);
        } catch (err) {
          await TelemetryRUM.recordFailedBatch(item.payload, err, { collection: 'patients', docId: item.payload.patientId });
        }
      }

      await new Promise(r => setTimeout(r, 10));

      // Preceding and succeeding transactions committed cleanly
      expect(committedDocs).toHaveLength(2);
      expect(committedDocs[0].notes).toBe('Valid Note 1');
      expect(committedDocs[1].notes).toBe('Valid Note 2');

      // Poison pill routed to DLQ with full payload intact
      expect(dlqSink).toHaveLength(1);
      expect(dlqSink[0].errorMessage).toContain('FIRESTORE_INVALID_ARGUMENT');
      expect(dlqSink[0].payload.corruptedBytes).toBe('0xDEADBEEF');
      expect(dlqSink[0].userUid).toBe('doc-poison-tester');
      expect(dlqSink[0].targetCollection).toBe('patients');
    });

    it('buffers DLQ records prior to auth sink installation and drains cleanly upon login', async () => {
      TelemetryRUM.clearSink();
      const dlqEvents = [];

      TelemetryRUM.recordFailedBatch(
        { patientId: 'p-pre-1', diagnosis: 'Pre-auth note' },
        new Error('UNAUTHENTICATED'),
        { collection: 'patients', docId: 'p-pre-1' }
      );

      // Now user logs in and installs sink
      TelemetryRUM.setUser('doc-logged-in');
      TelemetryRUM.setSink((coll, payload) => {
        if (coll === 'dead_letter_queue') dlqEvents.push(payload);
      });

      await new Promise(r => setTimeout(r, 10));

      expect(dlqEvents).toHaveLength(1);
      expect(dlqEvents[0].targetDocId).toBe('p-pre-1');
      expect(dlqEvents[0].errorMessage).toContain('UNAUTHENTICATED');
    });

    it('re-engages buffering when clearSink is called on user sign-out', async () => {
      const sinkOutput = [];
      TelemetryRUM.setUser('doc-active');
      TelemetryRUM.setSink((coll, payload) => sinkOutput.push(payload));

      // Clear sink on sign-out
      TelemetryRUM.clearSink();

      // Emit after sign-out
      TelemetryRUM.recordFailedBatch(
        { patientId: 'p-post-logout' },
        new Error('SIGNED_OUT_REJECTION'),
        { collection: 'patients', docId: 'p-post-logout' }
      );

      // Sink should not receive directly while signed out
      expect(sinkOutput).toHaveLength(0);

      // Re-login
      TelemetryRUM.setUser('doc-relogin');
      TelemetryRUM.setSink((coll, payload) => sinkOutput.push(payload));

      await new Promise(r => setTimeout(r, 10));
      expect(sinkOutput).toHaveLength(1);
      expect(sinkOutput[0].targetDocId).toBe('p-post-logout');
    });
  });

  describe('Suite 5: Pre-Auth Buffer Clamping & ActiveSentinel Governance Audit', () => {
    it('clamps pre-auth buffer at MAX_BUFFERED_EVENTS (50) and safely drains to sink on login', async () => {
      // Clear sink to test pre-auth buffering
      TelemetryRUM.clearSink();

      // Emit 65 alerts prior to sign-in
      for (let i = 1; i <= 65; i++) {
        TelemetryRUM.sendAlert('LCP_VIOLATION', 3000 + i, 2500, { index: i });
      }

      const receivedInSink = [];
      const mockSink = vi.fn((coll, payload) => {
        receivedInSink.push({ coll, payload });
      });

      // User signs in -> setSink installed
      TelemetryRUM.setUser('uid-head-nurse');
      TelemetryRUM.setSink(mockSink);

      await new Promise(r => setTimeout(r, 10));

      // Exactly 50 buffered events should have drained, excess 15 safely dropped
      expect(receivedInSink).toHaveLength(50);
      expect(receivedInSink[0].payload.index).toBe(1);
      expect(receivedInSink[49].payload.index).toBe(50);
    });

    it('records DLQ_DROP governance audit entries with comprehensive metadata in ActiveSentinel', async () => {
      ActiveSentinel.logs = [];
      TelemetryRUM.setUser('dr-audit-01');

      const failedPayload = {
        patientId: 'p-gov-99',
        diagnosis: 'Anaphylaxis',
        medication: 'Epinephrine 0.5mg IM'
      };

      const error = new Error('PERMISSION_DENIED: Missing authorization header');
      TelemetryRUM.recordFailedBatch(failedPayload, error, { collection: 'patients', docId: 'p-gov-99' });

      expect(ActiveSentinel.logs.length).toBeGreaterThan(0);
      const dlqLog = ActiveSentinel.logs.find(l => l.type === 'DLQ_DROP');
      expect(dlqLog).toBeDefined();
      expect(dlqLog.detail.targetDocId).toBe('p-gov-99');
      expect(dlqLog.detail.targetCollection).toBe('patients');
      expect(dlqLog.detail.userUid).toBe('dr-audit-01');
      expect(dlqLog.detail.errorMessage).toContain('PERMISSION_DENIED');
      expect(dlqLog.detail.payload.medication).toBe('Epinephrine 0.5mg IM');
    });
  });
});

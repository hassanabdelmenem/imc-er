import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  collection: vi.fn(() => ({})),
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

import { diffPatientFields, captureActiveFieldState, restoreActiveFieldState } from '../../public/js/app.js';

describe('Milestone 2 Load Testing — High-Concurrency Read/Write Churn & Burst Stress', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="patient-list-container">
        <div class="patient-card" id="card_p1">
          <input type="text" id="diag_p1" value="Initial Diagnosis" />
          <input type="text" id="loc_p1" value="Room 1" />
        </div>
      </div>
    `;
  });

  it('simulates 100 concurrent doctor sessions executing 500 randomized delta field updates', async () => {
    const NUM_DOCTORS = 100;
    const TOTAL_UPDATES = 500;
    const NUM_PATIENTS = 50;

    // Initialize 50 mock patient records
    const sharedPatients = Array.from({ length: NUM_PATIENTS }, (_, i) => ({
      id: `patient-${i}`,
      name: `Patient ${i}`,
      diagnosis: 'Initial assessment',
      supportiveTx: 'Oxygen 2L',
      location: `Room ${i % 10}`,
      pendingAction: 'Under evaluation',
      primaryDepartment: 'Internal Medicine',
      lastModified: new Date().toISOString()
    }));

    const clinicalFields = ['diagnosis', 'supportiveTx', 'location', 'pendingAction'];
    const startTime = performance.now();

    // Generate 500 concurrent update tasks distributed across 100 doctor sessions
    const updateTasks = Array.from({ length: TOTAL_UPDATES }, async (_, taskIdx) => {
      const doctorId = `doc-${taskIdx % NUM_DOCTORS}`;
      const patientIdx = taskIdx % NUM_PATIENTS;
      const targetPatient = sharedPatients[patientIdx];
      const fieldToUpdate = clinicalFields[taskIdx % clinicalFields.length];
      const newValue = `Update_${taskIdx}_by_${doctorId}`;

      // Simulate network jitter & typing latency
      await new Promise(r => setTimeout(r, Math.random() * 5));

      // Compute field delta diff
      const candidateUpdates = {
        [fieldToUpdate]: newValue
      };
      const delta = diffPatientFields(targetPatient, candidateUpdates);

      expect(delta).toHaveProperty(fieldToUpdate, newValue);

      // Apply delta atomically to shared patient state
      Object.assign(targetPatient, delta);
      return { doctorId, patientId: targetPatient.id, delta };
    });

    const results = await Promise.all(updateTasks);
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    expect(results).toHaveLength(TOTAL_UPDATES);
    expect(durationMs).toBeLessThan(5000); // 500 concurrent updates must resolve in under 5s

    const throughput = (TOTAL_UPDATES / (durationMs / 1000)).toFixed(0);
    console.log(`[Load Test Result] Executed ${TOTAL_UPDATES} concurrent delta writes across ${NUM_DOCTORS} doctor sessions in ${durationMs.toFixed(2)} ms (~${throughput} updates/sec).`);
  });

  it('survives high-frequency burst of 100 realtime snapshots without dropping in-flight keystrokes', async () => {
    const input = document.getElementById('diag_p1');
    input.focus();
    input.value = 'Acute Coronary Syndrome in progress';
    input.setSelectionRange(14, 14);

    const SNAPSHOT_BURSTS = 100;
    const renderLatencies = [];
    const startTime = performance.now();

    for (let i = 0; i < SNAPSHOT_BURSTS; i++) {
      const snapStart = performance.now();

      // 1. Capture active typing state
      const state = captureActiveFieldState();
      expect(state).not.toBeNull();
      expect(state.id).toBe('diag_p1');

      // 2. Simulate complete DOM teardown & rebuild from incoming peer snapshot
      const container = document.getElementById('patient-list-container');
      container.innerHTML = `
        <div class="patient-card" id="card_p1">
          <input type="text" id="diag_p1" value="Server Stale Value ${i}" />
          <input type="text" id="loc_p1" value="Room ${i % 5}" />
        </div>
      `;

      // 3. Re-apply typing mutation during burst
      state.value = `Acute Coronary Syndrome in progress - key ${i}`;

      // 4. Restore active state
      restoreActiveFieldState(state);

      const snapEnd = performance.now();
      renderLatencies.push(snapEnd - snapStart);
    }

    const totalTime = performance.now() - startTime;
    const avgLatency = renderLatencies.reduce((a, b) => a + b, 0) / renderLatencies.length;
    const maxLatency = Math.max(...renderLatencies);

    const activeEl = document.getElementById('diag_p1');
    expect(document.activeElement).toBe(activeEl);
    expect(activeEl.value).toBe('Acute Coronary Syndrome in progress - key 99');
    expect(totalTime).toBeLessThan(1000); // 100 bursts complete in < 1 second
    expect(avgLatency).toBeLessThan(50); // Average per-frame snapshot overhead < 50ms

    console.log(`[Load Test Result] 100 Realtime Snapshot Bursts: Total ${totalTime.toFixed(2)} ms | Avg per-rebuild ${avgLatency.toFixed(3)} ms | Max ${maxLatency.toFixed(2)} ms.`);
  });
});

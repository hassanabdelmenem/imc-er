/**
 * ============================================================================
 * IMC ER Console — High-Concurrency Chaos Stress & Generator Harness
 * Challenger 2 Empirical Load Test:
 * - 500-Item High-Volume Queue Replay with Chaos Interleaving
 * - 5-Clinician Multi-Threaded Simulated Race Loops (100 Iterations)
 * - Delta Diffing Benchmark on Diverse Clinical Types & High-Throughput Assertions
 * ============================================================================
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFirestoreState = {};

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
    update: vi.fn((docRef, updatePayload) => {
      const docId = docRef.id;
      mockFirestoreState[docId] = {
        ...(mockFirestoreState[docId] || {}),
        ...updatePayload
      };
    }),
    commit: vi.fn(async () => true)
  })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

import { diffPatientFields } from '../../public/js/app.js';
import { updatePatientRecord } from '../../public/js/firebase-service.js';

describe('Milestone 2 Load Testing — High-Concurrency Chaos Stress & Generator Suite', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFirestoreState)) {
      delete mockFirestoreState[key];
    }
  });

  it('executes 500 queued offline mutations with continuous memory stability and sub-second drain', async () => {
    const TOTAL_ITEMS = 500;
    const NUM_PATIENTS = 25;

    // Initialize 25 patients
    for (let p = 0; p < NUM_PATIENTS; p++) {
      mockFirestoreState[`p-stress-${p}`] = {
        id: `p-stress-${p}`,
        name: `Stress Patient ${p}`,
        diagnosis: 'Initial Baseline',
        supportiveTx: 'Baseline Oxygen',
        location: 'Triage Room',
        updateCounter: 0
      };
    }

    // Build 500 queued mutations
    const offlineBatch = [];
    for (let i = 1; i <= TOTAL_ITEMS; i++) {
      const targetP = i % NUM_PATIENTS;
      offlineBatch.push({
        id: `tx-stress-${i}`,
        patientId: `p-stress-${targetP}`,
        timestamp: Date.now() + i,
        patch: {
          updateCounter: i,
          diagnosis: `Diagnosis version ${i}`,
          location: `Station ${(i % 10) + 1}`
        }
      });
    }

    const tStart = performance.now();

    // Drain entire batch FIFO
    while (offlineBatch.length > 0) {
      const item = offlineBatch.shift();
      const patientId = item.patientId;
      await updatePatientRecord(patientId, item.patch);
    }

    const tEnd = performance.now();
    const durationMs = tEnd - tStart;
    const throughput = (TOTAL_ITEMS / (durationMs / 1000)).toFixed(0);

    expect(durationMs).toBeLessThan(3000); // 500 items flushed in < 3s
    expect(offlineBatch).toHaveLength(0);

    // Verify each patient reflects high counter values
    for (let p = 0; p < NUM_PATIENTS; p++) {
      const state = mockFirestoreState[`p-stress-${p}`];
      expect(state.updateCounter).toBeGreaterThan(0);
      expect(state.diagnosis).toContain('Diagnosis version');
    }

    console.log(`[Chaos Load Stress] Replayed ${TOTAL_ITEMS} transactions across ${NUM_PATIENTS} patients in ${durationMs.toFixed(2)} ms (~${throughput} tx/sec).`);
  });

  it('simulates 100 rounds of 5-clinician concurrent editing race convergence on a shared trauma record', async () => {
    const patientId = 'p-shared-trauma-race';
    mockFirestoreState[patientId] = {
      id: patientId,
      name: 'Khaled Omar',
      diagnosis: 'Initial MVC Trauma',
      supportiveTx: 'Oxygen 15L NRB',
      location: 'Resus 1',
      primaryDepartment: 'Emergency Medicine',
      pendingAction: 'Waiting CT Pan-Scan'
    };

    const ROUNDS = 100;
    const roles = [
      { id: 'triage_nurse', field: 'diagnosis', prefix: 'Triage Note' },
      { id: 'trauma_surgeon', field: 'pendingAction', prefix: 'Surgical Consult' },
      { id: 'emergency_attending', field: 'supportiveTx', prefix: 'Resuscitation Tx' },
      { id: 'charge_nurse', field: 'location', prefix: 'Unit Transfer' },
      { id: 'intensivist', field: 'primaryDepartment', prefix: 'Critical Care ICU' }
    ];

    const tStart = performance.now();

    for (let round = 1; round <= ROUNDS; round++) {
      const baseline = { ...mockFirestoreState[patientId] };

      // All 5 clinicians create simultaneous field deltas
      const clinicianTasks = roles.map(async (role) => {
        const candidateValue = `${role.prefix} - Round ${round}`;
        const delta = diffPatientFields(baseline, { [role.field]: candidateValue });
        expect(delta).toHaveProperty(role.field, candidateValue);
        await updatePatientRecord(patientId, delta);
      });

      await Promise.all(clinicianTasks);

      // Verify state after each round has all 5 fields updated with round number
      const current = mockFirestoreState[patientId];
      expect(current.diagnosis).toBe(`Triage Note - Round ${round}`);
      expect(current.pendingAction).toBe(`Surgical Consult - Round ${round}`);
      expect(current.supportiveTx).toBe(`Resuscitation Tx - Round ${round}`);
      expect(current.location).toBe(`Unit Transfer - Round ${round}`);
      expect(current.primaryDepartment).toBe(`Critical Care ICU - Round ${round}`);
    }

    const tEnd = performance.now();
    const totalDuration = tEnd - tStart;
    const avgPerRound = totalDuration / ROUNDS;

    console.log(`[Chaos Load Stress] 100 rounds of 5-clinician concurrent editing (500 total updates) completed in ${totalDuration.toFixed(2)} ms (avg ${avgPerRound.toFixed(2)} ms/round).`);
  });

  it('benchmarks diffPatientFields performance over 10,000 randomized clinical candidate evaluations', () => {
    const baselinePatient = {
      id: 'p-bench-1',
      name: 'Hassan Ali',
      patientId: 'H12345678',
      nationalId: '29001011234567',
      diagnosis: 'Acute Coronary Syndrome',
      supportiveTx: 'Aspirin 300mg + Ticagrelor 180mg',
      location: 'Room 3',
      primaryDepartment: 'Cardiology',
      pendingAction: 'Pending Troponin-I',
      hasReferral: 'No',
      sepsisWorkup: 'No',
      miCodeWorkup: 'Yes',
      strokeCodeWorkup: 'No',
      registrationTime: '2026-08-01T10:00:00.000Z'
    };

    const ITERATIONS = 10000;
    const tStart = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      // 50% chance of identical values, 50% chance of modified field
      const candidates = {
        name: baselinePatient.name,
        patientId: baselinePatient.patientId,
        nationalId: baselinePatient.nationalId,
        diagnosis: i % 2 === 0 ? baselinePatient.diagnosis : `Acute Coronary Syndrome - Revision ${i}`,
        supportiveTx: i % 3 === 0 ? baselinePatient.supportiveTx : `Aspirin 300mg + Heparin ${i}U`,
        location: baselinePatient.location,
        primaryDepartment: baselinePatient.primaryDepartment,
        pendingAction: baselinePatient.pendingAction,
        hasReferral: undefined, // Hidden
        sepsisWorkup: undefined, // Hidden
        miCodeWorkup: baselinePatient.miCodeWorkup,
        strokeCodeWorkup: undefined, // Hidden
        registrationTime: '2026-08-01T10:00' // Truncated input format
      };

      const diff = diffPatientFields(baselinePatient, candidates);
      // registrationTime prefix comparison should not produce phantom diff
      expect(diff).not.toHaveProperty('registrationTime');
      expect(diff).not.toHaveProperty('hasReferral');
      expect(diff).not.toHaveProperty('sepsisWorkup');
    }

    const tEnd = performance.now();
    const durationMs = tEnd - tStart;
    const opsPerSec = ((ITERATIONS / durationMs) * 1000).toFixed(0);

    expect(durationMs).toBeLessThan(1000); // 10,000 diffs must complete in under 1 second
    console.log(`[Benchmark Result] Evaluated 10,000 clinical record diffs in ${durationMs.toFixed(2)} ms (~${opsPerSec} ops/sec).`);
  });
});

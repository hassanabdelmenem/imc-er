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

describe('Multi-Clinician Concurrency & Collision Resolution Integration', () => {
  const patientId = 'patient-coll-101';

  beforeEach(() => {
    mockFirestoreState[patientId] = {
      id: patientId,
      name: 'Khaled Ibrahim',
      patientId: 'H112233445',
      diagnosis: 'Undifferentiated Chest Pain',
      supportiveTx: 'Oxygen 4L NC',
      location: 'Room 2',
      primaryDepartment: 'Emergency Medicine',
      pendingAction: 'Waiting ECG',
      sepsisWorkup: 'No',
      lastModified: '2026-08-02T10:00:00.000Z'
    };
  });

  it('merges disjoint field edits from two clinicians without clobbering', async () => {
    const initialPatient = { ...mockFirestoreState[patientId] };

    // Clinician A (Dr. Sara) changes diagnosis to "STEMI"
    const deltaSara = diffPatientFields(initialPatient, {
      diagnosis: 'Acute Anterior STEMI',
      location: initialPatient.location,
      supportiveTx: initialPatient.supportiveTx
    });
    expect(deltaSara).toEqual({ diagnosis: 'Acute Anterior STEMI' });
    await updatePatientRecord(patientId, deltaSara);

    // Clinician B (Dr. Youssef) concurrently moves patient to "Cath Lab"
    const deltaYoussef = diffPatientFields(initialPatient, {
      diagnosis: initialPatient.diagnosis,
      location: 'Cath Lab',
      supportiveTx: initialPatient.supportiveTx
    });
    expect(deltaYoussef).toEqual({ location: 'Cath Lab' });
    await updatePatientRecord(patientId, deltaYoussef);

    // Merged state in Firestore must contain both edits
    expect(mockFirestoreState[patientId].diagnosis).toBe('Acute Anterior STEMI');
    expect(mockFirestoreState[patientId].location).toBe('Cath Lab');
    expect(mockFirestoreState[patientId].supportiveTx).toBe('Oxygen 4L NC');
  });

  it('retains in-flight typing across interleaved snapshot arrivals and subsequent commits', async () => {
    let clientDoctorState = { ...mockFirestoreState[patientId] };

    // Doctor A begins typing supportive therapy locally
    const uncommittedLocalSupportive = 'Aspirin 300mg + Ticagrelor 180mg + Heparin 5000 IU IV';

    // Doctor B pushes location update to "Resus 1"
    const deltaDoctorB = diffPatientFields(mockFirestoreState[patientId], { location: 'Resus 1' });
    await updatePatientRecord(patientId, deltaDoctorB);

    // Realtime snapshot arrives on Doctor A's client, updating server fields but not in-progress typing
    clientDoctorState = {
      ...mockFirestoreState[patientId]
    };

    // Doctor A finishes typing and blurs/commits supportiveTx
    const deltaDoctorA = diffPatientFields(clientDoctorState, {
      supportiveTx: uncommittedLocalSupportive,
      location: clientDoctorState.location
    });

    expect(deltaDoctorA).toEqual({ supportiveTx: uncommittedLocalSupportive });
    await updatePatientRecord(patientId, deltaDoctorA);

    // State in Firestore reflects Doctor B's location and Doctor A's supportiveTx
    expect(mockFirestoreState[patientId].location).toBe('Resus 1');
    expect(mockFirestoreState[patientId].supportiveTx).toBe(uncommittedLocalSupportive);
  });

  it('resolves same-field collision deterministically via Last-Write-Wins (LWW)', async () => {
    const baseline = { ...mockFirestoreState[patientId] };

    // Clinician 1 modifies diagnosis at T1
    const delta1 = diffPatientFields(baseline, { diagnosis: 'Severe Sepsis' });
    await updatePatientRecord(patientId, delta1);
    expect(mockFirestoreState[patientId].diagnosis).toBe('Severe Sepsis');

    // Clinician 2 modifies same field to "Septic Shock with MODS" at T2
    const delta2 = diffPatientFields(baseline, { diagnosis: 'Septic Shock with MODS' });
    await updatePatientRecord(patientId, delta2);

    // LWW ensures T2 write prevails deterministically
    expect(mockFirestoreState[patientId].diagnosis).toBe('Septic Shock with MODS');
  });

  it('isolates workup box flags when hidden workup selectors evaluate to undefined candidates', async () => {
    // Set Sepsis workup flag to Yes
    mockFirestoreState[patientId].sepsisWorkup = 'Yes';
    const serverPatient = { ...mockFirestoreState[patientId] };

    // Colleague updates location while sepsis workup box is hidden in their UI
    const colleagueCandidates = {
      location: 'ICU Bed 4',
      sepsisWorkup: undefined, // Hidden alert box returns undefined
      miCodeWorkup: undefined
    };

    const delta = diffPatientFields(serverPatient, colleagueCandidates);
    expect(delta).toEqual({ location: 'ICU Bed 4' });
    await updatePatientRecord(patientId, delta);

    // Sepsis flag remains untouched in Firestore
    expect(mockFirestoreState[patientId].location).toBe('ICU Bed 4');
    expect(mockFirestoreState[patientId].sepsisWorkup).toBe('Yes');
  });

  it('preserves custom department and custom action strings during peer updates', async () => {
    const initial = { ...mockFirestoreState[patientId] };

    // Clinician sets custom department "Vascular Surgery"
    const deptDelta = diffPatientFields(initial, { primaryDepartment: 'Vascular Surgery' });
    await updatePatientRecord(patientId, deptDelta);

    // Peer sets custom pending action "Waiting Angio Suite"
    const current = { ...mockFirestoreState[patientId] };
    const actionDelta = diffPatientFields(current, { pendingAction: 'Waiting Angio Suite' });
    await updatePatientRecord(patientId, actionDelta);

    expect(mockFirestoreState[patientId].primaryDepartment).toBe('Vascular Surgery');
    expect(mockFirestoreState[patientId].pendingAction).toBe('Waiting Angio Suite');
  });
});

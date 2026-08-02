import { describe, it, expect, vi } from 'vitest';

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
  collection: vi.fn(), onSnapshot: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(),
  doc: vi.fn(), deleteDoc: vi.fn(), setDoc: vi.fn(), getDoc: vi.fn(),
  writeBatch: vi.fn(), query: vi.fn(), orderBy: vi.fn(), limit: vi.fn()
}));

import { diffPatientFields } from '../../public/js/app.js';

/**
 * Several staff use the board simultaneously. A blanket write of every field
 * would clobber a colleague's concurrent edit to a different field on the same
 * patient, so only genuinely-changed fields may be sent to Firestore.
 */
describe('Concurrent editing — only changed fields are written', () => {
  const patient = {
    name: 'محمد أحمد',
    patientId: 'A123456789',
    diagnosis: 'Sepsis',
    supportiveTx: 'Oxygen 2L',
    location: 'Room 3',
    pendingAction: 'Waiting ICU',
    registrationTime: '2026-08-02T09:30:00.000Z'
  };

  it('returns nothing when no field changed', () => {
    const result = diffPatientFields(patient, {
      name: 'محمد أحمد',
      diagnosis: 'Sepsis',
      location: 'Room 3'
    });
    expect(result).toEqual({});
  });

  it('writes only the single field the user actually edited', () => {
    const result = diffPatientFields(patient, {
      name: 'محمد أحمد',
      diagnosis: 'Septic shock',
      supportiveTx: 'Oxygen 2L',
      location: 'Room 3'
    });
    expect(result).toEqual({ diagnosis: 'Septic shock' });
  });

  it('does not clobber a colleague\'s field that this user never touched', () => {
    // This browser still holds a stale `location` of "Room 3" while another
    // user has already moved the patient to "Room 4". Editing only the
    // diagnosis here must not push the stale location back to Firestore.
    const serverSideUpdated = { ...patient, location: 'Room 4' };
    const result = diffPatientFields(serverSideUpdated, {
      diagnosis: 'Septic shock',
      location: 'Room 4'
    });
    expect(result).toEqual({ diagnosis: 'Septic shock' });
    expect(result).not.toHaveProperty('location');
  });

  it('skips undefined candidates (hidden workup boxes are not being edited)', () => {
    const result = diffPatientFields(patient, {
      diagnosis: 'Sepsis',
      sepsisWorkup: undefined,
      miCodeWorkup: undefined
    });
    expect(result).toEqual({});
  });

  it('treats a missing stored field as empty string, not undefined', () => {
    const result = diffPatientFields(patient, { hasReferral: 'Yes' });
    expect(result).toEqual({ hasReferral: 'Yes' });
  });

  it('does not report a phantom diff for datetime-local second truncation', () => {
    // The input yields "2026-08-02T09:30"; the stored ISO string carries
    // seconds and milliseconds. These represent the same instant.
    const result = diffPatientFields(patient, { registrationTime: '2026-08-02T09:30' });
    expect(result).toEqual({});
  });

  it('still detects a genuine registrationTime change', () => {
    const result = diffPatientFields(patient, { registrationTime: '2026-08-02T11:45' });
    expect(result).toEqual({ registrationTime: '2026-08-02T11:45' });
  });

  it('collects multiple genuinely-changed fields together', () => {
    const result = diffPatientFields(patient, {
      diagnosis: 'NSTEMI',
      pendingAction: 'Waiting CCU',
      location: 'Room 3'
    });
    expect(result).toEqual({ diagnosis: 'NSTEMI', pendingAction: 'Waiting CCU' });
  });
});

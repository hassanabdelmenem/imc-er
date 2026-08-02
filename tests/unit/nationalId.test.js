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
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn()
}));

vi.mock('../../public/js/firebase-service.js', () => ({
  initAuthListener: vi.fn(),
  loginWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  getUserRole: vi.fn(),
  logAction: vi.fn(),
  getPatientsList: vi.fn(),
  addPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatientRecord: vi.fn(),
  purgeDischargedPatients: vi.fn(),
  purgeAllPatients: vi.fn(),
  saveUserRole: vi.fn(),
  deleteUserRole: vi.fn(),
  auth: {},
  db: {}
}));
vi.mock('../../public/js/firebase-service.js?v=20260706_02', () => ({
  initAuthListener: vi.fn(),
  loginWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  getUserRole: vi.fn(),
  logAction: vi.fn(),
  getPatientsList: vi.fn(),
  addPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatientRecord: vi.fn(),
  purgeDischargedPatients: vi.fn(),
  purgeAllPatients: vi.fn(),
  saveUserRole: vi.fn(),
  deleteUserRole: vi.fn(),
  auth: {},
  db: {}
}));

import { calculateAgeAndGender, formatElapsedHours, formatDurationString } from '../../public/js/app.js';

describe('Phase 1: Unit Testing - 14-digit Egyptian National ID Parser', () => {
  it('correctly parses valid 1900s Male National ID', () => {
    // Index 12 is '5' (odd -> Male), birthdate 1990-01-01
    const result = calculateAgeAndGender('29001011234557');
    expect(result).toContain('Male');
    expect(result).toMatch(/\|\s*\d+\s*yrs/);
  });

  it('correctly parses valid 2000s Female National ID', () => {
    // Index 12 is '6' (even -> Female), birthdate 2000-05-15
    const result = calculateAgeAndGender('30005151234567');
    expect(result).toContain('Female');
    expect(result).toMatch(/\|\s*\d+\s*yrs/);
  });

  it('correctly parses 14-digit strings without hyphens or spaces', () => {
    const cleanId = '29001011234557';
    expect(cleanId).not.toContain('-');
    expect(cleanId).toHaveLength(14);
    const result = calculateAgeAndGender(cleanId);
    expect(result).toContain('Male');
  });

  it('returns "--" for invalid lengths (< 14 or > 14 digits)', () => {
    expect(calculateAgeAndGender('123456789')).toBe('--');
    expect(calculateAgeAndGender('2900101123456789')).toBe('--');
  });

  it('returns "--" for non-numeric strings', () => {
    expect(calculateAgeAndGender('abcdefghijklmn')).toBe('--');
    expect(calculateAgeAndGender('2900101123456a')).toBe('--');
  });

  it('returns "--" for invalid months (month 00 or month 13)', () => {
    expect(calculateAgeAndGender('29000011234557')).toBe('--');
    expect(calculateAgeAndGender('29013011234557')).toBe('--');
  });

  it('returns "--" for invalid days (day 00 or day 32 or Feb 30)', () => {
    expect(calculateAgeAndGender('29001001234557')).toBe('--');
    expect(calculateAgeAndGender('29001321234557')).toBe('--');
    expect(calculateAgeAndGender('29002301234557')).toBe('--'); // Feb 30 in non-leap year 1990
  });

  it('returns "--" for null, undefined, or empty values', () => {
    expect(calculateAgeAndGender(null)).toBe('--');
    expect(calculateAgeAndGender(undefined)).toBe('--');
    expect(calculateAgeAndGender('')).toBe('--');
  });
});

describe('Phase 1: Unit Testing - Time & Duration Formatting Utilities', () => {
  it('computes formatElapsedHours correctly', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const elapsed = formatElapsedHours(twoHoursAgo);
    expect(elapsed).toBeCloseTo(2, 1);
  });

  it('computes formatDurationString correctly', () => {
    const start = new Date(Date.now() - 3 * 3600 * 1000 - 15 * 60 * 1000).toISOString();
    const end = new Date().toISOString();
    const duration = formatDurationString(start, end);
    expect(duration).toBe('3h 15m');
  });
});

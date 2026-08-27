/**
 * ============================================================================
 * IMC ER Console — Milestone 3 Empirical Challenger 2 Adversarial Test Suite
 * ============================================================================
 * Exhaustive boundary, negative RBAC, malformed input, and AI gating test suite.
 * Covers:
 * 1. Demographics & Registration Boundary Testing (Arabic Regex, Hospital ID Regex, 14-digit Egyptian NID)
 * 2. Negative RBAC Assertions across all 7 role personas against Firestore Rules Engine
 * 3. Edge AI Discharge Attestation Gating & Bypass Defense
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'test-user-id' } })),
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
    delete: vi.fn(),
    set: vi.fn(),
    commit: vi.fn(async () => true)
  })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
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
  updatePatientRecord: vi.fn(async () => true),
  dischargePatientRecord: vi.fn(async () => true),
  auth: { currentUser: { uid: 'test-user-id' } },
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
  updatePatientRecord: vi.fn(async () => true),
  dischargePatientRecord: vi.fn(async () => true),
  auth: { currentUser: { uid: 'test-user-id' } },
  db: {}
}));

import {
  ROLE_OWNER,
  ROLE_CHIEF_NURSE,
  LEADERSHIP_ROLES,
  CLINICAL_ROLES,
  ASSIGNABLE_ROLES,
  OWNER_EMAILS
} from '../../public/js/config.js';

import '../../public/js/edge-ai-service.js';
import { calculateAgeAndGender, formatElapsedHours, formatDurationString } from '../../public/js/app.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

/**
 * High-fidelity Cloud Firestore Security Rules Engine mirroring firestore.rules
 */
class FirestoreRulesEngine {
  constructor(initialDocs = {}) {
    this.db = new Map(Object.entries(initialDocs));
  }

  setDoc(docPath, data) {
    this.db.set(docPath, data);
  }

  getDoc(docPath) {
    return this.db.get(docPath) || null;
  }

  hasDoc(docPath) {
    return this.db.has(docPath);
  }

  isAuthenticated(auth) {
    return auth != null;
  }

  ownerEmails() {
    return OWNER_EMAILS;
  }

  leadershipRoles() {
    return LEADERSHIP_ROLES;
  }

  clinicalRoles() {
    return CLINICAL_ROLES;
  }

  assignableRoles() {
    return ['owner', 'medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse', 'pending', 'blocked'];
  }

  hasUserDoc(auth) {
    return this.isAuthenticated(auth) && this.hasDoc(`users/${auth.uid}`);
  }

  storedRole(auth) {
    if (!this.hasUserDoc(auth)) return 'pending';
    const doc = this.getDoc(`users/${auth.uid}`);
    return doc && doc.role ? doc.role : 'pending';
  }

  isOwner(auth) {
    if (!this.isAuthenticated(auth)) return false;
    const tokenRole = auth.token?.role || '';
    const tokenEmail = auth.token?.email || '';
    return (
      tokenRole === 'owner' ||
      this.ownerEmails().includes(tokenEmail) ||
      this.storedRole(auth) === 'owner'
    );
  }

  isLeadership(auth) {
    return this.isAuthenticated(auth) && this.leadershipRoles().includes(this.storedRole(auth));
  }

  isClinicalStaff(auth) {
    return this.isOwner(auth) || (this.isAuthenticated(auth) && this.clinicalRoles().includes(this.storedRole(auth)));
  }

  isValidPatientData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 100)) return false;
    if (data.nationalId !== undefined && (typeof data.nationalId !== 'string' || data.nationalId.length > 14)) return false;
    if (data.diagnosis !== undefined && (typeof data.diagnosis !== 'string' || data.diagnosis.length > 1000)) return false;
    if (data.supportiveTx !== undefined && (typeof data.supportiveTx !== 'string' || data.supportiveTx.length > 1000)) return false;
    if (data.patientId !== undefined && (typeof data.patientId !== 'string' || data.patientId.length > 50)) return false;
    if (data.status !== undefined && (typeof data.status !== 'string' || data.status.length > 100)) return false;
    if (data.pendingAction !== undefined && (typeof data.pendingAction !== 'string' || data.pendingAction.length > 100)) return false;
    if (data.primaryDepartment !== undefined && (typeof data.primaryDepartment !== 'string' || data.primaryDepartment.length > 100)) return false;
    if (data.dischargeSummary !== undefined && (typeof data.dischargeSummary !== 'string' || data.dischargeSummary.length > 20000)) return false;
    return true;
  }

  isDischargedRecord(existingDoc) {
    if (!existingDoc) return false;
    return existingDoc.isDischarged === true || existingDoc.status === 'Discharged';
  }

  evalPatientRead(auth, patientId) {
    return this.isClinicalStaff(auth);
  }

  evalPatientCreate(auth, patientId, newDoc) {
    return this.isClinicalStaff(auth) && this.isValidPatientData(newDoc);
  }

  evalPatientUpdate(auth, patientId, newDoc) {
    return this.isClinicalStaff(auth) && this.isValidPatientData(newDoc);
  }

  evalPatientDelete(auth, patientId) {
    const existingDoc = this.getDoc(`patients/${patientId}`);
    return this.isOwner(auth) || (this.isLeadership(auth) && this.isDischargedRecord(existingDoc));
  }

  evalUserRead(auth, targetUserId) {
    return this.isOwner(auth) || (this.isAuthenticated(auth) && auth.uid === targetUserId);
  }

  evalUserCreate(auth, targetUserId, newDoc) {
    if (!this.isAuthenticated(auth)) return false;
    const role = newDoc.role || '';
    if (!this.assignableRoles().includes(role)) return false;
    return (auth.uid === targetUserId && role === 'pending') || this.isOwner(auth);
  }

  evalUserUpdate(auth, targetUserId, newDoc) {
    if (!this.isAuthenticated(auth)) return false;
    const newRole = newDoc.role || '';
    if (!this.assignableRoles().includes(newRole)) return false;
    if (this.isOwner(auth)) return true;
    const existingDoc = this.getDoc(`users/${targetUserId}`);
    const currentRole = existingDoc?.role || 'pending';
    return auth.uid === targetUserId && (newRole === currentRole || newRole === 'pending');
  }

  evalUserDelete(auth, targetUserId) {
    return this.isOwner(auth);
  }

  evalSettingsWrite(auth, docId) {
    return this.isOwner(auth);
  }

  evalSettingsRead(auth, docId) {
    return this.isClinicalStaff(auth);
  }
}

describe('Adversarial Boundary Suite 1: Registration Demographics & Input Sanitization', () => {
  const arabicRegex = /^[\u0600-\u06FF\s]+$/;
  const hospitalIdRegex = /^[A-Z]\d{9}$/;

  describe('Arabic Name Regex Validation', () => {
    it('accepts valid multi-word Arabic names with spaces', () => {
      expect(arabicRegex.test('أحمد محمد علي')).toBe(true);
      expect(arabicRegex.test('فاطمة الزهراء إبراهيم')).toBe(true);
      expect(arabicRegex.test('عبد الرحمن محمود')).toBe(true);
      expect(arabicRegex.test('يوسف هاني كمال الدين')).toBe(true);
    });

    it('rejects Latin alphabetic characters and names', () => {
      expect(arabicRegex.test('John Doe')).toBe(false);
      expect(arabicRegex.test('Ahmed')).toBe(false);
      expect(arabicRegex.test('Sara Ali')).toBe(false);
    });

    it('rejects mixed Arabic and English characters', () => {
      expect(arabicRegex.test('أحمد Smith')).toBe(false);
      expect(arabicRegex.test('Dr. محمد')).toBe(false);
      expect(arabicRegex.test('فاطمة Alex')).toBe(false);
    });

    it('rejects ASCII numbers, digits, and special characters', () => {
      expect(arabicRegex.test('أحمد 123')).toBe(false);
      expect(arabicRegex.test('محمد_علي')).toBe(false);
      expect(arabicRegex.test('فاطمة @#$')).toBe(false);
      expect(arabicRegex.test('123456')).toBe(false);
    });

    it('rejects XSS vectors, injection payloads, and empty strings', () => {
      expect(arabicRegex.test('<script>alert(1)</script>')).toBe(false);
      expect(arabicRegex.test('<img src=x onerror=alert(1)>')).toBe(false);
      expect(arabicRegex.test('')).toBe(false);
    });
  });

  describe('Hospital ID Format Validation (^[A-Z]\\d{9}$)', () => {
    it('accepts valid 1-Letter + 9-Digit format', () => {
      expect(hospitalIdRegex.test('H123456789')).toBe(true);
      expect(hospitalIdRegex.test('A000000001')).toBe(true);
      expect(hospitalIdRegex.test('Z999999999')).toBe(true);
    });

    it('rejects lowercase prefix letters', () => {
      expect(hospitalIdRegex.test('h123456789')).toBe(false);
      expect(hospitalIdRegex.test('a000000001')).toBe(false);
    });

    it('rejects incorrect digit counts (too short or too long)', () => {
      expect(hospitalIdRegex.test('H12345678')).toBe(false);
      expect(hospitalIdRegex.test('H1234567890')).toBe(false);
      expect(hospitalIdRegex.test('H123')).toBe(false);
      expect(hospitalIdRegex.test('H')).toBe(false);
    });

    it('rejects multi-letter prefixes or symbols', () => {
      expect(hospitalIdRegex.test('IMC-123456')).toBe(false);
      expect(hospitalIdRegex.test('ER123456789')).toBe(false);
      expect(hospitalIdRegex.test('H-123456789')).toBe(false);
      expect(hospitalIdRegex.test('1234567890')).toBe(false);
    });
  });

  describe('Egyptian National ID (14-digit) Demographics Parser', () => {
    it('correctly decodes 20th century male (century = 2, odd digit 13)', () => {
      const parsed = calculateAgeAndGender('28507140101235');
      expect(parsed).toContain('Male');
      expect(parsed).toMatch(/\d+\s*yrs/);
    });

    it('correctly decodes 20th century female (century = 2, even digit 13)', () => {
      const parsed = calculateAgeAndGender('29211200201248');
      expect(parsed).toContain('Female');
      expect(parsed).toMatch(/\d+\s*yrs/);
    });

    it('correctly decodes 21st century male (century = 3, odd digit 13)', () => {
      const parsed = calculateAgeAndGender('30403100100571');
      expect(parsed).toContain('Male');
      expect(parsed).toMatch(/\d+\s*yrs/);
    });

    it('correctly decodes 21st century female (century = 3, even digit 13)', () => {
      const parsed = calculateAgeAndGender('31508250100582');
      expect(parsed).toContain('Female');
      expect(parsed).toMatch(/\d+\s*yrs/);
    });

    it('rejects invalid century indicator digits (0, 1, 4, 5, 9)', () => {
      expect(calculateAgeAndGender('09501010101235')).toBe('--');
      expect(calculateAgeAndGender('19501010101235')).toBe('--');
      expect(calculateAgeAndGender('49501010101235')).toBe('--');
      expect(calculateAgeAndGender('59501010101235')).toBe('--');
      expect(calculateAgeAndGender('99501010101235')).toBe('--');
    });

    it('rejects invalid calendar months (00, 13, 99)', () => {
      expect(calculateAgeAndGender('29500010101235')).toBe('--');
      expect(calculateAgeAndGender('29513010101235')).toBe('--');
      expect(calculateAgeAndGender('29599010101235')).toBe('--');
    });

    it('rejects invalid calendar days (00, 32, 99)', () => {
      expect(calculateAgeAndGender('29501000101235')).toBe('--');
      expect(calculateAgeAndGender('29501320101235')).toBe('--');
      expect(calculateAgeAndGender('29501990101235')).toBe('--');
    });

    it('rejects month/day length mismatches (e.g. Feb 30, Feb 31, April 31)', () => {
      expect(calculateAgeAndGender('29002300101235')).toBe('--');
      expect(calculateAgeAndGender('29002310101235')).toBe('--');
      expect(calculateAgeAndGender('29004310101235')).toBe('--');
      expect(calculateAgeAndGender('29006310101235')).toBe('--');
    });

    it('correctly accepts leap year Feb 29 (e.g. year 2000 or 2004) and rejects non-leap Feb 29 (e.g. 1990)', () => {
      expect(calculateAgeAndGender('30402290100571')).not.toBe('--');
      expect(calculateAgeAndGender('29002290101235')).toBe('--');
    });

    it('rejects future birth dates (e.g. 2030, 2099)', () => {
      expect(calculateAgeAndGender('33001010100571')).toBe('--');
      expect(calculateAgeAndGender('39901010100571')).toBe('--');
    });

    it('rejects non-numeric and malformed string lengths', () => {
      expect(calculateAgeAndGender('290010112345')).toBe('--');
      expect(calculateAgeAndGender('2900101123456')).toBe('--');
      expect(calculateAgeAndGender('290010112345678')).toBe('--');
      expect(calculateAgeAndGender('2900101123456A')).toBe('--');
      expect(calculateAgeAndGender('2900101-123456')).toBe('--');
      expect(calculateAgeAndGender('')).toBe('--');
      expect(calculateAgeAndGender(null)).toBe('--');
      expect(calculateAgeAndGender(undefined)).toBe('--');
    });
  });
});

describe('Adversarial Boundary Suite 2: Negative RBAC Matrix across all 7 Roles', () => {
  let engine;

  const authOwner = { uid: 'u-owner', token: { role: 'owner' } };
  const authMedDir = { uid: 'u-meddir', token: {} };
  const authEmergMgr = { uid: 'u-emergmgr', token: {} };
  const authDeputyMgr = { uid: 'u-deputymgr', token: {} };
  const authChiefNurse = { uid: 'u-chiefnurse', token: {} };
  const authPending = { uid: 'u-pending', token: {} };
  const authBlocked = { uid: 'u-blocked', token: {} };
  const authUnregistered = { uid: 'u-anon', token: {} };

  beforeEach(() => {
    engine = new FirestoreRulesEngine({
      'users/u-owner': { role: 'owner', email: 'owner@imc.com' },
      'users/u-meddir': { role: 'medical_director', email: 'meddir@imc.com' },
      'users/u-emergmgr': { role: 'emergency_manager', email: 'emergmgr@imc.com' },
      'users/u-deputymgr': { role: 'emergency_deputy_manager', email: 'deputymgr@imc.com' },
      'users/u-chiefnurse': { role: 'chief_nurse', email: 'nurse@imc.com' },
      'users/u-pending': { role: 'pending', email: 'pending@imc.com' },
      'users/u-blocked': { role: 'blocked', email: 'blocked@imc.com' },

      'patients/p-active': {
        name: 'أحمد محمود',
        patientId: 'H123456789',
        nationalId: '29001010101235',
        status: 'Active',
        isDischarged: false,
        location: 'Room 3'
      },
      'patients/p-discharged': {
        name: 'منى خليل',
        patientId: 'H987654321',
        nationalId: '30205100101246',
        status: 'Discharged',
        isDischarged: true,
        dischargeOutcome: 'Improved'
      },
      'settings/general': { allowBatchPurge: true }
    });
  });

  describe('Role: Chief Nurse (chief_nurse)', () => {
    it('ALLOWS clinical board reads, patient creation, and patient updates', () => {
      expect(engine.evalPatientRead(authChiefNurse, 'p-active')).toBe(true);
      expect(engine.evalPatientCreate(authChiefNurse, 'p-new', { name: 'عمر خالد', status: 'Active' })).toBe(true);
      expect(engine.evalPatientUpdate(authChiefNurse, 'p-active', { supportiveTx: 'Oxygen 4L/min' })).toBe(true);
    });

    it('STRICTLY DENIES deleting active patient records', () => {
      expect(engine.evalPatientDelete(authChiefNurse, 'p-active')).toBe(false);
    });

    it('STRICTLY DENIES deleting discharged patient records (purge is leadership/owner only)', () => {
      expect(engine.evalPatientDelete(authChiefNurse, 'p-discharged')).toBe(false);
    });

    it('STRICTLY DENIES modifying user roles or deleting user accounts', () => {
      expect(engine.evalUserUpdate(authChiefNurse, 'u-pending', { role: 'chief_nurse' })).toBe(false);
      expect(engine.evalUserDelete(authChiefNurse, 'u-pending')).toBe(false);
    });

    it('STRICTLY DENIES writing to /settings', () => {
      expect(engine.evalSettingsWrite(authChiefNurse, 'general')).toBe(false);
    });
  });

  describe('Role: Leadership Tier (medical_director, emergency_manager, emergency_deputy_manager)', () => {
    const leadershipList = [
      { name: 'medical_director', auth: authMedDir },
      { name: 'emergency_manager', auth: authEmergMgr },
      { name: 'emergency_deputy_manager', auth: authDeputyMgr }
    ];

    leadershipList.forEach(({ name, auth }) => {
      it(`[${name}] ALLOWS clinical board reads, writes, and discharged patient purges`, () => {
        expect(engine.evalPatientRead(auth, 'p-active')).toBe(true);
        expect(engine.evalPatientCreate(auth, 'p-new', { name: 'سامي يوسف' })).toBe(true);
        expect(engine.evalPatientUpdate(auth, 'p-active', { pendingAction: 'Waiting ICU' })).toBe(true);
        expect(engine.evalPatientDelete(auth, 'p-discharged')).toBe(true);
      });

      it(`[${name}] STRICTLY DENIES deleting ACTIVE patient records (owner only)`, () => {
        expect(engine.evalPatientDelete(auth, 'p-active')).toBe(false);
      });

      it(`[${name}] STRICTLY DENIES modifying user accounts or role promotion`, () => {
        expect(engine.evalUserUpdate(auth, 'u-pending', { role: 'chief_nurse' })).toBe(false);
        expect(engine.evalUserDelete(auth, 'u-pending')).toBe(false);
      });

      it(`[${name}] STRICTLY DENIES writing to /settings (owner only)`, () => {
        expect(engine.evalSettingsWrite(auth, 'general')).toBe(false);
      });
    });
  });

  describe('Role: System Owner (owner)', () => {
    it('ALLOWS full access: clinical reads/writes, active & discharged deletions, user administration, settings write', () => {
      expect(engine.evalPatientRead(authOwner, 'p-active')).toBe(true);
      expect(engine.evalPatientCreate(authOwner, 'p-new', { name: 'طارق حسام' })).toBe(true);
      expect(engine.evalPatientUpdate(authOwner, 'p-active', { diagnosis: 'Severe Sepsis' })).toBe(true);
      expect(engine.evalPatientDelete(authOwner, 'p-active')).toBe(true);
      expect(engine.evalPatientDelete(authOwner, 'p-discharged')).toBe(true);
      expect(engine.evalUserRead(authOwner, 'u-pending')).toBe(true);
      expect(engine.evalUserUpdate(authOwner, 'u-pending', { role: 'chief_nurse' })).toBe(true);
      expect(engine.evalUserDelete(authOwner, 'u-blocked')).toBe(true);
      expect(engine.evalSettingsWrite(authOwner, 'general')).toBe(true);
    });
  });

  describe('Role: Pending User (pending) & Unregistered Account', () => {
    [
      { name: 'pending', auth: authPending },
      { name: 'unregistered', auth: authUnregistered }
    ].forEach(({ name, auth }) => {
      it(`[${name}] STRICTLY DENIES reading any patient PHI`, () => {
        expect(engine.evalPatientRead(auth, 'p-active')).toBe(false);
        expect(engine.evalPatientRead(auth, 'p-discharged')).toBe(false);
      });

      it(`[${name}] STRICTLY DENIES creating, updating, or deleting patients`, () => {
        expect(engine.evalPatientCreate(auth, 'p-hack', { name: 'مخترق' })).toBe(false);
        expect(engine.evalPatientUpdate(auth, 'p-active', { diagnosis: 'Hacked' })).toBe(false);
        expect(engine.evalPatientDelete(auth, 'p-active')).toBe(false);
      });

      it(`[${name}] STRICTLY DENIES reading other user docs or escalating role to owner/chief_nurse`, () => {
        expect(engine.evalUserRead(auth, 'u-owner')).toBe(false);
        expect(engine.evalUserUpdate(auth, auth.uid, { role: 'owner' })).toBe(false);
        expect(engine.evalUserUpdate(auth, auth.uid, { role: 'chief_nurse' })).toBe(false);
      });

      it(`[${name}] STRICTLY DENIES writing /settings`, () => {
        expect(engine.evalSettingsWrite(auth, 'general')).toBe(false);
      });
    });
  });

  describe('Role: Blocked User (blocked)', () => {
    it('STRICTLY DENIES patient reads, writes, deletions, and user management', () => {
      expect(engine.evalPatientRead(authBlocked, 'p-active')).toBe(false);
      expect(engine.evalPatientCreate(authBlocked, 'p-hack', { name: 'ممنوع' })).toBe(false);
      expect(engine.evalPatientUpdate(authBlocked, 'p-active', { status: 'Discharged' })).toBe(false);
      expect(engine.evalPatientDelete(authBlocked, 'p-discharged')).toBe(false);
      expect(engine.evalUserUpdate(authBlocked, 'u-blocked', { role: 'chief_nurse' })).toBe(false);
      expect(engine.evalSettingsWrite(authBlocked, 'general')).toBe(false);
    });
  });
});

describe('Adversarial Boundary Suite 3: Edge AI Discharge Attestation Gating & Bypass Defense', () => {
  let alertSpy;

  beforeEach(() => {
    document.body.innerHTML = indexHtml;
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    window.patientsList = [
      {
        id: 'p-adv-1',
        name: 'عماد فاروق',
        patientId: 'H334455667',
        department: 'Cardiology',
        diagnosis: 'Acute Coronary Syndrome',
        dischargeSummary: 'Existing verified summary',
        dischargeSummaryAttested: true
      }
    ];
  });

  afterEach(() => {
    alertSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('Bypass Attack 3.1: saveAISummaryInModal rejects empty summary box with alert', async () => {
    document.getElementById('discharge-patient-id').value = 'p-adv-1';
    const editor = document.getElementById('ai-summary-editor');
    editor.value = '   ';
    const checkbox = document.getElementById('ai-attestation-checkbox');
    checkbox.checked = true;

    await window.saveAISummaryInModal();

    expect(alertSpy).toHaveBeenCalledWith('Summary box is empty');
  });

  it('Bypass Attack 3.2: saveAISummaryInModal rejects valid text when attestation checkbox is unchecked', async () => {
    document.getElementById('discharge-patient-id').value = 'p-adv-1';
    const editor = document.getElementById('ai-summary-editor');
    editor.value = 'Unreviewed generated AI summary draft text';
    const checkbox = document.getElementById('ai-attestation-checkbox');
    checkbox.checked = false;

    await window.saveAISummaryInModal();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
  });

  it('Bypass Attack 3.3: Generating new AI summary automatically resets/unchecks attestation checkbox', async () => {
    document.getElementById('discharge-patient-id').value = 'p-adv-1';
    const checkbox = document.getElementById('ai-attestation-checkbox');
    checkbox.checked = true;

    await window.generateAISummaryInModal();

    expect(checkbox.checked).toBe(false);
  });
});

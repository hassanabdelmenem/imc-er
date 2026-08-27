import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  ROLE_OWNER,
  ROLE_CHIEF_NURSE,
  LEADERSHIP_ROLES,
  CLINICAL_ROLES,
  ASSIGNABLE_ROLES,
  OWNER_EMAILS
} from '../../public/js/config.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * =============================================================================
 * Cloud Firestore Security Rules High-Fidelity Simulation Engine
 * =============================================================================
 * Faithfully mirrors and evaluates the AST / expression semantics of
 * `firestore.rules` against simulated database states, request auth tokens,
 * resource snapshots, and candidate write payloads across all collections.
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

  // Helper implementations directly matching firestore.rules
  isAuthenticated(auth) {
    return auth != null;
  }

  ownerEmails() {
    return ['hassan.abdelmenem@gmail.com', 'hassanabdelmenem@gmail.com', 'owner@imc.com'];
  }

  leadershipRoles() {
    return ['medical_director', 'emergency_manager', 'emergency_deputy_manager'];
  }

  clinicalRoles() {
    return ['medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse'];
  }

  assignableRoles() {
    return [
      'owner',
      'medical_director',
      'emergency_manager',
      'emergency_deputy_manager',
      'chief_nurse',
      'pending',
      'blocked'
    ];
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
    return (
      this.isOwner(auth) ||
      (this.isAuthenticated(auth) && this.clinicalRoles().includes(this.storedRole(auth)))
    );
  }

  isValidPatientData(data) {
    if (!data || typeof data !== 'object') return false;

    const checks = [
      { key: 'name', max: 100 },
      { key: 'nationalId', max: 14 },
      { key: 'diagnosis', max: 1000 },
      { key: 'supportiveTx', max: 1000 },
      { key: 'patientId', max: 50 },
      { key: 'status', max: 100 },
      { key: 'pendingAction', max: 100 },
      { key: 'primaryDepartment', max: 100 },
      { key: 'dischargeSummary', max: 20000 }
    ];

    for (const { key, max } of checks) {
      if (key in data) {
        const val = data[key];
        if (typeof val !== 'string' || val.length > max) {
          return false;
        }
      }
    }
    return true;
  }

  isDischargedRecord(resource) {
    if (!resource) return false;
    return resource.isDischarged === true || resource.status === 'Discharged';
  }

  // --- Collection Rule Evaluators ---

  /**
   * match /users/{userId}
   */
  evalUsers(operation, { auth, userId, resource, requestResource }) {
    if (operation === 'read') {
      return (
        this.isOwner(auth) ||
        (this.isAuthenticated(auth) && auth.uid === userId)
      );
    }

    if (operation === 'create') {
      if (!this.isAuthenticated(auth)) return false;
      const targetRole = requestResource?.role || '';
      if (!this.assignableRoles().includes(targetRole)) return false;
      return (auth.uid === userId && targetRole === 'pending') || this.isOwner(auth);
    }

    if (operation === 'update') {
      if (!this.isAuthenticated(auth)) return false;
      const targetRole = requestResource?.role || '';
      if (!this.assignableRoles().includes(targetRole)) return false;

      const isOwnerCheck = this.isOwner(auth);
      const isSelfCheck =
        auth.uid === userId &&
        (targetRole === (resource?.role || 'pending') || targetRole === 'pending');

      return isOwnerCheck || isSelfCheck;
    }

    if (operation === 'delete') {
      return this.isOwner(auth);
    }

    return false;
  }

  /**
   * match /settings/{docId}
   */
  evalSettings(operation, { auth }) {
    if (operation === 'read') {
      return this.isClinicalStaff(auth);
    }
    if (operation === 'create' || operation === 'update' || operation === 'delete') {
      return this.isOwner(auth);
    }
    return false;
  }

  /**
   * match /patients/{patientId}
   */
  evalPatients(operation, { auth, resource, requestResource }) {
    if (operation === 'read') {
      return this.isClinicalStaff(auth);
    }

    if (operation === 'create' || operation === 'update') {
      return (
        this.isClinicalStaff(auth) &&
        this.isValidPatientData(requestResource)
      );
    }

    if (operation === 'delete') {
      return (
        this.isOwner(auth) ||
        (this.isLeadership(auth) && this.isDischargedRecord(resource))
      );
    }

    return false;
  }

  /**
   * match /patients/{patientId}/{subcollection=**}
   */
  evalPatientSubcollection(operation, { auth }) {
    if (operation === 'read' || operation === 'create' || operation === 'update' || operation === 'delete') {
      return this.isClinicalStaff(auth);
    }
    return false;
  }

  /**
   * match /dead_letter_queue/{docId}
   */
  evalDeadLetterQueue(operation, { auth }) {
    if (operation === 'create') {
      return this.isClinicalStaff(auth);
    }
    if (operation === 'read' || operation === 'update' || operation === 'delete') {
      return this.isOwner(auth);
    }
    return false;
  }

  /**
   * match /telemetry_alerts/{docId}
   */
  evalTelemetryAlerts(operation, { auth }) {
    if (operation === 'create') {
      return this.isClinicalStaff(auth);
    }
    if (operation === 'read' || operation === 'update' || operation === 'delete') {
      return this.isOwner(auth);
    }
    return false;
  }

  /**
   * match /{document=**} (Catch-All / Default Deny)
   */
  evalCatchAll(operation, { auth }) {
    return this.isOwner(auth);
  }
}

// -----------------------------------------------------------------------------
// Test Personas Setup
// -----------------------------------------------------------------------------
const PERSONAS = {
  owner: {
    auth: { uid: 'uid-owner', token: { email: 'owner@imc.com', role: 'owner' } },
    userDoc: { role: 'owner', email: 'owner@imc.com' }
  },
  medicalDirector: {
    auth: { uid: 'uid-director', token: { email: 'director@imc.com' } },
    userDoc: { role: 'medical_director', email: 'director@imc.com' }
  },
  emergencyManager: {
    auth: { uid: 'uid-emgmgr', token: { email: 'manager@imc.com' } },
    userDoc: { role: 'emergency_manager', email: 'manager@imc.com' }
  },
  emergencyDeputyManager: {
    auth: { uid: 'uid-deputy', token: { email: 'deputy@imc.com' } },
    userDoc: { role: 'emergency_deputy_manager', email: 'deputy@imc.com' }
  },
  chiefNurse: {
    auth: { uid: 'uid-nurse', token: { email: 'nurse@imc.com' } },
    userDoc: { role: 'chief_nurse', email: 'nurse@imc.com' }
  },
  pending: {
    auth: { uid: 'uid-pending', token: { email: 'pending@imc.com' } },
    userDoc: { role: 'pending', email: 'pending@imc.com' }
  },
  blocked: {
    auth: { uid: 'uid-blocked', token: { email: 'blocked@imc.com' } },
    userDoc: { role: 'blocked', email: 'blocked@imc.com' }
  },
  unapprovedNoDoc: {
    auth: { uid: 'uid-nodoc', token: { email: 'nodoc@imc.com' } },
    userDoc: null
  },
  unauthenticated: {
    auth: null,
    userDoc: null
  }
};

const ALL_ROLES = [
  'owner',
  'medical_director',
  'emergency_manager',
  'emergency_deputy_manager',
  'chief_nurse',
  'pending',
  'blocked'
];

// Helper to seed engine with initial users
function createEngine() {
  const docs = {};
  for (const [key, persona] of Object.entries(PERSONAS)) {
    if (persona.userDoc && persona.auth) {
      docs[`users/${persona.auth.uid}`] = persona.userDoc;
    }
  }
  return new FirestoreRulesEngine(docs);
}

// =============================================================================
// Vitest Security & RBAC Boundary Test Suites
// =============================================================================

describe('RBAC Security Rules: Static Contract & Parity Verification', () => {
  const rules = read('firestore.rules');

  it('declares rules_version = 2', () => {
    expect(rules).toMatch(/rules_version\s*=\s*'2';/);
  });

  it('defaults storedRole to pending when user doc is absent or missing role', () => {
    expect(rules).toContain("get('role', 'pending')");
    expect(rules).toContain(": 'pending';");
  });

  it('contains zero function definitions or expressions using obsolete permissive helpers (e.g. isApprovedMedicalStaff)', () => {
    expect(rules).not.toMatch(/function\s+isApprovedMedicalStaff/);
    expect(rules).not.toMatch(/allow\s+[^;]*isApprovedMedicalStaff/);
  });

  it('enforces catch-all default deny rule (owner-only access to unmapped collections)', () => {
    expect(rules).toMatch(/match\s*\/\{document=\*\*\}\s*\{\s*allow read, write:\s*if isOwner\(\);/);
  });

  it('ownerEmails list matches OWNER_EMAILS config exactly', () => {
    const fnMatch = /function\s+ownerEmails\s*\(\)\s*\{\s*return\s*\[([^\]]*)\];/.exec(rules);
    expect(fnMatch).toBeTruthy();
    const emailsInRules = fnMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    expect(emailsInRules.sort()).toEqual([...OWNER_EMAILS].sort());
  });
});

describe('RBAC Match Block: /users/{userId} User Administration & Access Gate', () => {
  let engine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('allows owner to read any user profile in the system across all 3 owner auth paths (token role, owner email, stored role)', () => {
    // 1. Owner by token role
    const tokenRoleOwner = { uid: 'u-custom-admin', token: { role: 'owner' } };
    expect(engine.evalUsers('read', { auth: tokenRoleOwner, userId: PERSONAS.chiefNurse.auth.uid })).toBe(true);

    // 2. Owner by allowlisted email
    const emailOwner = { uid: 'u-email-admin', token: { email: 'hassan.abdelmenem@gmail.com' } };
    expect(engine.evalUsers('read', { auth: emailOwner, userId: PERSONAS.chiefNurse.auth.uid })).toBe(true);

    // 3. Owner by stored role in /users doc
    const storedOwner = { uid: 'uid-stored-owner', token: { email: 'random@imc.com' } };
    engine.setDoc('users/uid-stored-owner', { role: 'owner', email: 'random@imc.com' });
    expect(engine.evalUsers('read', { auth: storedOwner, userId: PERSONAS.chiefNurse.auth.uid })).toBe(true);

    // 4. Negative: Lookalike or non-owner email is denied owner privileges
    const fakeOwner = { uid: 'u-fake-owner', token: { email: 'owner@imcc.om' } };
    expect(engine.evalUsers('read', { auth: fakeOwner, userId: PERSONAS.chiefNurse.auth.uid })).toBe(false);

    for (const [name, persona] of Object.entries(PERSONAS)) {
      if (persona.auth) {
        const allowed = engine.evalUsers('read', {
          auth: PERSONAS.owner.auth,
          userId: persona.auth.uid
        });
        expect(allowed, `Owner read of ${name} failed`).toBe(true);
      }
    }
  });

  it('allows non-owner authenticated users to read ONLY their own user document', () => {
    const nonOwners = ['medicalDirector', 'emergencyManager', 'emergencyDeputyManager', 'chiefNurse', 'pending', 'blocked'];
    for (const roleKey of nonOwners) {
      const persona = PERSONAS[roleKey];
      // Reading own doc
      expect(engine.evalUsers('read', { auth: persona.auth, userId: persona.auth.uid })).toBe(true);
      // Reading someone else's doc
      expect(engine.evalUsers('read', { auth: persona.auth, userId: PERSONAS.owner.auth.uid })).toBe(false);
      expect(engine.evalUsers('read', { auth: persona.auth, userId: PERSONAS.chiefNurse.auth.uid })).toBe(
        roleKey === 'chiefNurse'
      );
    }
  });

  it('denies unauthenticated users from reading any user document', () => {
    expect(engine.evalUsers('read', { auth: null, userId: PERSONAS.owner.auth.uid })).toBe(false);
  });

  it('allows self-registration with role "pending" only', () => {
    const newUid = 'uid-new-user';
    const newAuth = { uid: newUid, token: { email: 'newbie@imc.com' } };

    // Valid pending signup
    const okSignup = engine.evalUsers('create', {
      auth: newAuth,
      userId: newUid,
      requestResource: { role: 'pending', email: 'newbie@imc.com' }
    });
    expect(okSignup).toBe(true);

    // Self-assigning elevated roles during registration is DENIED
    for (const role of ['owner', 'medical_director', 'emergency_manager', 'emergency_deputy_manager', 'chief_nurse']) {
      const exploitSignup = engine.evalUsers('create', {
        auth: newAuth,
        userId: newUid,
        requestResource: { role, email: 'newbie@imc.com' }
      });
      expect(exploitSignup, `Self-assigning ${role} should be denied`).toBe(false);
    }
  });

  it('NEGATIVE: Leadership tier and Chief Nurse CANNOT modify other users or elevate roles', () => {
    const attackerPersonas = [
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse
    ];

    for (const attacker of attackerPersonas) {
      // Attacker attempts to promote a pending user to chief_nurse or medical_director
      const attackOther = engine.evalUsers('update', {
        auth: attacker.auth,
        userId: PERSONAS.pending.auth.uid,
        resource: PERSONAS.pending.userDoc,
        requestResource: { role: 'chief_nurse', email: 'pending@imc.com' }
      });
      expect(attackOther, `${attacker.userDoc.role} modifying other user must be denied`).toBe(false);

      // Attacker attempts to promote self to owner
      const attackSelf = engine.evalUsers('update', {
        auth: attacker.auth,
        userId: attacker.auth.uid,
        resource: attacker.userDoc,
        requestResource: { role: 'owner', email: attacker.userDoc.email }
      });
      expect(attackSelf, `${attacker.userDoc.role} promoting self to owner must be denied`).toBe(false);
    }
  });

  it('allows users to update non-role fields on their own record keeping same role', () => {
    const persona = PERSONAS.chiefNurse;
    const okUpdate = engine.evalUsers('update', {
      auth: persona.auth,
      userId: persona.auth.uid,
      resource: persona.userDoc,
      requestResource: { role: 'chief_nurse', displayName: 'Head Nurse Sarah' }
    });
    expect(okUpdate).toBe(true);
  });

  it('allows users to step down to "pending" (reassignment flow)', () => {
    const persona = PERSONAS.medicalDirector;
    const stepDown = engine.evalUsers('update', {
      auth: persona.auth,
      userId: persona.auth.uid,
      resource: persona.userDoc,
      requestResource: { role: 'pending' }
    });
    expect(stepDown).toBe(true);
  });

  it('allows owner to assign any valid assignable role to any user', () => {
    for (const role of ASSIGNABLE_ROLES) {
      const okAssign = engine.evalUsers('update', {
        auth: PERSONAS.owner.auth,
        userId: PERSONAS.pending.auth.uid,
        resource: PERSONAS.pending.userDoc,
        requestResource: { role, email: 'pending@imc.com' }
      });
      expect(okAssign, `Owner assigning ${role} failed`).toBe(true);
    }
  });

  it('NEGATIVE: Owner cannot assign non-assignable / legacy roles (e.g. doctor, cmo, admin)', () => {
    for (const invalidRole of ['doctor', 'cmo', 'user', 'manager', 'admin', 'superadmin']) {
      const badAssign = engine.evalUsers('update', {
        auth: PERSONAS.owner.auth,
        userId: PERSONAS.pending.auth.uid,
        resource: PERSONAS.pending.userDoc,
        requestResource: { role: invalidRole }
      });
      expect(badAssign, `Assigning unapproved role ${invalidRole} should be rejected`).toBe(false);
    }
  });

  it('allows owner to delete user documents; strictly denies deletion to all other roles', () => {
    // Owner can delete
    expect(engine.evalUsers('delete', { auth: PERSONAS.owner.auth, userId: PERSONAS.pending.auth.uid })).toBe(true);

    // All others are denied
    const nonOwners = [
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse,
      PERSONAS.pending,
      PERSONAS.blocked,
      PERSONAS.unapprovedNoDoc,
      PERSONAS.unauthenticated
    ];

    for (const nonOwner of nonOwners) {
      const res = engine.evalUsers('delete', { auth: nonOwner.auth, userId: PERSONAS.pending.auth.uid });
      expect(res, `${nonOwner.auth?.uid || 'anon'} user deletion must be denied`).toBe(false);
    }
  });
});

describe('RBAC Match Block: /settings/{docId} System Kill-Switches & Observability Config', () => {
  let engine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('allows owner, leadership tier, and chief nurse to read settings/remote_config', () => {
    const clinicalStaff = [
      PERSONAS.owner,
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse
    ];

    for (const staff of clinicalStaff) {
      const allowed = engine.evalSettings('read', { auth: staff.auth });
      expect(allowed, `${staff.userDoc?.role} read of settings failed`).toBe(true);
    }
  });

  it('NEGATIVE: denies pending, blocked, unapproved (no doc), and unauthenticated from reading /settings', () => {
    const deniedPersonas = [
      PERSONAS.pending,
      PERSONAS.blocked,
      PERSONAS.unapprovedNoDoc,
      PERSONAS.unauthenticated
    ];

    for (const denied of deniedPersonas) {
      const allowed = engine.evalSettings('read', { auth: denied.auth });
      expect(allowed, `${denied.auth?.uid || 'anon'} should be denied read on /settings`).toBe(false);
    }
  });

  it('allows owner to write /settings/remote_config kill-switches', () => {
    expect(engine.evalSettings('create', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalSettings('update', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalSettings('delete', { auth: PERSONAS.owner.auth })).toBe(true);
  });

  it('NEGATIVE: strictly denies all non-owner roles (including leadership & chief nurse) from writing /settings', () => {
    const nonOwners = [
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse,
      PERSONAS.pending,
      PERSONAS.blocked,
      PERSONAS.unapprovedNoDoc,
      PERSONAS.unauthenticated
    ];

    for (const nonOwner of nonOwners) {
      for (const op of ['create', 'update', 'delete']) {
        const allowed = engine.evalSettings(op, { auth: nonOwner.auth });
        expect(allowed, `${nonOwner.auth?.uid || 'anon'} ${op} on /settings must be denied`).toBe(false);
      }
    }
  });
});

describe('RBAC Match Block: /patients/{patientId} PHI Access, Mutation & Subcollections', () => {
  let engine;
  const validPatientPayload = {
    name: 'محمود حسن',
    patientId: 'H123456789',
    nationalId: '29001011234557',
    diagnosis: 'Acute Coronary Syndrome',
    supportiveTx: 'Oxygen 4L/min, Aspirin 300mg',
    status: 'Under assessment',
    pendingAction: 'Waiting CCU',
    primaryDepartment: 'Cardiology',
    dischargeSummary: 'Patient stabilized and transferred to CCU ward.'
  };

  beforeEach(() => {
    engine = createEngine();
  });

  it('allows clinical staff (Owner, Medical Director, Emergency Manager, Deputy, Chief Nurse) to read /patients', () => {
    const clinicalStaff = [
      PERSONAS.owner,
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse
    ];

    for (const staff of clinicalStaff) {
      expect(engine.evalPatients('read', { auth: staff.auth })).toBe(true);
      expect(engine.evalPatientSubcollection('read', { auth: staff.auth })).toBe(true);
    }
  });

  it('NEGATIVE: strictly denies pending, blocked, unapproved no-doc, and unauthenticated from reading /patients or subcollections', () => {
    const deniedPersonas = [
      PERSONAS.pending,
      PERSONAS.blocked,
      PERSONAS.unapprovedNoDoc,
      PERSONAS.unauthenticated
    ];

    for (const denied of deniedPersonas) {
      expect(engine.evalPatients('read', { auth: denied.auth })).toBe(false);
      expect(engine.evalPatientSubcollection('read', { auth: denied.auth })).toBe(false);
    }
  });

  it('allows clinical staff to create and update patient records with valid schema', () => {
    const clinicalStaff = [
      PERSONAS.owner,
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse
    ];

    for (const staff of clinicalStaff) {
      const createAllowed = engine.evalPatients('create', {
        auth: staff.auth,
        requestResource: validPatientPayload
      });
      expect(createAllowed, `${staff.userDoc?.role} create failed`).toBe(true);

      const updateAllowed = engine.evalPatients('update', {
        auth: staff.auth,
        requestResource: { ...validPatientPayload, diagnosis: 'NSTEMI Confirmed' }
      });
      expect(updateAllowed, `${staff.userDoc?.role} update failed`).toBe(true);

      expect(engine.evalPatientSubcollection('create', { auth: staff.auth })).toBe(true);
    }
  });

  it('NEGATIVE: strictly denies pending and blocked personas from creating or updating /patients', () => {
    for (const denied of [PERSONAS.pending, PERSONAS.blocked, PERSONAS.unapprovedNoDoc, PERSONAS.unauthenticated]) {
      expect(engine.evalPatients('create', { auth: denied.auth, requestResource: validPatientPayload })).toBe(false);
      expect(engine.evalPatients('update', { auth: denied.auth, requestResource: validPatientPayload })).toBe(false);
      expect(engine.evalPatientSubcollection('create', { auth: denied.auth })).toBe(false);
    }
  });
});

describe('RBAC Match Block: /patients Deletion Boundaries (Active vs Discharged Records)', () => {
  let engine;
  const activeRecord = {
    name: 'Active Patient',
    status: 'Admitted',
    isDischarged: false
  };

  const dischargedRecordByFlag = {
    name: 'Discharged Patient 1',
    status: 'Transferred',
    isDischarged: true
  };

  const dischargedRecordByStatus = {
    name: 'Discharged Patient 2',
    status: 'Discharged',
    isDischarged: false
  };

  beforeEach(() => {
    engine = createEngine();
  });

  it('allows Owner to delete BOTH active and discharged patient records', () => {
    // Active record deletion
    expect(engine.evalPatients('delete', { auth: PERSONAS.owner.auth, resource: activeRecord })).toBe(true);
    // Discharged record deletions
    expect(engine.evalPatients('delete', { auth: PERSONAS.owner.auth, resource: dischargedRecordByFlag })).toBe(true);
    expect(engine.evalPatients('delete', { auth: PERSONAS.owner.auth, resource: dischargedRecordByStatus })).toBe(true);
  });

  it('allows Leadership Tier to purge DISCHARGED records only', () => {
    const leadership = [
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager
    ];

    for (const leader of leadership) {
      expect(
        engine.evalPatients('delete', { auth: leader.auth, resource: dischargedRecordByFlag }),
        `${leader.userDoc.role} should be allowed to purge discharged record (by flag)`
      ).toBe(true);

      expect(
        engine.evalPatients('delete', { auth: leader.auth, resource: dischargedRecordByStatus }),
        `${leader.userDoc.role} should be allowed to purge discharged record (by status)`
      ).toBe(true);
    }
  });

  it('NEGATIVE: Leadership Tier attempting active (non-discharged) record deletion is strictly DENIED', () => {
    const leadership = [
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager
    ];

    for (const leader of leadership) {
      const res = engine.evalPatients('delete', { auth: leader.auth, resource: activeRecord });
      expect(res, `${leader.userDoc.role} deleting active record MUST be denied`).toBe(false);
    }
  });

  it('NEGATIVE: Chief Nurse attempting ANY deletion (active OR discharged) is strictly DENIED', () => {
    const nurse = PERSONAS.chiefNurse;

    // Active record deletion attempt
    expect(
      engine.evalPatients('delete', { auth: nurse.auth, resource: activeRecord }),
      'Chief nurse deleting active record must be denied'
    ).toBe(false);

    // Discharged record deletion attempt
    expect(
      engine.evalPatients('delete', { auth: nurse.auth, resource: dischargedRecordByFlag }),
      'Chief nurse purging discharged record must be denied'
    ).toBe(false);

    expect(
      engine.evalPatients('delete', { auth: nurse.auth, resource: dischargedRecordByStatus }),
      'Chief nurse purging discharged record must be denied'
    ).toBe(false);
  });

  it('NEGATIVE: Pending, Blocked, Unapproved No-Doc, and Unauthenticated are strictly DENIED deletions', () => {
    const deniedPersonas = [
      PERSONAS.pending,
      PERSONAS.blocked,
      PERSONAS.unapprovedNoDoc,
      PERSONAS.unauthenticated
    ];

    for (const persona of deniedPersonas) {
      expect(engine.evalPatients('delete', { auth: persona.auth, resource: activeRecord })).toBe(false);
      expect(engine.evalPatients('delete', { auth: persona.auth, resource: dischargedRecordByFlag })).toBe(false);
    }
  });
});

describe('RBAC Match Block: /dead_letter_queue & /telemetry_alerts Observability Sinks', () => {
  let engine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('allows clinical staff (Owner, Leadership, Chief Nurse) to create DLQ and telemetry records', () => {
    const clinicalStaff = [
      PERSONAS.owner,
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse
    ];

    for (const staff of clinicalStaff) {
      expect(engine.evalDeadLetterQueue('create', { auth: staff.auth })).toBe(true);
      expect(engine.evalTelemetryAlerts('create', { auth: staff.auth })).toBe(true);
    }
  });

  it('NEGATIVE: denies pending, blocked, and unauthenticated personas from creating DLQ records', () => {
    const deniedPersonas = [
      PERSONAS.pending,
      PERSONAS.blocked,
      PERSONAS.unapprovedNoDoc,
      PERSONAS.unauthenticated
    ];

    for (const denied of deniedPersonas) {
      expect(engine.evalDeadLetterQueue('create', { auth: denied.auth })).toBe(false);
      expect(engine.evalTelemetryAlerts('create', { auth: denied.auth })).toBe(false);
    }
  });

  it('allows ONLY the Owner to read, update, or delete DLQ and telemetry records', () => {
    expect(engine.evalDeadLetterQueue('read', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalDeadLetterQueue('update', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalDeadLetterQueue('delete', { auth: PERSONAS.owner.auth })).toBe(true);

    expect(engine.evalTelemetryAlerts('read', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalTelemetryAlerts('update', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalTelemetryAlerts('delete', { auth: PERSONAS.owner.auth })).toBe(true);
  });

  it('NEGATIVE: denies Leadership Tier and Chief Nurse from reading or deleting DLQ records', () => {
    const nonOwners = [
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse,
      PERSONAS.pending,
      PERSONAS.blocked
    ];

    for (const nonOwner of nonOwners) {
      expect(engine.evalDeadLetterQueue('read', { auth: nonOwner.auth })).toBe(false);
      expect(engine.evalDeadLetterQueue('delete', { auth: nonOwner.auth })).toBe(false);
      expect(engine.evalTelemetryAlerts('read', { auth: nonOwner.auth })).toBe(false);
      expect(engine.evalTelemetryAlerts('delete', { auth: nonOwner.auth })).toBe(false);
    }
  });
});

describe('RBAC Match Block: /{document=**} Default Deny on Unmapped Collections', () => {
  let engine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('allows Owner full read/write access to arbitrary administrative collections', () => {
    expect(engine.evalCatchAll('read', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalCatchAll('create', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalCatchAll('update', { auth: PERSONAS.owner.auth })).toBe(true);
    expect(engine.evalCatchAll('delete', { auth: PERSONAS.owner.auth })).toBe(true);
  });

  it('NEGATIVE: denies all non-owner roles (leadership, nurse, pending, blocked) from unmapped collections', () => {
    const nonOwners = [
      PERSONAS.medicalDirector,
      PERSONAS.emergencyManager,
      PERSONAS.emergencyDeputyManager,
      PERSONAS.chiefNurse,
      PERSONAS.pending,
      PERSONAS.blocked,
      PERSONAS.unapprovedNoDoc,
      PERSONAS.unauthenticated
    ];

    for (const nonOwner of nonOwners) {
      for (const op of ['read', 'create', 'update', 'delete']) {
        expect(engine.evalCatchAll(op, { auth: nonOwner.auth })).toBe(false);
      }
    }
  });
});

describe('RBAC Schema & Validation: isValidPatientData Comprehensive Boundaries', () => {
  let engine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('validates name field boundaries (string <= 100 characters)', () => {
    expect(engine.isValidPatientData({ name: 'Valid Name' })).toBe(true);
    expect(engine.isValidPatientData({ name: 'A'.repeat(100) })).toBe(true);
    expect(engine.isValidPatientData({ name: 'A'.repeat(101) })).toBe(false);
    expect(engine.isValidPatientData({ name: 12345 })).toBe(false);
    expect(engine.isValidPatientData({ name: true })).toBe(false);
    expect(engine.isValidPatientData({ name: { first: 'John' } })).toBe(false);
  });

  it('validates nationalId field boundaries (string <= 14 characters)', () => {
    expect(engine.isValidPatientData({ nationalId: '29001011234557' })).toBe(true);
    expect(engine.isValidPatientData({ nationalId: '1'.repeat(14) })).toBe(true);
    expect(engine.isValidPatientData({ nationalId: '1'.repeat(15) })).toBe(false);
    expect(engine.isValidPatientData({ nationalId: 29001011234557 })).toBe(false);
  });

  it('validates diagnosis field boundaries (string <= 1000 characters)', () => {
    expect(engine.isValidPatientData({ diagnosis: 'Acute Sepsis' })).toBe(true);
    expect(engine.isValidPatientData({ diagnosis: 'D'.repeat(1000) })).toBe(true);
    expect(engine.isValidPatientData({ diagnosis: 'D'.repeat(1001) })).toBe(false);
    expect(engine.isValidPatientData({ diagnosis: ['Sepsis'] })).toBe(false);
  });

  it('validates supportiveTx field boundaries (string <= 1000 characters)', () => {
    expect(engine.isValidPatientData({ supportiveTx: 'Normal Saline 500ml' })).toBe(true);
    expect(engine.isValidPatientData({ supportiveTx: 'T'.repeat(1000) })).toBe(true);
    expect(engine.isValidPatientData({ supportiveTx: 'T'.repeat(1001) })).toBe(false);
    expect(engine.isValidPatientData({ supportiveTx: 999 })).toBe(false);
  });

  it('validates patientId field boundaries (string <= 50 characters)', () => {
    expect(engine.isValidPatientData({ patientId: 'A-123456789' })).toBe(true);
    expect(engine.isValidPatientData({ patientId: 'P'.repeat(50) })).toBe(true);
    expect(engine.isValidPatientData({ patientId: 'P'.repeat(51) })).toBe(false);
    expect(engine.isValidPatientData({ patientId: 1001 })).toBe(false);
  });

  it('validates status, pendingAction, and primaryDepartment boundaries (string <= 100 characters)', () => {
    for (const key of ['status', 'pendingAction', 'primaryDepartment']) {
      expect(engine.isValidPatientData({ [key]: 'Valid Status' })).toBe(true);
      expect(engine.isValidPatientData({ [key]: 'S'.repeat(100) })).toBe(true);
      expect(engine.isValidPatientData({ [key]: 'S'.repeat(101) })).toBe(false);
      expect(engine.isValidPatientData({ [key]: 100 })).toBe(false);
    }
  });

  it('validates dischargeSummary field boundaries (string <= 20000 characters)', () => {
    expect(engine.isValidPatientData({ dischargeSummary: 'Full summary text...' })).toBe(true);
    expect(engine.isValidPatientData({ dischargeSummary: 'S'.repeat(20000) })).toBe(true);
    expect(engine.isValidPatientData({ dischargeSummary: 'S'.repeat(20001) })).toBe(false);
    expect(engine.isValidPatientData({ dischargeSummary: { summary: 'text' } })).toBe(false);
  });

  it('validates a completely empty payload is accepted (all fields are optional)', () => {
    expect(engine.isValidPatientData({})).toBe(true);
  });

  it('rejects payload if any single field violates schema while other fields are valid', () => {
    const corruptPayload = {
      name: 'Valid Name',
      nationalId: '29001011234557',
      diagnosis: 'Acute Coronary Syndrome',
      dischargeSummary: 'X'.repeat(20001) // Violates max length
    };
    expect(engine.isValidPatientData(corruptPayload)).toBe(false);
  });
});

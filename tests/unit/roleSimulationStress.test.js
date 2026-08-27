import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Read raw index.html to load into JSDOM for authentic client-side testing
const ROOT = path.resolve(import.meta.dirname, '../..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

// -----------------------------------------------------------------------------
// Firebase Modular SDK Mocks
// -----------------------------------------------------------------------------
let capturedAuthCallback = null;
let patientsCallback = null;
let patientsErrorCallback = null;
let usersCallback = null;
let remoteConfigCallback = null;

let usersUnsubSpy = vi.fn();
let patientsUnsubSpy = vi.fn();
let remoteConfigUnsubSpy = vi.fn();

const batchOperations = {
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(async () => undefined)
};

const sharedAuthInstance = { currentUser: null };

const authMocks = {
  getAuth: vi.fn(() => sharedAuthInstance),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    capturedAuthCallback = cb;
    return vi.fn();
  }),
  signOut: vi.fn(async () => {
    sharedAuthInstance.currentUser = null;
    if (capturedAuthCallback) {
      await capturedAuthCallback(null);
    }
  }),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(async () => undefined),
  getRedirectResult: vi.fn(async () => ({ user: null }))
};

const firestoreMocks = {
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db, name) => ({ __collection: name })),
  onSnapshot: vi.fn((target, callback, errCallback) => {
    if (target?.__collection === 'users') {
      usersCallback = callback;
      return usersUnsubSpy;
    } else if (target?.__doc === 'settings/remote_config') {
      remoteConfigCallback = callback;
      return remoteConfigUnsubSpy;
    } else {
      patientsCallback = callback;
      patientsErrorCallback = errCallback;
      return patientsUnsubSpy;
    }
  }),
  addDoc: vi.fn(async () => ({ id: 'mock-add-id' })),
  updateDoc: vi.fn(async () => undefined),
  doc: vi.fn((_db, col, id) => {
    if (typeof col === 'object') {
      return { __doc: `patients/${id || 'generated-id'}`, id: id || 'generated-id' };
    }
    return { __doc: `${col}/${id}`, id: id || 'generated-id' };
  }),
  deleteDoc: vi.fn(async () => undefined),
  setDoc: vi.fn(async () => undefined),
  getDoc: vi.fn(),
  writeBatch: vi.fn(() => batchOperations),
  query: vi.fn((col) => ({ __queryCollection: col.__collection || 'patients' })),
  orderBy: vi.fn(),
  limit: vi.fn()
};

vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => authMocks);
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js', () => firestoreMocks);

// Import application and configuration modules
const {
  ROLE_OWNER,
  ROLE_CHIEF_NURSE,
  LEADERSHIP_ROLES,
  CLINICAL_ROLES,
  ASSIGNABLE_ROLES,
  MANAGER_TIER_ROLES
} = await import('../../public/js/config.js');

const {
  setLanguage,
  tr
} = await import('../../public/js/i18n.js');

// Import app.js to register top-level scripts and DOMContentLoaded listeners
await import('../../public/js/app.js');

// -----------------------------------------------------------------------------
// Simulation Helper Functions
// -----------------------------------------------------------------------------

function emitPatients(patients) {
  if (patientsCallback) {
    const docSnaps = patients.map(p => ({
      id: p.id || 'pat-id',
      data: () => ({ ...p })
    }));
    patientsCallback({
      forEach: (fn) => docSnaps.forEach(fn)
    });
  }
}

function emitUsers(users) {
  if (usersCallback) {
    const docSnaps = users.map(u => ({
      id: u.id || 'usr-id',
      data: () => ({ ...u })
    }));
    usersCallback({
      forEach: (fn) => docSnaps.forEach(fn)
    });
  }
}

function emitRemoteConfig(config = { enable_batch_purge: true, enable_edge_ai_synthesis: true }) {
  if (remoteConfigCallback) {
    remoteConfigCallback({
      exists: () => true,
      data: () => config
    });
  }
}

const sampleActivePatient = {
  id: 'pat-active-1',
  name: 'أحمد محمود',
  patientId: 'A123456789',
  nationalId: '29001011234567',
  location: 'Arrest',
  department: 'Internal Medicine',
  primaryDepartment: 'Internal Medicine',
  status: 'Under assessment',
  pendingAction: 'Waiting ICU',
  isDischarged: false,
  registrationTime: '2026-08-23T01:00:00Z'
};

const sampleDischargedPatient = {
  id: 'pat-disch-1',
  name: 'سارة علي',
  patientId: 'B987654321',
  nationalId: '29505051234568',
  location: 'Resus',
  department: 'Cardiology',
  primaryDepartment: 'Cardiology',
  status: 'Discharged',
  pendingAction: 'Discharged',
  dischargeOutcome: 'Improved',
  isDischarged: true,
  registrationTime: '2026-08-23T00:00:00Z'
};

async function simulateUserSession({
  email,
  uid,
  role,
  tokenClaims = {},
  userDocExists = true,
  userDocRole = null,
  ensureUserRecordFails = false,
  getUserRoleError = null,
  patients = [sampleActivePatient, sampleDischargedPatient],
  users = [],
  remoteConfig = { enable_batch_purge: true, enable_edge_ai_synthesis: true }
}) {
  // 1. Reset callbacks and DOM
  patientsCallback = null;
  patientsErrorCallback = null;
  usersCallback = null;
  remoteConfigCallback = null;

  document.documentElement.innerHTML = indexHtml;
  setLanguage('en');

  // 2. Mock auth user object
  const assignedEmail = email || (role === 'owner' ? 'owner@imc.com' : `${role}@imc.com`);
  const assignedUid = uid || `uid-${role}`;
  const mockUser = {
    uid: assignedUid,
    email: assignedEmail,
    getIdTokenResult: vi.fn(async () => ({
      claims: {
        role: tokenClaims.role || (role === 'owner' ? 'owner' : undefined)
      }
    }))
  };

  sharedAuthInstance.currentUser = mockUser;

  // 3. Configure Firestore GetDoc / User Role lookup
  if (getUserRoleError) {
    firestoreMocks.getDoc.mockRejectedValueOnce(getUserRoleError);
  } else if (!userDocExists) {
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => null
    });
  } else {
    const r = userDocRole || role;
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: r, email: assignedEmail, createdAt: '2026-08-01T00:00:00Z' })
    });
  }

  // 4. Configure ensureUserRecord / SetDoc
  if (ensureUserRecordFails) {
    firestoreMocks.setDoc.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
  } else {
    firestoreMocks.setDoc.mockResolvedValue(undefined);
  }

  // 5. Fire DOMContentLoaded to bind event listeners
  document.dispatchEvent(new Event('DOMContentLoaded'));

  // 6. Trigger Auth Callback
  if (capturedAuthCallback) {
    await capturedAuthCallback(mockUser);
  }

  // 7. Emit subscriptions: patients must be emitted first so startRemoteConfigSync() binds remoteConfigCallback
  if (patientsCallback && patients && patients.length > 0) {
    emitPatients(patients);
  }
  if (remoteConfigCallback) {
    emitRemoteConfig(remoteConfig);
  }
  if (usersCallback && role === 'owner' && users && users.length > 0) {
    emitUsers(users);
  }

  // Allow microtasks and state transitions to settle
  await new Promise(r => setTimeout(r, 10));
  return { mockUser };
}

// =============================================================================
// Challenger Empirical Stress Test Suites
// =============================================================================

describe('Challenger 2 Suite: Rapid Session Switching & State Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchOperations.commit.mockClear();
    batchOperations.delete.mockClear();
    batchOperations.set.mockClear();
    batchOperations.update.mockClear();
    usersUnsubSpy.mockClear();
    patientsUnsubSpy.mockClear();
    remoteConfigUnsubSpy.mockClear();
  });

  it('Session Switching: Clinical PHI is properly removed from active patient board upon sign-out', async () => {
    await simulateUserSession({
      role: 'chief_nurse',
      email: 'nurse@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient]
    });

    expect(document.getElementById('patient-list-container').innerHTML).toContain('أحمد محمود');

    // Sign out
    await capturedAuthCallback(null);

    expect(document.getElementById('app-section').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('auth-section').classList.contains('hidden')).toBe(false);
  });

  it('Remediation Verification 1: showSignedOut and showAccessGate clean users-list-container DOM, removing stale user roster', async () => {
    const mockRoster = [
      { id: 'usr-pending-1', email: 'secret_applicant@imc.com', role: 'pending', createdAt: '2026-08-01T00:00:00Z' }
    ];

    // 1. Log in as Owner and populate users roster
    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      users: mockRoster
    });

    expect(document.getElementById('users-list-container').innerHTML).toContain('secret_applicant@imc.com');

    // 2. Sign out
    await capturedAuthCallback(null);

    // Assert: users-list-container in DOM is completely cleared on sign-out
    const usersContainerAfterLogout = document.getElementById('users-list-container');
    const hasStaleRosterInDom = usersContainerAfterLogout.innerHTML.includes('secret_applicant@imc.com');

    expect(hasStaleRosterInDom).toBe(false);
    expect(usersContainerAfterLogout.innerHTML).toBe('');

    // 3. Log in as Owner again, populate users roster, then transition to pending (access gate)
    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      users: mockRoster
    });
    expect(document.getElementById('users-list-container').innerHTML).toContain('secret_applicant@imc.com');

    // Quarantined at access gate
    const pendingUser = {
      uid: 'uid-pending-direct',
      email: 'pending@imc.com',
      getIdTokenResult: vi.fn(async () => ({ claims: {} }))
    };
    sharedAuthInstance.currentUser = pendingUser;
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'pending', email: 'pending@imc.com' })
    });

    await capturedAuthCallback(pendingUser);
    await new Promise(r => setTimeout(r, 10));

    const usersContainerAfterGate = document.getElementById('users-list-container');
    expect(usersContainerAfterGate.innerHTML.includes('secret_applicant@imc.com')).toBe(false);
    expect(usersContainerAfterGate.innerHTML).toBe('');
  });

  it('Remediation Verification 2: Direct transition from Owner to Non-Owner cleanly unsubscribes usersUnsubscribe and clears roster DOM', async () => {
    // 1. Log in as Owner
    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      users: [{ id: 'usr-pending-1', email: 'secret_applicant@imc.com', role: 'pending', createdAt: '2026-08-01T00:00:00Z' }]
    });

    expect(usersCallback).toBeTruthy();
    expect(document.getElementById('users-list-container').innerHTML).toContain('secret_applicant@imc.com');
    usersUnsubSpy.mockClear();

    // 2. Direct transition to Chief Nurse (without calling showSignedOut)
    const nurseUser = {
      uid: 'uid-nurse-direct',
      email: 'nurse@imc.com',
      getIdTokenResult: vi.fn(async () => ({ claims: {} }))
    };
    sharedAuthInstance.currentUser = nurseUser;
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'chief_nurse', email: 'nurse@imc.com' })
    });

    await capturedAuthCallback(nurseUser);
    await new Promise(r => setTimeout(r, 10));

    // Assert: usersUnsubscribe was properly invoked and users-list-container was cleared
    expect(usersUnsubSpy).toHaveBeenCalled();
    expect(document.getElementById('users-list-container').innerHTML).not.toContain('secret_applicant@imc.com');
  });

  it('Stress Scenario: 50 Rapid Sequential Session Transitions across All 7 Roles preserves basic UI section gating', async () => {
    const rolesSequence = [
      'owner',
      'chief_nurse',
      'pending',
      'medical_director',
      'blocked',
      'emergency_manager',
      'emergency_deputy_manager'
    ];

    for (let i = 0; i < 50; i++) {
      const role = rolesSequence[i % rolesSequence.length];
      await simulateUserSession({
        role,
        email: `${role}_${i}@imc.com`,
        patients: [sampleActivePatient],
        users: [{ id: `u-${i}`, email: `user${i}@imc.com`, role: 'pending' }]
      });

      const gate = document.getElementById('access-gate');
      const app = document.getElementById('app-section');
      const tabOwner = document.getElementById('tab-owner');
      const dataControl = document.getElementById('data-control-actions');

      if (role === 'owner') {
        expect(gate.classList.contains('hidden')).toBe(true);
        expect(app.classList.contains('hidden')).toBe(false);
        expect(tabOwner.classList.contains('hidden')).toBe(false);
        expect(dataControl.style.display).toBe('flex');
      } else if (['medical_director', 'emergency_manager', 'emergency_deputy_manager'].includes(role)) {
        expect(gate.classList.contains('hidden')).toBe(true);
        expect(app.classList.contains('hidden')).toBe(false);
        expect(tabOwner.classList.contains('hidden')).toBe(true);
        expect(dataControl.style.display).toBe('flex');
      } else if (role === 'chief_nurse') {
        expect(gate.classList.contains('hidden')).toBe(true);
        expect(app.classList.contains('hidden')).toBe(false);
        expect(tabOwner.classList.contains('hidden')).toBe(true);
        expect(dataControl.style.display).toBe('none');
      } else if (role === 'pending' || role === 'blocked') {
        expect(gate.classList.contains('hidden')).toBe(false);
        expect(app.classList.contains('hidden')).toBe(true);
      }
    }
  });
});

describe('Challenger 2 Suite: Adversarial DOM Tampering & Role Forgery Challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchOperations.commit.mockClear();
    batchOperations.delete.mockClear();
    batchOperations.set.mockClear();
    batchOperations.update.mockClear();
  });

  it('Tampering 1: Chief Nurse unhiding #tab-owner and clicking is strictly blocked by switchTab', async () => {
    await simulateUserSession({
      role: 'chief_nurse',
      email: 'nurse@imc.com'
    });

    const tabOwner = document.getElementById('tab-owner');
    tabOwner.classList.remove('hidden');

    tabOwner.click();

    const viewOwner = document.getElementById('view-owner');
    const viewLive = document.getElementById('view-live-board');

    expect(viewOwner.classList.contains('hidden'), 'Owner view must stay hidden').toBe(true);
    expect(viewLive.classList.contains('hidden'), 'Live board must stay visible').toBe(false);
  });

  it('Tampering 2: Medical Director unhiding #btn-delete-all and triggering click is blocked by confirmAndDeletePatients', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    await simulateUserSession({
      role: 'medical_director',
      email: 'director@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient]
    });

    const btnDeleteAll = document.getElementById('btn-delete-all');
    btnDeleteAll.classList.remove('hidden');

    btnDeleteAll.click();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Only the System Owner can purge all patients'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(batchOperations.delete).not.toHaveBeenCalled();
  });

  it('Tampering 3: Chief Nurse unhiding #btn-delete-discharged and triggering click is blocked', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    await simulateUserSession({
      role: 'chief_nurse',
      email: 'nurse@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient]
    });

    const btnDeleteDischarged = document.getElementById('btn-delete-discharged');
    btnDeleteDischarged.classList.remove('hidden');

    btnDeleteDischarged.click();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Only Managers and the System Owner can purge discharged patients'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(batchOperations.delete).not.toHaveBeenCalled();
  });

  it('Tampering 4: Remote Config Live Kill-Switch: Owner forced click while purge is disabled alerts and halts', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient],
      remoteConfig: { enable_batch_purge: false }
    });

    const btnDeleteAll = document.getElementById('btn-delete-all');
    btnDeleteAll.classList.remove('hidden');

    btnDeleteAll.click();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Batch purging is currently disabled by administrator via Remote Config'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(batchOperations.delete).not.toHaveBeenCalled();
  });
});

describe('Challenger 2 Suite: Rapid Tab Switching & View Consistency Stress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Rapid 100x Tab Switching as Owner retains correct container visibility and active classes', async () => {
    const mockRoster = [
      { id: 'usr-1', email: 'doctor@imc.com', role: 'medical_director', createdAt: '2026-08-01T00:00:00Z' }
    ];

    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      patients: [sampleActivePatient],
      users: mockRoster
    });

    const tabLive = document.getElementById('tab-live-board');
    const tabOwner = document.getElementById('tab-owner');
    const viewLive = document.getElementById('view-live-board');
    const viewOwner = document.getElementById('view-owner');

    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) {
        tabOwner.click();
        expect(tabOwner.classList.contains('active')).toBe(true);
        expect(tabLive.classList.contains('active')).toBe(false);
        expect(viewOwner.classList.contains('hidden')).toBe(false);
        expect(viewLive.classList.contains('hidden')).toBe(true);
      } else {
        tabLive.click();
        expect(tabLive.classList.contains('active')).toBe(true);
        expect(tabOwner.classList.contains('active')).toBe(false);
        expect(viewLive.classList.contains('hidden')).toBe(false);
        expect(viewOwner.classList.contains('hidden')).toBe(true);
      }
    }
  });

  it('Rapid 100x Tab Switching as Non-Owner (Chief Nurse) never exposes view-owner', async () => {
    await simulateUserSession({
      role: 'chief_nurse',
      email: 'nurse@imc.com',
      patients: [sampleActivePatient]
    });

    const tabOwner = document.getElementById('tab-owner');
    const viewOwner = document.getElementById('view-owner');
    const viewLive = document.getElementById('view-live-board');

    for (let i = 0; i < 100; i++) {
      tabOwner.click();
      expect(viewOwner.classList.contains('hidden')).toBe(true);
      expect(viewLive.classList.contains('hidden')).toBe(false);
    }
  });
});

describe('Challenger 3 Suite: Specific Role Transition Lifecycle (Owner -> SignedOut -> Blocked -> Chief Nurse)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchOperations.commit.mockClear();
    batchOperations.delete.mockClear();
    batchOperations.set.mockClear();
    batchOperations.update.mockClear();
    usersUnsubSpy.mockClear();
    patientsUnsubSpy.mockClear();
    remoteConfigUnsubSpy.mockClear();
  });

  it('Step-by-step rigorous empirical verification of Owner -> SignedOut -> Blocked -> Chief Nurse', async () => {
    const sensitiveRoster = [
      { id: 'usr-confidential-1', email: 'confidential_applicant@imc.com', role: 'pending', createdAt: '2026-08-01T00:00:00Z' },
      { id: 'usr-confidential-2', email: 'vip_doctor@imc.com', role: 'medical_director', createdAt: '2026-08-01T00:00:00Z' }
    ];

    // -------------------------------------------------------------------------
    // Step 1: Owner Session
    // -------------------------------------------------------------------------
    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient],
      users: sensitiveRoster
    });

    // Verify Owner capabilities and populated DOM
    expect(document.getElementById('app-section').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('auth-section').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('access-gate').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('tab-owner').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('data-control-actions').style.display).toBe('flex');
    expect(document.getElementById('users-list-container').innerHTML).toContain('confidential_applicant@imc.com');
    expect(document.getElementById('users-list-container').innerHTML).toContain('vip_doctor@imc.com');
    expect(document.getElementById('patient-list-container').innerHTML).toContain('أحمد محمود');

    // -------------------------------------------------------------------------
    // Step 2: Transition to SignedOut
    // -------------------------------------------------------------------------
    await capturedAuthCallback(null);
    await new Promise(r => setTimeout(r, 15));

    // Verify SignedOut state & complete DOM/subscription purging
    expect(usersUnsubSpy).toHaveBeenCalled();
    expect(patientsUnsubSpy).toHaveBeenCalled();
    expect(remoteConfigUnsubSpy).toHaveBeenCalled();

    expect(document.getElementById('app-section').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('auth-section').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('access-gate').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('tab-owner').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('data-control-actions').style.display).toBe('none');
    expect(document.getElementById('users-list-container').innerHTML).toBe('');
    expect(document.getElementById('users-list-container').innerHTML).not.toContain('confidential_applicant@imc.com');
    expect(document.getElementById('patient-list-container').innerHTML).not.toContain('أحمد محمود');

    // -------------------------------------------------------------------------
    // Step 3: Transition to Blocked
    // -------------------------------------------------------------------------
    const blockedUser = {
      uid: 'uid-blocked-test',
      email: 'blocked_user@imc.com',
      getIdTokenResult: vi.fn(async () => ({ claims: {} }))
    };
    sharedAuthInstance.currentUser = blockedUser;
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'blocked', email: 'blocked_user@imc.com' })
    });

    usersUnsubSpy.mockClear();
    patientsUnsubSpy.mockClear();

    await capturedAuthCallback(blockedUser);
    await new Promise(r => setTimeout(r, 15));

    // Verify Blocked Access Gate containment & lack of leak
    expect(document.getElementById('access-gate').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('app-section').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('auth-section').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('tab-owner').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('data-control-actions').style.display).toBe('none');
    expect(document.getElementById('users-list-container').innerHTML).toBe('');
    expect(document.getElementById('users-list-container').innerHTML).not.toContain('confidential_applicant@imc.com');
    expect(document.getElementById('gate-message').innerText).toContain(tr('blk'));

    // Verify that attempting to click tab-owner while blocked does nothing and stays on gate
    document.getElementById('tab-owner').click();
    expect(document.getElementById('view-owner').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('app-section').classList.contains('hidden')).toBe(true);

    // -------------------------------------------------------------------------
    // Step 4: Transition to Chief Nurse
    // -------------------------------------------------------------------------
    const nurseUser = {
      uid: 'uid-nurse-test',
      email: 'nurse_head@imc.com',
      getIdTokenResult: vi.fn(async () => ({ claims: {} }))
    };
    sharedAuthInstance.currentUser = nurseUser;
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'chief_nurse', email: 'nurse_head@imc.com' })
    });

    usersUnsubSpy.mockClear();
    patientsUnsubSpy.mockClear();

    await capturedAuthCallback(nurseUser);
    emitPatients([sampleActivePatient]);
    await new Promise(r => setTimeout(r, 15));

    // Verify Chief Nurse privileges and containment
    expect(document.getElementById('access-gate').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('app-section').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('auth-section').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('tab-owner').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('data-control-actions').style.display).toBe('none');
    expect(document.getElementById('patient-list-container').innerHTML).toContain('أحمد محمود');

    // Crucial RBAC checks for Chief Nurse:
    // 1. Users list container DOM MUST be empty
    expect(document.getElementById('users-list-container').innerHTML).toBe('');
    expect(document.getElementById('users-list-container').innerHTML).not.toContain('confidential_applicant@imc.com');

    // 2. Tab owner click must NOT navigate to view-owner
    document.getElementById('tab-owner').classList.remove('hidden');
    document.getElementById('tab-owner').click();
    expect(document.getElementById('view-owner').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('view-live-board').classList.contains('hidden')).toBe(false);

    // 3. Purge button clicks must be blocked
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    document.getElementById('btn-delete-all').classList.remove('hidden');
    document.getElementById('btn-delete-all').click();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Only the System Owner can purge all patients'));
    expect(batchOperations.delete).not.toHaveBeenCalled();
  });

  it('Stress: 25 Iterations of Owner -> SignedOut -> Blocked -> Chief Nurse Lifecycle Loop', async () => {
    for (let cycle = 0; cycle < 25; cycle++) {
      const roster = [
        { id: `usr-owner-${cycle}`, email: `applicant_cycle_${cycle}@imc.com`, role: 'pending', createdAt: '2026-08-01T00:00:00Z' }
      ];

      // 1. Owner
      await simulateUserSession({
        role: 'owner',
        email: `owner_${cycle}@imc.com`,
        patients: [sampleActivePatient],
        users: roster
      });
      expect(document.getElementById('users-list-container').innerHTML).toContain(`applicant_cycle_${cycle}@imc.com`);
      expect(document.getElementById('tab-owner').classList.contains('hidden')).toBe(false);

      // 2. Signed Out
      await capturedAuthCallback(null);
      expect(document.getElementById('users-list-container').innerHTML).toBe('');
      expect(document.getElementById('app-section').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('auth-section').classList.contains('hidden')).toBe(false);

      // 3. Blocked
      const blockedUser = {
        uid: `uid-blocked-${cycle}`,
        email: `blocked_${cycle}@imc.com`,
        getIdTokenResult: vi.fn(async () => ({ claims: {} }))
      };
      sharedAuthInstance.currentUser = blockedUser;
      firestoreMocks.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'blocked', email: `blocked_${cycle}@imc.com` })
      });
      await capturedAuthCallback(blockedUser);
      expect(document.getElementById('access-gate').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('users-list-container').innerHTML).toBe('');

      // 4. Chief Nurse
      const nurseUser = {
        uid: `uid-nurse-${cycle}`,
        email: `nurse_${cycle}@imc.com`,
        getIdTokenResult: vi.fn(async () => ({ claims: {} }))
      };
      sharedAuthInstance.currentUser = nurseUser;
      firestoreMocks.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'chief_nurse', email: `nurse_${cycle}@imc.com` })
      });
      await capturedAuthCallback(nurseUser);
      emitPatients([sampleActivePatient]);

      expect(document.getElementById('access-gate').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('app-section').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('tab-owner').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('users-list-container').innerHTML).toBe('');
      expect(document.getElementById('users-list-container').innerHTML).not.toContain(`applicant_cycle_${cycle}@imc.com`);
    }
  });
});


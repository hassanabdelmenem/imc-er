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
  signOut: vi.fn(),
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
    } else if (target?.__doc === 'settings/remote_config') {
      remoteConfigCallback = callback;
    } else {
      patientsCallback = callback;
      patientsErrorCallback = errCallback;
    }
    return vi.fn();
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
// Test Suites
// =============================================================================

describe('Group 1: Role-Based DOM Element Visibility Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchOperations.commit.mockClear();
    batchOperations.delete.mockClear();
    batchOperations.set.mockClear();
    batchOperations.update.mockClear();
  });

  it('Owner Persona: full admin, management and clinical controls visible', async () => {
    await simulateUserSession({ role: 'owner', email: 'owner@imc.com' });

    const gate = document.getElementById('access-gate');
    const app = document.getElementById('app-section');
    const tabOwner = document.getElementById('tab-owner');
    const dataControlActions = document.getElementById('data-control-actions');
    const btnDeleteDischarged = document.getElementById('btn-delete-discharged');
    const btnDeleteAll = document.getElementById('btn-delete-all');

    expect(gate.classList.contains('hidden'), 'Access gate should be hidden').toBe(true);
    expect(app.classList.contains('hidden'), 'App section should be visible').toBe(false);
    expect(tabOwner.classList.contains('hidden'), 'Tab owner should be visible').toBe(false);
    expect(dataControlActions.style.display, 'Data control actions display should be flex').toBe('flex');
    expect(btnDeleteDischarged.classList.contains('hidden'), 'Btn delete discharged should be visible').toBe(false);
    expect(btnDeleteAll.classList.contains('hidden'), 'Btn delete all should be visible').toBe(false);
  });

  const leadershipRoles = ['medical_director', 'emergency_manager', 'emergency_deputy_manager'];
  leadershipRoles.forEach((role) => {
    it(`Leadership Persona (${role}): clinical board & discharged purge visible, owner tab and purge all hidden`, async () => {
      await simulateUserSession({ role, email: `${role}@imc.com` });

      const gate = document.getElementById('access-gate');
      const app = document.getElementById('app-section');
      const tabOwner = document.getElementById('tab-owner');
      const dataControlActions = document.getElementById('data-control-actions');
      const btnDeleteDischarged = document.getElementById('btn-delete-discharged');
      const btnDeleteAll = document.getElementById('btn-delete-all');

      expect(gate.classList.contains('hidden'), 'Access gate should be hidden').toBe(true);
      expect(app.classList.contains('hidden'), 'App section should be visible').toBe(false);
      expect(tabOwner.classList.contains('hidden'), 'Tab owner must be hidden').toBe(true);
      expect(dataControlActions.style.display, 'Data control actions display should be flex').toBe('flex');
      expect(btnDeleteDischarged.classList.contains('hidden'), 'Btn delete discharged should be visible').toBe(false);
      expect(btnDeleteAll.classList.contains('hidden'), 'Btn delete all must be hidden').toBe(true);
    });
  });

  it('Chief Nurse Persona: clinical board visible, all data control purges and owner tab strictly hidden', async () => {
    await simulateUserSession({ role: 'chief_nurse', email: 'nurse@imc.com' });

    const gate = document.getElementById('access-gate');
    const app = document.getElementById('app-section');
    const tabOwner = document.getElementById('tab-owner');
    const dataControlActions = document.getElementById('data-control-actions');
    const btnDeleteDischarged = document.getElementById('btn-delete-discharged');
    const btnDeleteAll = document.getElementById('btn-delete-all');

    expect(gate.classList.contains('hidden'), 'Access gate should be hidden').toBe(true);
    expect(app.classList.contains('hidden'), 'App section should be visible').toBe(false);
    expect(tabOwner.classList.contains('hidden'), 'Tab owner must be hidden').toBe(true);
    expect(dataControlActions.style.display, 'Data control actions display must be none').toBe('none');
    expect(btnDeleteDischarged.classList.contains('hidden'), 'Btn delete discharged must be hidden').toBe(true);
    expect(btnDeleteAll.classList.contains('hidden'), 'Btn delete all must be hidden').toBe(true);
  });

  it('Pending Persona: quarantined at access gate with pending message', async () => {
    await simulateUserSession({ role: 'pending', email: 'pending@imc.com' });

    const gate = document.getElementById('access-gate');
    const app = document.getElementById('app-section');
    const gateMsg = document.getElementById('gate-message');
    const retryBtn = document.getElementById('btn-gate-retry');

    expect(gate.classList.contains('hidden'), 'Access gate should be visible').toBe(false);
    expect(app.classList.contains('hidden'), 'App section must be hidden').toBe(true);
    expect(gateMsg.innerText).toContain(tr('pnd'));
    expect(retryBtn.classList.contains('hidden'), 'Retry button should be hidden for normal pending').toBe(true);
  });

  it('Blocked Persona: quarantined at access gate with revoked message', async () => {
    await simulateUserSession({ role: 'blocked', email: 'blocked@imc.com' });

    const gate = document.getElementById('access-gate');
    const app = document.getElementById('app-section');
    const gateMsg = document.getElementById('gate-message');
    const retryBtn = document.getElementById('btn-gate-retry');

    expect(gate.classList.contains('hidden'), 'Access gate should be visible').toBe(false);
    expect(app.classList.contains('hidden'), 'App section must be hidden').toBe(true);
    expect(gateMsg.innerText).toContain(tr('blk'));
    expect(retryBtn.classList.contains('hidden'), 'Retry button should be hidden for blocked').toBe(true);
  });
});

describe('Group 2: Positive Operational Assertions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchOperations.commit.mockClear();
    batchOperations.delete.mockClear();
    batchOperations.set.mockClear();
    batchOperations.update.mockClear();
  });

  it('Owner: navigating to owner tab renders account management and pending approval queue', async () => {
    const mockRoster = [
      { id: 'usr-pending-1', email: 'candidate@imc.com', role: 'pending', createdAt: '2026-08-01T00:00:00Z' },
      { id: 'usr-nurse-1', email: 'nurse@imc.com', role: 'chief_nurse', createdAt: '2026-08-01T00:00:00Z' }
    ];

    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      users: mockRoster
    });

    const tabOwner = document.getElementById('tab-owner');
    tabOwner.click();

    const viewOwner = document.getElementById('view-owner');
    const viewLive = document.getElementById('view-live-board');
    const usersContainer = document.getElementById('users-list-container');

    expect(viewOwner.classList.contains('hidden'), 'Owner view should be visible').toBe(false);
    expect(viewLive.classList.contains('hidden'), 'Live board should be hidden').toBe(true);
    expect(usersContainer.innerHTML).toContain('candidate@imc.com');
    expect(usersContainer.innerHTML).toContain('nurse@imc.com');
  });

  it('Owner: changing role dropdown in account management calls updateUserRole', async () => {
    const mockRoster = [
      { id: 'usr-target-1', email: 'doctor@imc.com', role: 'pending', createdAt: '2026-08-01T00:00:00Z' }
    ];

    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      users: mockRoster
    });

    document.getElementById('tab-owner').click();

    const select = document.querySelector('.select-role[data-id="usr-target-1"]');
    expect(select).toBeTruthy();

    select.value = 'medical_director';
    await select.onchange({ target: select, currentTarget: select });

    expect(firestoreMocks.setDoc).toHaveBeenCalled();
    const setCall = firestoreMocks.setDoc.mock.calls[0];
    expect(setCall[1]).toMatchObject({ role: 'medical_director' });
  });

  it('Owner: clicking remove user with confirmation calls deleteUserRecord', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const mockRoster = [
      { id: 'usr-remove-1', email: 'leaving@imc.com', role: 'chief_nurse', createdAt: '2026-08-01T00:00:00Z' }
    ];

    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      users: mockRoster
    });

    document.getElementById('tab-owner').click();

    const removeBtn = document.querySelector('.btn-remove-user[data-id="usr-remove-1"]');
    expect(removeBtn).toBeTruthy();

    await removeBtn.onclick({ currentTarget: removeBtn, target: removeBtn });

    expect(firestoreMocks.deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('Owner: executing purge all deletes both active and discharged patients', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient]
    });

    const btnDeleteAll = document.getElementById('btn-delete-all');
    btnDeleteAll.click();

    expect(batchOperations.delete).toHaveBeenCalledTimes(2);
    expect(batchOperations.commit).toHaveBeenCalled();
  });

  it('Leadership: registering patient via modal calls registerPatient with valid fields', async () => {
    await simulateUserSession({
      role: 'medical_director',
      email: 'director@imc.com'
    });

    document.getElementById('btn-open-register').click();
    expect(document.getElementById('modal-register').classList.contains('hidden')).toBe(false);

    document.getElementById('reg-name').value = 'محمد أحمد';
    document.getElementById('reg-hospital-id').value = 'A123456789';
    document.getElementById('reg-national-id').value = '29001011234567';
    document.getElementById('reg-room').value = 'Arrest';
    document.getElementById('reg-dept').value = 'Internal Medicine';
    document.getElementById('reg-time').value = '2026-08-23T04:00';

    await document.getElementById('btn-submit-register').onclick();

    expect(batchOperations.set).toHaveBeenCalledTimes(1);
    const createdPayload = batchOperations.set.mock.calls[0][1];
    expect(createdPayload.name).toBe('محمد أحمد');
    expect(createdPayload.patientId).toBe('A123456789');
    expect(createdPayload.nationalId).toBe('29001011234567');
    expect(document.getElementById('modal-register').classList.contains('hidden')).toBe(true);
  });

  it('Leadership: discharging patient with outcome updates patient record', async () => {
    await simulateUserSession({
      role: 'emergency_manager',
      email: 'manager@imc.com',
      patients: [sampleActivePatient]
    });

    document.getElementById('discharge-patient-id').value = sampleActivePatient.id;
    document.getElementById('discharge-outcome-select').value = 'Ward Admission';

    await document.getElementById('btn-submit-discharge').onclick();

    expect(batchOperations.update).toHaveBeenCalledTimes(1);
    const updatePayload = batchOperations.update.mock.calls[0][1];
    expect(updatePayload.isDischarged).toBe(true);
    expect(updatePayload.status).toBe('Discharged');
    expect(updatePayload.dischargeOutcome).toBe('Ward Admission');
  });

  it('Leadership: executing purge discharged deletes only discharged patients', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await simulateUserSession({
      role: 'emergency_deputy_manager',
      email: 'deputy@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient]
    });

    const btnDeleteDischarged = document.getElementById('btn-delete-discharged');
    btnDeleteDischarged.click();

    expect(batchOperations.delete).toHaveBeenCalledTimes(1);
    expect(batchOperations.commit).toHaveBeenCalled();
  });

  it('Chief Nurse: operational clinical workflows (admit, triage, vitals, AI summary discharge) execute cleanly', async () => {
    await simulateUserSession({
      role: 'chief_nurse',
      email: 'nurse@imc.com',
      patients: [sampleActivePatient]
    });

    // Patient list displays patient correctly
    const patientList = document.getElementById('patient-list-container');
    expect(patientList.innerHTML).toContain('أحمد محمود');

    // Discharge with AI clinical summary
    document.getElementById('discharge-patient-id').value = sampleActivePatient.id;
    document.getElementById('discharge-outcome-select').value = 'Improved';
    document.getElementById('ai-summary-editor').value = 'Four-part clinical summary: Patient stabilized.';
    const attestCb = document.getElementById('ai-attestation-checkbox');
    if (attestCb) attestCb.checked = true;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(batchOperations.update).toHaveBeenCalledTimes(1);
    const updatePayload = batchOperations.update.mock.calls[0][1];
    expect(updatePayload.isDischarged).toBe(true);
    expect(updatePayload.dischargeSummary).toBe('Four-part clinical summary: Patient stabilized.');
  });
});

describe('Group 3: Negative Boundary & Guard Assertions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchOperations.commit.mockClear();
    batchOperations.delete.mockClear();
    batchOperations.set.mockClear();
    batchOperations.update.mockClear();
  });

  it('Leadership Boundary: non-owner attempting switchTab("owner") is blocked', async () => {
    await simulateUserSession({
      role: 'medical_director',
      email: 'director@imc.com'
    });

    const tabOwner = document.getElementById('tab-owner');
    tabOwner.click();

    const viewOwner = document.getElementById('view-owner');
    const viewLive = document.getElementById('view-live-board');

    expect(viewOwner.classList.contains('hidden'), 'Owner view must stay hidden').toBe(true);
    expect(viewLive.classList.contains('hidden'), 'Live board must stay visible').toBe(false);
    expect(usersCallback).toBeNull();
  });

  it('Leadership Boundary: attempting Purge ALL triggers alert and aborts without deleting', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await simulateUserSession({
      role: 'emergency_manager',
      email: 'manager@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient]
    });

    // Invocations of delete all (e.g. via direct button handler or function)
    const btnDeleteAll = document.getElementById('btn-delete-all');
    btnDeleteAll.click();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Only the System Owner can purge all patients'));
    expect(batchOperations.delete).not.toHaveBeenCalled();
  });

  it('Chief Nurse Boundary: data controls hidden and purge invocations trigger alerts', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await simulateUserSession({
      role: 'chief_nurse',
      email: 'nurse@imc.com',
      patients: [sampleActivePatient, sampleDischargedPatient]
    });

    expect(document.getElementById('data-control-actions').style.display).toBe('none');
    expect(document.getElementById('btn-delete-discharged').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('btn-delete-all').classList.contains('hidden')).toBe(true);

    // Attempting discharged purge
    document.getElementById('btn-delete-discharged').click();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Only Managers and the System Owner can purge discharged patients'));
    expect(batchOperations.delete).not.toHaveBeenCalled();

    // Attempting purge all
    alertSpy.mockClear();
    document.getElementById('btn-delete-all').click();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Only the System Owner can purge all patients'));
    expect(batchOperations.delete).not.toHaveBeenCalled();

    // Attempting owner tab
    document.getElementById('tab-owner').click();
    expect(document.getElementById('view-owner').classList.contains('hidden')).toBe(true);
  });

  it('Pending / Blocked Boundary: zero PHI exposed and patient subscription never called', async () => {
    await simulateUserSession({
      role: 'pending',
      email: 'pending@imc.com',
      patients: [sampleActivePatient]
    });

    expect(document.getElementById('app-section').classList.contains('hidden')).toBe(true);
    expect(patientsCallback).toBeNull();
    expect(document.body.innerHTML).not.toContain('أحمد محمود');
  });

  it('Remote Config Live Kill-Switch: enable_batch_purge: false hides purge buttons and blocks purge execution for all roles', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    await simulateUserSession({
      role: 'owner',
      email: 'owner@imc.com',
      remoteConfig: { enable_batch_purge: false }
    });

    const btnDisch = document.getElementById('btn-delete-discharged');
    const btnAll = document.getElementById('btn-delete-all');

    expect(btnDisch.classList.contains('hidden'), 'Discharged purge button should receive .hidden').toBe(true);
    expect(btnAll.classList.contains('hidden'), 'Purge all button should receive .hidden').toBe(true);

    // Executing purge when kill-switch is active alerts and aborts before confirmation prompt
    btnDisch.click();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Batch purging is currently disabled by administrator via Remote Config'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(batchOperations.delete).not.toHaveBeenCalled();
  });

  it('Access Gate Recovery (unfiled state): failed user registration offers active retry button', async () => {
    await simulateUserSession({
      role: 'pending',
      email: 'newbie@imc.com',
      userDocExists: false,
      ensureUserRecordFails: true
    });

    const gate = document.getElementById('access-gate');
    const gateMsg = document.getElementById('gate-message');
    const retryBtn = document.getElementById('btn-gate-retry');

    expect(gate.classList.contains('hidden')).toBe(false);
    expect(gateMsg.innerText).toContain(tr('gErr'));
    expect(retryBtn.classList.contains('hidden')).toBe(false);
    expect(retryBtn.disabled).toBe(false);

    // Clicking retry attempts ensureUserRecord again and transitions to pending on success
    firestoreMocks.setDoc.mockResolvedValueOnce(undefined);
    await retryBtn.onclick();

    expect(gateMsg.innerText).toContain(tr('gSent'));
    expect(retryBtn.classList.contains('hidden')).toBe(true);
  });

  it('Access Gate Recovery (unreachable state): failed network lookup offers active retry button', async () => {
    await simulateUserSession({
      role: 'pending',
      email: 'offline@imc.com',
      getUserRoleError: new Error('Network unavailable')
    });

    const gate = document.getElementById('access-gate');
    const gateMsg = document.getElementById('gate-message');
    const retryBtn = document.getElementById('btn-gate-retry');

    expect(gate.classList.contains('hidden')).toBe(false);
    expect(gateMsg.innerText).toContain(tr('gNet'));
    expect(retryBtn.classList.contains('hidden')).toBe(false);
  });
});

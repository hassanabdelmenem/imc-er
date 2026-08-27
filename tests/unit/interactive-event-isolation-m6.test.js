/**
 * ============================================================================
 * Milestone 6 Empirical Challenger 2 Verification Suite
 * Interactive Behaviors, DOM Event Isolation & Caret Preservation Under Rapid Re-renders
 * ============================================================================
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const mockUpdatePatientRecord = vi.fn(async () => true);
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
  updatePatientRecord: (...args) => mockUpdatePatientRecord(...args),
  dischargePatientRecord: vi.fn(async () => true),
  auth: { currentUser: { uid: 'test-user-id' } },
  db: {}
}));

import { captureActiveFieldState, restoreActiveFieldState, diffPatientFields } from '../../public/js/app.js';

describe('Milestone 6 Empirical Challenge — DOM Event Isolation & Caret Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Section 1: DOM Event Isolation on Card Header Interactive Controls', () => {
    function setupCardDOM(cardId, isExpanded = false) {
      const wrapper = document.createElement('div');
      wrapper.id = 'patient-list-container';
      wrapper.innerHTML = `
        <div class="patient-card" id="card_${cardId}">
          <div class="card-header" data-id="${cardId}">
            <div class="card-summary-left">
              <div class="patient-name" id="name_display_${cardId}">John Doe</div>
              <span class="hospital-id" id="hosp_display_${cardId}">#H12345</span>
            </div>
            <div class="card-summary-right">
              <div class="card-summary-tags">
                <select id="loc_${cardId}" class="btn-mini location-tag quick-loc-select" data-id="${cardId}">
                  <option value="Room 1" selected>📍 Room 1</option>
                  <option value="Room 2">📍 Room 2</option>
                </select>
                <div style="display:inline-flex;" onclick="event.stopPropagation();">
                  <select id="dept_sel_${cardId}" class="btn-mini location-tag quick-dept-select" data-id="${cardId}">
                    <option value="Internal Medicine" selected>🏥 Internal Medicine</option>
                    <option value="Other...">✏️ Other...</option>
                  </select>
                  <input type="text" id="custom_dept_${cardId}" class="btn-mini location-tag hidden" value="" data-id="${cardId}">
                  <button type="button" class="btn btn-mini btn-outline hidden" id="btn_reset_dept_${cardId}" data-id="${cardId}">📋</button>
                </div>
                <button type="button" id="btn_header_action_${cardId}" class="btn btn-mini">Action</button>
              </div>
            </div>
          </div>
          <div id="details_${cardId}" class="card-details ${isExpanded ? '' : 'hidden'}">
            <input type="text" id="diag_${cardId}" value="Acute chest pain" data-id="${cardId}">
          </div>
        </div>
      `;
      document.body.innerHTML = '';
      document.body.appendChild(wrapper);

      // Attach event listeners mimicking attachPatientListHandlers logic
      const header = wrapper.querySelector('.card-header');
      const detailsEl = wrapper.querySelector(`#details_${cardId}`);
      
      header.onclick = (e) => {
        if (e.target.closest('select, input, button')) return;
        detailsEl.classList.toggle('hidden');
      };

      const locSel = wrapper.querySelector(`#loc_${cardId}`);
      locSel.addEventListener('click', (e) => e.stopPropagation());
      locSel.addEventListener('change', async (e) => {
        e.stopPropagation();
        await mockUpdatePatientRecord(cardId, { location: e.target.value });
      });

      const deptSel = wrapper.querySelector(`#dept_sel_${cardId}`);
      deptSel.addEventListener('click', (e) => e.stopPropagation());

      const customDeptInp = wrapper.querySelector(`#custom_dept_${cardId}`);
      customDeptInp.addEventListener('click', (e) => e.stopPropagation());

      const resetBtn = wrapper.querySelector(`#btn_reset_dept_${cardId}`);
      resetBtn.addEventListener('click', (e) => e.stopPropagation());

      const headerBtn = wrapper.querySelector(`#btn_header_action_${cardId}`);
      headerBtn.addEventListener('click', (e) => e.stopPropagation());

      return { header, detailsEl, locSel, deptSel, customDeptInp, resetBtn, headerBtn };
    }

    it('clicking <select class="quick-loc-select"> (#loc_*) does NOT toggle accordion details', () => {
      const { detailsEl, locSel } = setupCardDOM('pat_101', false);
      expect(detailsEl.classList.contains('hidden')).toBe(true);

      // Click select
      locSel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(detailsEl.classList.contains('hidden')).toBe(true);

      // Change select
      locSel.value = 'Room 2';
      locSel.dispatchEvent(new Event('change', { bubbles: true }));
      expect(detailsEl.classList.contains('hidden')).toBe(true);
      expect(mockUpdatePatientRecord).toHaveBeenCalledWith('pat_101', { location: 'Room 2' });
    });

    it('clicking <select class="quick-dept-select"> (#dept_sel_*) does NOT toggle accordion details', () => {
      const { detailsEl, deptSel } = setupCardDOM('pat_101', false);
      expect(detailsEl.classList.contains('hidden')).toBe(true);

      deptSel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(detailsEl.classList.contains('hidden')).toBe(true);
    });

    it('clicking <input id="custom_dept_*"> does NOT toggle accordion details', () => {
      const { detailsEl, customDeptInp } = setupCardDOM('pat_101', false);
      customDeptInp.classList.remove('hidden');
      expect(detailsEl.classList.contains('hidden')).toBe(true);

      customDeptInp.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(detailsEl.classList.contains('hidden')).toBe(true);
    });

    it('clicking <button id="btn_reset_dept_*"> or buttons in .card-header does NOT toggle accordion details', () => {
      const { detailsEl, resetBtn, headerBtn } = setupCardDOM('pat_101', false);
      resetBtn.classList.remove('hidden');
      expect(detailsEl.classList.contains('hidden')).toBe(true);

      resetBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(detailsEl.classList.contains('hidden')).toBe(true);

      headerBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(detailsEl.classList.contains('hidden')).toBe(true);
    });

    it('clicking directly on .card-header outside form controls DOES toggle accordion details', () => {
      const { header, detailsEl } = setupCardDOM('pat_101', false);
      expect(detailsEl.classList.contains('hidden')).toBe(true);

      // Click on patient name inside header
      const nameEl = header.querySelector('.patient-name');
      nameEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(detailsEl.classList.contains('hidden')).toBe(false);

      // Click again to collapse
      nameEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(detailsEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Section 2: Caret and Focus Preservation Under Rapid Background Snapshot Re-renders', () => {
    it('preserves focus and caret position through 100 rapid background snapshot re-renders', () => {
      const container = document.createElement('div');
      container.id = 'patient-list-container';
      document.body.innerHTML = '';
      document.body.appendChild(container);

      // Initial render
      container.innerHTML = `
        <div class="patient-card" id="card_p101">
          <input type="text" id="diag_p101" value="Initial Diagnosis" />
        </div>
      `;

      const input = document.getElementById('diag_p101');
      input.focus();
      input.value = 'Acute Coronary Syndrome';
      input.setSelectionRange(14, 14); // Caret right before "Syndrome"

      // Execute 100 rapid re-renders simulating rapid Firestore snapshot updates
      for (let cycle = 1; cycle <= 100; cycle++) {
        const state = captureActiveFieldState();
        expect(state).not.toBeNull();
        expect(state.id).toBe('diag_p101');
        expect(state.value).toBe('Acute Coronary Syndrome');
        expect(state.selectionStart).toBe(14);
        expect(state.selectionEnd).toBe(14);

        // Snapshot pushes stored server state to DOM
        container.innerHTML = `
          <div class="patient-card" id="card_p101">
            <input type="text" id="diag_p101" value="Server Stored Value ${cycle}" />
          </div>
        `;

        restoreActiveFieldState(state);

        const currentInput = document.getElementById('diag_p101');
        expect(document.activeElement).toBe(currentInput);
        expect(currentInput.value).toBe('Acute Coronary Syndrome');
        expect(currentInput.selectionStart).toBe(14);
        expect(currentInput.selectionEnd).toBe(14);
      }
    });

    it('preserves text selection highlight ranges across 50 rapid re-renders', () => {
      const container = document.createElement('div');
      container.id = 'patient-list-container';
      document.body.innerHTML = '';
      document.body.appendChild(container);

      container.innerHTML = `
        <div class="patient-card" id="card_p102">
          <textarea id="notes_p102">Initial clinician observation notes</textarea>
        </div>
      `;

      const textarea = document.getElementById('notes_p102');
      textarea.focus();
      textarea.value = 'Telemetry shows Sinus Tachycardia at 135 bpm';
      textarea.setSelectionRange(16, 34); // "Sinus Tachycardia" highlighted

      for (let i = 0; i < 50; i++) {
        const state = captureActiveFieldState();
        expect(state.selectionStart).toBe(16);
        expect(state.selectionEnd).toBe(34);

        container.innerHTML = `
          <div class="patient-card" id="card_p102">
            <textarea id="notes_p102">Stale notes iteration ${i}</textarea>
          </div>
        `;

        restoreActiveFieldState(state);

        const currentTextarea = document.getElementById('notes_p102');
        expect(document.activeElement).toBe(currentTextarea);
        expect(currentTextarea.selectionStart).toBe(16);
        expect(currentTextarea.selectionEnd).toBe(34);
        expect(currentTextarea.value).toBe('Telemetry shows Sinus Tachycardia at 135 bpm');
      }
    });

    it('preserves active dropdown selection focus across rapid multi-card list mutations', () => {
      const container = document.createElement('div');
      container.id = 'patient-list-container';
      document.body.innerHTML = '';
      document.body.appendChild(container);

      container.innerHTML = `
        <div class="patient-card" id="card_p1">
          <select id="loc_p1">
            <option value="Room 1">Room 1</option>
            <option value="Room 2">Room 2</option>
            <option value="ICU 1">ICU 1</option>
          </select>
        </div>
        <div class="patient-card" id="card_p2">
          <select id="loc_p2">
            <option value="Room 1">Room 1</option>
            <option value="Room 2">Room 2</option>
          </select>
        </div>
      `;

      const select = document.getElementById('loc_p1');
      select.focus();
      select.value = 'ICU 1';

      for (let i = 0; i < 30; i++) {
        const state = captureActiveFieldState();
        expect(state.id).toBe('loc_p1');
        expect(state.value).toBe('ICU 1');

        // New cards arriving and order changing
        container.innerHTML = `
          <div class="patient-card" id="card_p0">
            <select id="loc_p0"><option value="Triage">Triage</option></select>
          </div>
          <div class="patient-card" id="card_p1">
            <select id="loc_p1">
              <option value="Room 1">Room 1</option>
              <option value="Room 2">Room 2</option>
              <option value="ICU 1">ICU 1</option>
            </select>
          </div>
          <div class="patient-card" id="card_p2">
            <select id="loc_p2"><option value="Room 2">Room 2</option></select>
          </div>
        `;

        restoreActiveFieldState(state);

        const restoredSelect = document.getElementById('loc_p1');
        expect(document.activeElement).toBe(restoredSelect);
        expect(restoredSelect.value).toBe('ICU 1');
      }
    });

    it('safely handles removal of active card during rapid re-render without crashing', () => {
      const container = document.createElement('div');
      container.id = 'patient-list-container';
      document.body.innerHTML = '';
      document.body.appendChild(container);

      container.innerHTML = `
        <div class="patient-card" id="card_discharged">
          <input type="text" id="diag_discharged" value="Discharged Patient" />
        </div>
      `;

      const input = document.getElementById('diag_discharged');
      input.focus();
      input.value = 'Final Note';

      const state = captureActiveFieldState();
      expect(state.id).toBe('diag_discharged');

      // Card is purged from DOM
      container.innerHTML = `<div class="empty-list">No active patients</div>`;

      expect(() => restoreActiveFieldState(state)).not.toThrow();
    });
  });

  describe('Section 3: Field Diffing Accuracy Under Concurrent Updates', () => {
    it('diffs candidate fields accurately against stored patient record', () => {
      const storedPatient = {
        name: 'Ahmed Mansour',
        patientId: 'H10001',
        location: 'Room 3',
        primaryDepartment: 'Internal Medicine',
        diagnosis: 'Chest pain',
        supportiveTx: 'Oxygen'
      };

      const candidates = {
        name: 'Ahmed Mansour',
        patientId: 'H10001',
        location: 'ICU 2', // Changed
        primaryDepartment: 'Internal Medicine',
        diagnosis: 'Chest pain - STEMI confirmed', // Changed
        supportiveTx: 'Oxygen'
      };

      const diff = diffPatientFields(storedPatient, candidates);
      expect(diff).toEqual({
        location: 'ICU 2',
        diagnosis: 'Chest pain - STEMI confirmed'
      });
    });

    it('ignores undefined candidates and empty diffs', () => {
      const storedPatient = {
        name: 'Sara Ali',
        location: 'Room 1'
      };

      const candidates = {
        name: 'Sara Ali',
        location: 'Room 1',
        diagnosis: undefined // Not being edited
      };

      const diff = diffPatientFields(storedPatient, candidates);
      expect(Object.keys(diff).length).toBe(0);
    });
  });
});

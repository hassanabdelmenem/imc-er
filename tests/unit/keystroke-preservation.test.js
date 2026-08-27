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
  collection: vi.fn(), onSnapshot: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(),
  doc: vi.fn(), deleteDoc: vi.fn(), setDoc: vi.fn(), getDoc: vi.fn(),
  writeBatch: vi.fn(), query: vi.fn(), orderBy: vi.fn(), limit: vi.fn()
}));

import { captureActiveFieldState, restoreActiveFieldState } from '../../public/js/app.js';

describe('Keystroke & Caret Preservation — Active DOM State Shielding', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="patient-search-input" value="search term" />
      <div id="patient-list-container">
        <div class="patient-card" id="card_p1">
          <input type="text" id="diag_p1" value="Initial Diagnosis" />
          <textarea id="notes_p1">Patient observation notes</textarea>
          <select id="loc_p1">
            <option value="Room 1">Room 1</option>
            <option value="Room 2" selected>Room 2</option>
          </select>
          <input type="datetime-local" id="time_p1" value="2026-08-02T10:00" />
          <button id="btn_expand_p1">Expand Card</button>
        </div>
      </div>
    `;
  });

  it('captures active text input focus, intermediate uncommitted value, and caret position', () => {
    const input = document.getElementById('diag_p1');
    input.focus();
    input.value = 'Acute Chest Pain - Suspected NSTEMI';
    input.setSelectionRange(11, 11);

    const state = captureActiveFieldState();
    expect(state).toEqual({
      id: 'diag_p1',
      value: 'Acute Chest Pain - Suspected NSTEMI',
      selectionStart: 11,
      selectionEnd: 11
    });
  });

  it('restores active text input focus, uncommitted typing, and caret position across DOM re-render', () => {
    const input = document.getElementById('diag_p1');
    input.focus();
    input.value = 'Acute Ch';
    input.setSelectionRange(8, 8);

    const state = captureActiveFieldState();
    expect(state).not.toBeNull();

    // Simulate realtime Firestore snapshot re-render replacing innerHTML with server state
    const container = document.getElementById('patient-list-container');
    container.innerHTML = `
      <div class="patient-card" id="card_p1">
        <input type="text" id="diag_p1" value="Initial Diagnosis" />
      </div>
    `;

    restoreActiveFieldState(state);

    const restoredInput = document.getElementById('diag_p1');
    expect(document.activeElement).toBe(restoredInput);
    // User typing must win over template-rendered server value
    expect(restoredInput.value).toBe('Acute Ch');
    expect(restoredInput.selectionStart).toBe(8);
    expect(restoredInput.selectionEnd).toBe(8);
  });

  it('retains highlighted text selection range across snapshot re-renders', () => {
    const textarea = document.getElementById('notes_p1');
    textarea.focus();
    textarea.value = 'Continuous cardiac telemetry monitoring in progress.';
    textarea.setSelectionRange(11, 26); // "cardiac telemetry" highlighted

    const state = captureActiveFieldState();
    expect(state.selectionStart).toBe(11);
    expect(state.selectionEnd).toBe(26);

    // Re-render DOM
    const container = document.getElementById('patient-list-container');
    container.innerHTML = `
      <div class="patient-card" id="card_p1">
        <textarea id="notes_p1">Stale notes</textarea>
      </div>
    `;

    restoreActiveFieldState(state);

    const restoredTextarea = document.getElementById('notes_p1');
    expect(document.activeElement).toBe(restoredTextarea);
    expect(restoredTextarea.value).toBe('Continuous cardiac telemetry monitoring in progress.');
    expect(restoredTextarea.selectionStart).toBe(11);
    expect(restoredTextarea.selectionEnd).toBe(26);
  });

  it('handles <select> elements and preserves selected focus', () => {
    const select = document.getElementById('loc_p1');
    select.focus();
    select.value = 'Room 1';

    const state = captureActiveFieldState();
    expect(state.id).toBe('loc_p1');
    expect(state.value).toBe('Room 1');

    // Re-render DOM
    const container = document.getElementById('patient-list-container');
    container.innerHTML = `
      <div class="patient-card" id="card_p1">
        <select id="loc_p1">
          <option value="Room 1">Room 1</option>
          <option value="Room 2" selected>Room 2</option>
        </select>
      </div>
    `;

    restoreActiveFieldState(state);

    const restoredSelect = document.getElementById('loc_p1');
    expect(document.activeElement).toBe(restoredSelect);
    expect(restoredSelect.value).toBe('Room 1');
  });

  it('handles <input type="datetime-local"> gracefully without throwing DOMExceptions on setSelectionRange', () => {
    const dateInput = document.getElementById('time_p1');
    dateInput.focus();
    dateInput.value = '2026-08-02T14:30';

    const state = captureActiveFieldState();
    expect(state.id).toBe('time_p1');

    // Re-render DOM
    const container = document.getElementById('patient-list-container');
    container.innerHTML = `
      <div class="patient-card" id="card_p1">
        <input type="datetime-local" id="time_p1" value="2026-08-02T10:00" />
      </div>
    `;

    expect(() => restoreActiveFieldState(state)).not.toThrow();

    const restoredDateInput = document.getElementById('time_p1');
    expect(document.activeElement).toBe(restoredDateInput);
    expect(restoredDateInput.value).toBe('2026-08-02T14:30');
  });

  it('returns null when activeElement is outside #patient-list-container', () => {
    const searchInput = document.getElementById('patient-search-input');
    searchInput.focus();
    searchInput.value = 'filter text';

    const state = captureActiveFieldState();
    expect(state).toBeNull();
  });

  it('returns null when activeElement is not an editable form control', () => {
    const btn = document.getElementById('btn_expand_p1');
    btn.focus();

    const state = captureActiveFieldState();
    expect(state).toBeNull();
  });

  it('gracefully handles discharged/removed patient cards when restoring state', () => {
    const input = document.getElementById('diag_p1');
    input.focus();
    input.value = 'Discharging note';

    const state = captureActiveFieldState();

    // Patient card was removed in snapshot (e.g. discharged by another user)
    const container = document.getElementById('patient-list-container');
    container.innerHTML = `<div class="empty-state">No active patients</div>`;

    expect(() => restoreActiveFieldState(state)).not.toThrow();
  });

  it('safely no-ops when restoreActiveFieldState receives null or undefined', () => {
    expect(() => restoreActiveFieldState(null)).not.toThrow();
    expect(() => restoreActiveFieldState(undefined)).not.toThrow();
  });
});

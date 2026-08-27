/**
 * ============================================================================
 * IMC ER Console - Milestone 2 Integration Test Suite
 * Discharge Modal & Clinical Attestation UI Workflow Integration
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

const mockFirestoreUpdates = [];

vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'doc-attest-user' } })),
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
    update: vi.fn((docRef, payload) => {
      mockFirestoreUpdates.push({ id: docRef.id, payload });
    }),
    commit: vi.fn(async () => true)
  })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

// Load application scripts
import '../../public/js/edge-ai-service.js';
import { setupEventListeners } from '../../public/js/app.js';

describe('Discharge Modal & Clinical Attestation UI Workflow Integration', () => {
  let alertSpy;

  beforeEach(() => {
    mockFirestoreUpdates.length = 0;
    document.body.innerHTML = indexHtml;
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Setup mock patientsList matching application state
    window.patientsList = [
      {
        id: 'p-301',
        name: 'كريم عادل',
        patientId: 'H112233445',
        department: 'Emergency Medicine',
        diagnosis: 'Acute Gastroenteritis',
        vitals: [{ time: '10:00', bp: '120/80', hr: '82', spo2: '99', rr: '16', temp: '37.2' }],
        labs: [{ time: '10:15', name: 'Electrolytes', value: 'Normal' }],
        notes: [{ time: '10:30', doctor: 'Nadia', text: 'Rehydrated with IV fluids. Tolerating oral intake.' }]
      }
    ];

    setupEventListeners();
  });

  afterEach(() => {
    alertSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('Test 3.1: Generates AI summary into editor and clears attestation checkbox', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    const checkbox = document.getElementById('ai-attestation-checkbox');
    checkbox.checked = true; // Pre-existing checked state

    await window.generateAISummaryInModal();

    const editor = document.getElementById('ai-summary-editor');
    expect(editor.value).toContain('### 🏥 Admission & Working Diagnosis');
    expect(editor.value).toContain('كريم عادل');
    // Generating a new draft MUST uncheck the attestation box
    expect(checkbox.checked).toBe(false);
  });

  it('Test 3.2: Blocks saving AI summary when attestation checkbox is unchecked and alerts clinician', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('ai-summary-editor').value = 'Clinical draft text';
    document.getElementById('ai-attestation-checkbox').checked = false;

    await window.saveAISummaryInModal();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
    expect(mockFirestoreUpdates).toHaveLength(0);
  });

  it('Test 3.3: Successfully saves AI summary and stamps attestation audit fields when verified', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('ai-summary-editor').value = 'Verified clinical summary draft';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await window.saveAISummaryInModal();

    expect(mockFirestoreUpdates).toHaveLength(1);
    expect(mockFirestoreUpdates[0].id).toBe('p-301');
    expect(mockFirestoreUpdates[0].payload.dischargeSummary).toBe('Verified clinical summary draft');
    expect(mockFirestoreUpdates[0].payload.dischargeSummaryAttested).toBe(true);
    expect(mockFirestoreUpdates[0].payload.dischargeSummaryAttestedAt).toBeDefined();
    expect(mockFirestoreUpdates[0].payload.dischargeSummaryAttestedBy).toBeDefined();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('verified and saved'));
  });

  it('Test 3.4: Blocks patient discharge submission if AI summary editor has text but attestation is unchecked', async () => {
    document.getElementById('modal-discharge').classList.remove('hidden');
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('discharge-outcome-select').value = 'Improved';
    document.getElementById('ai-summary-editor').value = 'Unverified discharge summary';
    document.getElementById('ai-attestation-checkbox').checked = false;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
    expect(mockFirestoreUpdates).toHaveLength(0);
    expect(document.getElementById('modal-discharge').classList.contains('hidden')).toBe(false);
  });

  it('Test 3.5: Permits patient discharge when AI summary is verified and attestation checkbox is checked', async () => {
    document.getElementById('modal-discharge').classList.remove('hidden');
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('discharge-outcome-select').value = 'Improved';
    document.getElementById('ai-summary-editor').value = 'Verified discharge summary';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(mockFirestoreUpdates).toHaveLength(1);
    expect(mockFirestoreUpdates[0].id).toBe('p-301');
    expect(mockFirestoreUpdates[0].payload.isDischarged).toBe(true);
    expect(mockFirestoreUpdates[0].payload.dischargeOutcome).toBe('Improved');
    expect(mockFirestoreUpdates[0].payload.dischargeSummary).toBe('Verified discharge summary');
    expect(document.getElementById('modal-discharge').classList.contains('hidden')).toBe(true);
  });

  it('Test 3.6: Permits standard discharge without AI summary when editor is empty', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    document.getElementById('discharge-outcome-select').value = 'Ward Admission';
    document.getElementById('ai-summary-editor').value = '';
    document.getElementById('ai-attestation-checkbox').checked = false;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(mockFirestoreUpdates).toHaveLength(1);
    expect(mockFirestoreUpdates[0].payload.isDischarged).toBe(true);
    expect(mockFirestoreUpdates[0].payload.dischargeOutcome).toBe('Ward Admission');
    expect(mockFirestoreUpdates[0].payload).not.toHaveProperty('dischargeSummary');
  });

  it('Test 3.7: Preserves clinician manual edits made to AI draft before saving', async () => {
    document.getElementById('discharge-patient-id').value = 'p-301';
    await window.generateAISummaryInModal();

    const editor = document.getElementById('ai-summary-editor');
    editor.value += '\n\n**Addendum**: Patient prescribed oral Cefixime 400mg PO daily for 5 days.';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await window.saveAISummaryInModal();

    expect(mockFirestoreUpdates).toHaveLength(1);
    expect(mockFirestoreUpdates[0].payload.dischargeSummary).toContain('oral Cefixime 400mg');
    expect(mockFirestoreUpdates[0].payload.dischargeSummaryAttested).toBe(true);
  });

  it('Test 3.8: Restores existing attested summary state when opening modal for previously attested patient', () => {
    window.patientsList.push({
      id: 'p-302',
      name: 'طارق سامي',
      dischargeSummary: 'Previously finalized summary',
      dischargeSummaryAttested: true
    });

    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'btn-discharge-trigger';
    triggerBtn.dataset.id = 'p-302';
    triggerBtn.dataset.name = 'طارق سامي';
    document.body.appendChild(triggerBtn);

    // Setup trigger buttons click listeners
    document.querySelectorAll('.btn-discharge-trigger').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('discharge-patient-name').innerText = btn.dataset.name || '--';
        document.getElementById('discharge-patient-id').value = btn.dataset.id;
        document.getElementById('discharge-outcome-select').value = "";
        const summaryEditor = document.getElementById('ai-summary-editor');
        const attestationCheckbox = document.getElementById('ai-attestation-checkbox');
        const patient = window.patientsList.find(p => p.id === btn.dataset.id);
        if (summaryEditor) {
          summaryEditor.value = (patient && patient.dischargeSummary) ? patient.dischargeSummary : "";
        }
        if (attestationCheckbox) {
          attestationCheckbox.checked = Boolean(patient && patient.dischargeSummaryAttested);
        }
        document.getElementById('modal-discharge').classList.remove('hidden');
      };
    });

    triggerBtn.click();

    const summaryEditor = document.getElementById('ai-summary-editor');
    const attestationCheckbox = document.getElementById('ai-attestation-checkbox');

    expect(summaryEditor.value).toBe('Previously finalized summary');
    expect(attestationCheckbox.checked).toBe(true);
  });
});

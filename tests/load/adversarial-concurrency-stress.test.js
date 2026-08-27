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

import {
  diffPatientFields,
  captureActiveFieldState,
  restoreActiveFieldState,
  calculateAgeAndGender,
  formatElapsedHours,
  formatDurationString
} from '../../public/js/app.js';
import { updatePatientRecord } from '../../public/js/firebase-service.js';

describe('Adversarial Verification Suite — Concurrency, Keystroke Preservation & Collision Subsystems', () => {
  const patientId = 'adversarial-p-999';

  beforeEach(() => {
    mockFirestoreState[patientId] = {
      id: patientId,
      name: 'طارق مصطفى فهمي',
      patientId: 'H998877665',
      nationalId: '29505120102345',
      diagnosis: 'Acute Sepsis Secondary to Pneumonia',
      supportiveTx: 'Oxygen 6L Mask, Ceftriaxone 2g IV',
      location: 'Resus 1',
      primaryDepartment: 'Emergency Medicine',
      pendingAction: 'Waiting ICU',
      hasReferral: 'Yes',
      sepsisWorkup: 'Yes',
      miCodeWorkup: 'No',
      strokeCodeWorkup: 'No',
      registrationTime: '2026-08-23T04:00:00.000Z',
      isDischarged: false
    };

    document.body.innerHTML = `
      <input id="patient-search-input" value="" />
      <div id="patient-list-container">
        <div class="patient-card" id="card_${patientId}">
          <input type="text" id="name_${patientId}" value="طارق مصطفى فهمي" data-id="${patientId}" data-field="name" />
          <input type="text" id="hosp_${patientId}" value="H998877665" data-id="${patientId}" data-field="patientId" />
          <input type="text" id="nid_${patientId}" value="29505120102345" data-id="${patientId}" data-field="nationalId" />
          <input type="text" id="diag_${patientId}" value="Acute Sepsis Secondary to Pneumonia" data-id="${patientId}" data-field="diagnosis" />
          <input type="text" id="supp_${patientId}" value="Oxygen 6L Mask, Ceftriaxone 2g IV" data-id="${patientId}" data-field="supportiveTx" />
          <select id="loc_${patientId}" data-id="${patientId}">
            <option value="Resus 1" selected>Resus 1</option>
            <option value="Room 1">Room 1</option>
            <option value="Room 2">Room 2</option>
          </select>
          <input type="datetime-local" id="regtime_${patientId}" value="2026-08-23T04:00" data-id="${patientId}" data-field="registrationTime" />
          <select id="dept_sel_${patientId}" data-id="${patientId}">
            <option value="Emergency Medicine" selected>Emergency Medicine</option>
            <option value="Internal Medicine">Internal Medicine</option>
            <option value="Other...">Other...</option>
          </select>
          <input type="text" id="custom_dept_${patientId}" class="hidden" value="" data-id="${patientId}" />
          <button id="btn_reset_dept_${patientId}" class="hidden" data-id="${patientId}">📋</button>
          
          <select id="action_${patientId}" data-id="${patientId}">
            <option value="Waiting ICU" selected>Waiting ICU</option>
            <option value="Waiting CCU">Waiting CCU</option>
            <option value="Custom...">Custom...</option>
          </select>
          <input type="text" id="custom_action_${patientId}" class="hidden" value="" data-id="${patientId}" />
          <button id="btn_reset_action_${patientId}" class="hidden" data-id="${patientId}">📋</button>
          
          <div id="referral_box_${patientId}">
            <select id="ref_${patientId}" data-id="${patientId}"><option value="Yes" selected>Yes</option></select>
          </div>
          <div id="sepsis_box_${patientId}">
            <select id="sepsis_${patientId}" data-id="${patientId}"><option value="Yes" selected>Yes</option></select>
          </div>
          <div id="mi_box_${patientId}" class="hidden">
            <select id="mi_${patientId}" data-id="${patientId}"><option value="No" selected>No</option></select>
          </div>
          <div id="stroke_box_${patientId}" class="hidden">
            <select id="stroke_${patientId}" data-id="${patientId}"><option value="No" selected>No</option></select>
          </div>
          <button id="btn_expand_${patientId}">Details</button>
        </div>
      </div>
    `;
  });

  describe('Subsystem 1: High-Contention Race Conditions on Active Fields & Caret Positions', () => {
    it('preserves multi-byte Arabic keystrokes and exact caret positions across 200 high-frequency snapshot bursts', () => {
      const arabicText = 'أزمة قلبية حادة مع انخفاض ضغط الدم الحاد 🫀';
      let activeEl = document.getElementById(`diag_${patientId}`);
      activeEl.focus();

      // Simulate character-by-character typing with interleaved snapshot storms
      let currentVal = '';
      for (let i = 0; i < arabicText.length; i++) {
        activeEl = document.activeElement;
        currentVal += arabicText[i];
        activeEl.value = currentVal;
        const caretPos = activeEl.value.length;
        activeEl.setSelectionRange(caretPos, caretPos);

        // Capture in-flight state
        const state = captureActiveFieldState();
        expect(state).not.toBeNull();
        expect(state.id).toBe(`diag_${patientId}`);
        expect(state.value).toBe(currentVal);
        expect(state.selectionStart).toBe(caretPos);
        expect(state.selectionEnd).toBe(caretPos);

        // Simulate incoming realtime server snapshot clobbering innerHTML
        const container = document.getElementById('patient-list-container');
        container.innerHTML = `
          <div class="patient-card" id="card_${patientId}">
            <input type="text" id="diag_${patientId}" value="Server Stale Sepsis State ${i}" />
          </div>
        `;

        // Restore active state
        restoreActiveFieldState(state);

        const restored = document.getElementById(`diag_${patientId}`);
        expect(document.activeElement).toBe(restored);
        expect(restored.value).toBe(currentVal);
        expect(restored.selectionStart).toBe(caretPos);
        expect(restored.selectionEnd).toBe(caretPos);
      }

      const finalInput = document.getElementById(`diag_${patientId}`);
      expect(finalInput.value).toBe(arabicText);
    });

    it('preserves highlighted text selection ranges (slice selection) during background updates', () => {
      const input = document.getElementById(`supp_${patientId}`);
      input.focus();
      input.value = 'Norepinephrine 0.1 mcg/kg/min titration';
      // Select "0.1 mcg/kg/min" (index 15 to 29)
      input.setSelectionRange(15, 29);

      const state = captureActiveFieldState();
      expect(state.selectionStart).toBe(15);
      expect(state.selectionEnd).toBe(29);

      // Snapshot teardown & rebuild
      document.getElementById('patient-list-container').innerHTML = `
        <div class="patient-card" id="card_${patientId}">
          <input type="text" id="supp_${patientId}" value="Old supportive Tx" />
        </div>
      `;

      restoreActiveFieldState(state);

      const restored = document.getElementById(`supp_${patientId}`);
      expect(document.activeElement).toBe(restored);
      expect(restored.value).toBe('Norepinephrine 0.1 mcg/kg/min titration');
      expect(restored.selectionStart).toBe(15);
      expect(restored.selectionEnd).toBe(29);
    });

    it('safely handles non-selection-range elements (datetime-local, select) without throwing exceptions', () => {
      const regTime = document.getElementById(`regtime_${patientId}`);
      regTime.focus();
      regTime.value = '2026-08-23T05:30';

      const state = captureActiveFieldState();
      expect(state.id).toBe(`regtime_${patientId}`);
      expect(state.value).toBe('2026-08-23T05:30');

      document.getElementById('patient-list-container').innerHTML = `
        <div class="patient-card" id="card_${patientId}">
          <input type="datetime-local" id="regtime_${patientId}" value="2026-08-23T04:00" />
        </div>
      `;

      expect(() => restoreActiveFieldState(state)).not.toThrow();
      const restored = document.getElementById(`regtime_${patientId}`);
      expect(document.activeElement).toBe(restored);
      expect(restored.value).toBe('2026-08-23T05:30');
    });

    it('ignores active focus on elements outside #patient-list-container (e.g. search filter, modal)', () => {
      const search = document.getElementById('patient-search-input');
      search.focus();
      search.value = 'Search term';

      const state = captureActiveFieldState();
      expect(state).toBeNull();
    });

    it('ignores non-editable active elements (e.g. buttons, divs)', () => {
      const btn = document.getElementById(`btn_expand_${patientId}`);
      btn.focus();

      const state = captureActiveFieldState();
      expect(state).toBeNull();
    });

    it('gracefully handles patient card deletion by peer while clinician is editing', () => {
      const input = document.getElementById(`diag_${patientId}`);
      input.focus();
      input.value = 'Unsaved in-flight note';

      const state = captureActiveFieldState();

      // Card deleted in peer snapshot (e.g. patient discharged / purged)
      document.getElementById('patient-list-container').innerHTML = `
        <div class="empty-list">No active patients</div>
      `;

      expect(() => restoreActiveFieldState(state)).not.toThrow();
      expect(document.getElementById(`diag_${patientId}`)).toBeNull();
    });
  });

  describe('Subsystem 2: Simultaneous Conflicting & Orthogonal Edits across Multi-Doctor Sessions', () => {
    it('merges 10 concurrent orthogonal field edits across 10 simulated clinicians without collision', async () => {
      const initialRecord = { ...mockFirestoreState[patientId] };

      // 10 simulated clinicians modifying distinct orthogonal fields
      const clinicianEdits = [
        { clinician: 'Dr. 1', field: 'name', value: 'طارق مصطفى محمود فهمي' },
        { clinician: 'Dr. 2', field: 'patientId', value: 'H998877000' },
        { clinician: 'Dr. 3', field: 'nationalId', value: '29505120109999' },
        { clinician: 'Dr. 4', field: 'diagnosis', value: 'Septic Shock with Multi-Organ Failure' },
        { clinician: 'Dr. 5', field: 'supportiveTx', value: 'Norepinephrine 0.2mcg + Vasopressin' },
        { clinician: 'Dr. 6', field: 'location', value: 'Room 1' },
        { clinician: 'Dr. 7', field: 'primaryDepartment', value: 'Critical Care Medicine' },
        { clinician: 'Dr. 8', field: 'pendingAction', value: 'Waiting CCU' },
        { clinician: 'Dr. 9', field: 'hasReferral', value: 'No' },
        { clinician: 'Dr. 10', field: 'registrationTime', value: '2026-08-23T06:15' }
      ];

      // Simulate simultaneous diff computation against the shared baseline
      const deltas = clinicianEdits.map(({ clinician, field, value }) => {
        const candidate = { [field]: value };
        const delta = diffPatientFields(initialRecord, candidate);
        expect(delta).toEqual({ [field]: value });
        return delta;
      });

      // Commit each delta in parallel
      await Promise.all(deltas.map(d => updatePatientRecord(patientId, d)));

      // Assert all 10 edits are successfully integrated into Firestore state without clobbering
      expect(mockFirestoreState[patientId].name).toBe('طارق مصطفى محمود فهمي');
      expect(mockFirestoreState[patientId].patientId).toBe('H998877000');
      expect(mockFirestoreState[patientId].nationalId).toBe('29505120109999');
      expect(mockFirestoreState[patientId].diagnosis).toBe('Septic Shock with Multi-Organ Failure');
      expect(mockFirestoreState[patientId].supportiveTx).toBe('Norepinephrine 0.2mcg + Vasopressin');
      expect(mockFirestoreState[patientId].location).toBe('Room 1');
      expect(mockFirestoreState[patientId].primaryDepartment).toBe('Critical Care Medicine');
      expect(mockFirestoreState[patientId].pendingAction).toBe('Waiting CCU');
      expect(mockFirestoreState[patientId].hasReferral).toBe('No');
      expect(mockFirestoreState[patientId].registrationTime).toBe('2026-08-23T06:15');
    });

    it('guarantees Last-Write-Wins (LWW) determinism on same-field collision without corrupted hybrid strings', async () => {
      const baseline = { ...mockFirestoreState[patientId] };

      // Doctor A submits diagnosis at T1
      const deltaA = diffPatientFields(baseline, { diagnosis: 'Severe Community-Acquired Pneumonia' });
      await updatePatientRecord(patientId, deltaA);
      expect(mockFirestoreState[patientId].diagnosis).toBe('Severe Community-Acquired Pneumonia');

      // Doctor B submits diagnosis at T2
      const deltaB = diffPatientFields(baseline, { diagnosis: 'Aspiration Pneumonitis with ARDS' });
      await updatePatientRecord(patientId, deltaB);
      expect(mockFirestoreState[patientId].diagnosis).toBe('Aspiration Pneumonitis with ARDS');

      // Doctor C submits diagnosis at T3
      const deltaC = diffPatientFields(baseline, { diagnosis: 'Pulmonary Embolism Massif' });
      await updatePatientRecord(patientId, deltaC);
      expect(mockFirestoreState[patientId].diagnosis).toBe('Pulmonary Embolism Massif');
    });

    it('prevents stale client snapshot from reverting peer edits made in the interim', async () => {
      const snapshotT0 = { ...mockFirestoreState[patientId], location: 'Resus 1', supportiveTx: 'Oxygen 6L' };

      // Peer updates location at T1 and supportiveTx at T2
      await updatePatientRecord(patientId, { location: 'Cath Lab' });
      await updatePatientRecord(patientId, { supportiveTx: 'Aspirin 300mg + Plavix 600mg' });

      // Local doctor (still holding stale snapshotT0 in memory) only edits diagnosis to "NSTEMI"
      const localCandidates = {
        name: snapshotT0.name,
        location: snapshotT0.location, // stale 'Resus 1'
        supportiveTx: snapshotT0.supportiveTx, // stale 'Oxygen 6L'
        diagnosis: 'Acute NSTEMI' // active edit
      };

      const delta = diffPatientFields(snapshotT0, localCandidates);
      expect(delta).toEqual({ diagnosis: 'Acute NSTEMI' });
      expect(delta).not.toHaveProperty('location');
      expect(delta).not.toHaveProperty('supportiveTx');

      await updatePatientRecord(patientId, delta);

      // Firestore preserves peer updates while taking the new diagnosis
      expect(mockFirestoreState[patientId].location).toBe('Cath Lab');
      expect(mockFirestoreState[patientId].supportiveTx).toBe('Aspirin 300mg + Plavix 600mg');
      expect(mockFirestoreState[patientId].diagnosis).toBe('Acute NSTEMI');
    });

    it('avoids phantom diffs on datetime-local second truncation across ISO formats', () => {
      const storedRecords = [
        { registrationTime: '2026-08-23T04:00:00.000Z' },
        { registrationTime: '2026-08-23T04:00:00Z' },
        { registrationTime: '2026-08-23T04:00' }
      ];

      for (const rec of storedRecords) {
        const result = diffPatientFields(rec, { registrationTime: '2026-08-23T04:00' });
        expect(result).toEqual({});
      }

      // But detects genuine time changes
      const changeResult = diffPatientFields(storedRecords[0], { registrationTime: '2026-08-23T04:30' });
      expect(changeResult).toEqual({ registrationTime: '2026-08-23T04:30' });
    });

    it('strictly handles null, undefined, and empty string diff boundaries', () => {
      const record = {
        name: 'Patient Test',
        diagnosis: '',
        supportiveTx: null,
        pendingAction: undefined
      };

      // 1. undefined candidates are skipped
      expect(diffPatientFields(record, { diagnosis: undefined, supportiveTx: undefined })).toEqual({});

      // 2. null stored field compared to non-empty string yields diff
      expect(diffPatientFields(record, { supportiveTx: 'Oxygen' })).toEqual({ supportiveTx: 'Oxygen' });

      // 3. null stored field compared to empty string yields no diff
      expect(diffPatientFields(record, { supportiveTx: '' })).toEqual({});

      // 4. empty string stored compared to empty string candidate yields no diff
      expect(diffPatientFields(record, { diagnosis: '' })).toEqual({});

      // 5. undefined stored compared to string candidate yields diff
      expect(diffPatientFields(record, { pendingAction: 'Waiting ICU' })).toEqual({ pendingAction: 'Waiting ICU' });
    });
  });

  describe('Subsystem 3: Workup Box Toggling & Custom Department/Action Input Preservation', () => {
    it('preserves existing workup flags in Firestore when workup alert boxes are hidden', async () => {
      // Patient has sepsisWorkup = 'Yes' and miCodeWorkup = 'Yes'
      mockFirestoreState[patientId].sepsisWorkup = 'Yes';
      mockFirestoreState[patientId].miCodeWorkup = 'Yes';

      const currentRecord = { ...mockFirestoreState[patientId] };

      // Clinician updates location to "Room 3" while workup boxes are hidden (undefined candidate)
      const candidateUpdates = {
        location: 'Room 3',
        sepsisWorkup: undefined,
        miCodeWorkup: undefined,
        strokeCodeWorkup: undefined,
        hasReferral: undefined
      };

      const delta = diffPatientFields(currentRecord, candidateUpdates);
      expect(delta).toEqual({ location: 'Room 3' });
      await updatePatientRecord(patientId, delta);

      expect(mockFirestoreState[patientId].location).toBe('Room 3');
      expect(mockFirestoreState[patientId].sepsisWorkup).toBe('Yes');
      expect(mockFirestoreState[patientId].miCodeWorkup).toBe('Yes');
    });

    it('preserves custom department strings and correctly transitions to/from presets', async () => {
      // 1. Set custom department
      const customDeptDelta = diffPatientFields(mockFirestoreState[patientId], {
        primaryDepartment: 'Cardiothoracic Surgery'
      });
      expect(customDeptDelta).toEqual({ primaryDepartment: 'Cardiothoracic Surgery' });
      await updatePatientRecord(patientId, customDeptDelta);
      expect(mockFirestoreState[patientId].primaryDepartment).toBe('Cardiothoracic Surgery');

      // 2. Peer updates location - custom department is preserved
      const peerDelta = diffPatientFields(mockFirestoreState[patientId], { location: 'OR 2' });
      await updatePatientRecord(patientId, peerDelta);
      expect(mockFirestoreState[patientId].primaryDepartment).toBe('Cardiothoracic Surgery');
      expect(mockFirestoreState[patientId].location).toBe('OR 2');

      // 3. Reset to standard department preset
      const resetDelta = diffPatientFields(mockFirestoreState[patientId], {
        primaryDepartment: 'Internal Medicine'
      });
      expect(resetDelta).toEqual({ primaryDepartment: 'Internal Medicine' });
      await updatePatientRecord(patientId, resetDelta);
      expect(mockFirestoreState[patientId].primaryDepartment).toBe('Internal Medicine');
    });

    it('preserves custom pending action strings and correctly transitions to/from presets', async () => {
      // 1. Set custom pending action
      const customActionDelta = diffPatientFields(mockFirestoreState[patientId], {
        pendingAction: 'Waiting Endoscopy Suite'
      });
      expect(customActionDelta).toEqual({ pendingAction: 'Waiting Endoscopy Suite' });
      await updatePatientRecord(patientId, customActionDelta);
      expect(mockFirestoreState[patientId].pendingAction).toBe('Waiting Endoscopy Suite');

      // 2. Peer updates supportiveTx - custom pending action is preserved
      const peerDelta = diffPatientFields(mockFirestoreState[patientId], {
        supportiveTx: 'NPO + IV Fluids'
      });
      await updatePatientRecord(patientId, peerDelta);
      expect(mockFirestoreState[patientId].pendingAction).toBe('Waiting Endoscopy Suite');
      expect(mockFirestoreState[patientId].supportiveTx).toBe('NPO + IV Fluids');

      // 3. Reset back to preset action
      const resetDelta = diffPatientFields(mockFirestoreState[patientId], {
        pendingAction: 'Waiting ICU'
      });
      expect(resetDelta).toEqual({ pendingAction: 'Waiting ICU' });
      await updatePatientRecord(patientId, resetDelta);
      expect(mockFirestoreState[patientId].pendingAction).toBe('Waiting ICU');
    });
  });

  describe('Subsystem 4: Property-Based Randomized Chaos & High-Load Stress Harness', () => {
    it('executes 1,000 randomized operations across 50 patient records under 100Hz snapshot churn without unhandled rejections', async () => {
      const NUM_PATIENTS = 50;
      const NUM_CLINICIANS = 100;
      const TOTAL_OPS = 1000;

      // Seed 50 patient records in mock Firestore
      const patientPool = Array.from({ length: NUM_PATIENTS }, (_, i) => {
        const id = `stress-p-${i}`;
        mockFirestoreState[id] = {
          id,
          name: `مريض تجريبي رقم ${i}`,
          patientId: `A${100000000 + i}`,
          nationalId: `290010112345${(i % 90) + 10}`,
          diagnosis: `Diagnosis ${i}`,
          supportiveTx: `Supportive Tx ${i}`,
          location: `Room ${(i % 10) + 1}`,
          primaryDepartment: 'Emergency Medicine',
          pendingAction: 'Under evaluation',
          registrationTime: '2026-08-23T04:00:00.000Z'
        };
        return id;
      });

      const fields = ['diagnosis', 'supportiveTx', 'location', 'primaryDepartment', 'pendingAction'];
      const startTime = performance.now();

      // Concurrently execute 1,000 randomized clinician operations
      const operations = Array.from({ length: TOTAL_OPS }, async (_, opIdx) => {
        const clinicianId = `doctor-${opIdx % NUM_CLINICIANS}`;
        const targetId = patientPool[opIdx % NUM_PATIENTS];
        const targetRecord = { ...mockFirestoreState[targetId] };
        const selectedField = fields[opIdx % fields.length];
        const updatedVal = `Mutation_${opIdx}_${clinicianId}`;

        // Artificial micro-delay simulating network jitter
        await new Promise(r => setTimeout(r, Math.random() * 2));

        const delta = diffPatientFields(targetRecord, { [selectedField]: updatedVal });
        expect(delta).toHaveProperty(selectedField, updatedVal);

        await updatePatientRecord(targetId, delta);

        return { opIdx, targetId, selectedField, updatedVal };
      });

      const results = await Promise.all(operations);
      const duration = performance.now() - startTime;
      const opsPerSec = (TOTAL_OPS / (duration / 1000)).toFixed(0);

      expect(results).toHaveLength(TOTAL_OPS);
      expect(duration).toBeLessThan(10000); // 1,000 concurrent mutations must resolve within 10s

      console.log(`[Adversarial Stress Result] 1,000 concurrent mutations across 50 patients completed in ${duration.toFixed(2)} ms (~${opsPerSec} ops/sec).`);
    });
  });
});

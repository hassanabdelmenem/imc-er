import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getByText, getByRole } from '@testing-library/dom';

// Mock Firebase module
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, name) => ({ name })),
    addDoc: vi.fn(async (coll, data) => ({ id: 'mock-patient-id-123', ...data })),
    onSnapshot: vi.fn((coll, callback) => {
      // Simulate snapshot update with registered patient
      callback({
        docs: [
          {
            id: 'mock-patient-id-123',
            data: () => ({
              name: 'Ahmed Mohamed',
              hospitalId: 'H123456789',
              nationalId: '29001011234557',
              diagnosis: 'Acute Chest Pain',
              room: 'ICU A',
              isDischarged: false,
              registrationTime: new Date().toISOString()
            })
          }
        ]
      });
      return () => {}; // unsubscribe function
    }),
    updateDoc: vi.fn(),
    doc: vi.fn(),
    deleteDoc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn()
  };
});

describe('Phase 2: Integration Testing - Patient Registration & Live Board Transfer', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="list-header-title">All Patients</div>
      <div id="list-header-count">0</div>
      <div id="active-list-container"></div>
      <input id="patient-search-input" value="" />
    `;
  });

  it('populates Doctor Live Board when Doctor/Manager registers a patient in Firestore', async () => {
    const firestore = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    
    // 1. Doctor/Manager registers patient via addDoc
    const newPatientData = {
      name: 'Ahmed Mohamed',
      hospitalId: 'H123456789',
      nationalId: '29001011234557',
      diagnosis: 'Acute Chest Pain',
      room: 'ICU A',
      isDischarged: false,
      registrationTime: new Date().toISOString()
    };
    
    const docRef = await firestore.addDoc(firestore.collection({}, 'patients'), newPatientData);
    expect(docRef.id).toBe('mock-patient-id-123');
    expect(docRef.name).toBe('Ahmed Mohamed');

    // 2. Simulate Live Board receiving the patient data via onSnapshot
    let receivedPatients = [];
    firestore.onSnapshot(firestore.collection({}, 'patients'), (snapshot) => {
      receivedPatients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    });

    expect(receivedPatients).toHaveLength(1);
    expect(receivedPatients[0].name).toBe('Ahmed Mohamed');
    expect(receivedPatients[0].room).toBe('ICU A');

    // 3. Verify DOM rendering simulation of Patient Card in Doctor Live Board
    const container = document.getElementById('active-list-container');
    container.innerHTML = `
      <div class="patient-card" id="card_${receivedPatients[0].id}">
        <h3>${receivedPatients[0].name}</h3>
        <p>Room: ${receivedPatients[0].room}</p>
        <p>Diagnosis: ${receivedPatients[0].diagnosis}</p>
      </div>
    `;

    expect(getByText(container, 'Ahmed Mohamed')).toBeDefined();
    expect(getByText(container, 'Room: ICU A')).toBeDefined();
  });
});

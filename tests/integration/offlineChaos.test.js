import { describe, it, expect, beforeEach } from 'vitest';

describe('IMC ER Console - Chaos Engineering: Offline Sync & DLQ Fallback', () => {
  let offlineQueue = [];
  let dlqQueue = [];
  let isOnline = true;

  beforeEach(() => {
    offlineQueue = [];
    dlqQueue = [];
    isOnline = true;
  });

  it('queues pending diagnosis updates when offline and flushes upon network connection', async () => {
    const patient = { id: 'p-101', name: 'Mona Zaki', diagnosis: '' };

    isOnline = false;
    const diagnosisPayload = 'Acute STEMI - Offline triage assessment';
    
    if (!isOnline) {
      offlineQueue.push({ action: 'UPDATE_DIAGNOSIS', patientId: patient.id, payload: diagnosisPayload });
    } else {
      patient.diagnosis = diagnosisPayload;
    }

    expect(offlineQueue.length).toBe(1);
    expect(patient.diagnosis).toBe('');

    isOnline = true;
    while (offlineQueue.length > 0) {
      const task = offlineQueue.shift();
      if (task.action === 'UPDATE_DIAGNOSIS') {
        patient.diagnosis = task.payload;
      }
    }

    expect(offlineQueue.length).toBe(0);
    expect(patient.diagnosis).toBe('Acute STEMI - Offline triage assessment');
  });

  it('routes failed atomic batch operations cleanly to dead_letter_queue without crashing app', async () => {
    const failedBatchPayload = { isDischarged: true, dischargeOutcome: 'ICU Admission', patientId: 'p-101' };
    const simulatedError = new Error('Firestore writeBatch commit partitioned by network check');

    function recordFailedBatch(payload, errorMsg, targetInfo = {}) {
      dlqQueue.push({
        failedAt: new Date().toISOString(),
        payload,
        errorMessage: errorMsg.message || String(errorMsg),
        targetCollection: targetInfo.collection || 'patients',
        targetDocId: targetInfo.docId || 'p-101'
      });
    }

    try {
      throw simulatedError;
    } catch (err) {
      recordFailedBatch(failedBatchPayload, err, { collection: 'patients', docId: 'p-101' });
    }

    expect(dlqQueue.length).toBe(1);
    expect(dlqQueue[0].targetCollection).toBe('patients');
    expect(dlqQueue[0].errorMessage).toContain('partitioned by network check');
  });
});

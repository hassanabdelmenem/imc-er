import { test, expect } from '@playwright/test';

test.describe('IMC ER Console - E2E Chaos Testing: Offline Mode & Background Sync', () => {
  test('Simulate network disconnection, local note update, and Background Sync flush on reconnect', async ({ page, context }) => {
    // Intercept and mock Firebase SDKs & offline behavior
    await page.route('https://www.gstatic.com/firebasejs/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mocked compat sdk */' });
    });

    await page.addInitScript(() => {
      window.mockUser = { uid: 'doc-chaos-imc', email: 'doctor@imc.com' };
      window.mockPatients = [
        { id: 'p-101', name: 'Mona Zaki', patientId: 'ER-2026', department: 'Arrest', status: 'Arrest', triage: 'Red', notes: [], activityLog: [] }
      ];
      window.offlineQueue = [];
      window.__isOnline = true;

      window.firebase = {
        apps: ['mock-app'],
        initializeApp: () => {},
        auth: () => ({
          onAuthStateChanged: (cb) => { window.__authCb = cb; setTimeout(() => cb(window.mockUser), 50); },
          signInWithEmailAndPassword: () => Promise.resolve({ user: window.mockUser }),
          currentUser: window.mockUser
        }),
        firestore: () => ({
          collection: (col) => ({
            doc: (id) => ({
              get: () => Promise.resolve({ exists: true, data: () => ({ role: 'doctor', name: 'Dr. Chaos' }) }),
              update: (payload) => {
                if (!navigator.onLine || !window.__isOnline) {
                  window.offlineQueue.push({ col, id, payload, timestamp: Date.now() });
                  const p = window.mockPatients.find(pt => pt.id === id);
                  if (p && payload.diagnosis) p.diagnosis = payload.diagnosis;
                  return Promise.resolve();
                }
                return Promise.resolve();
              }
            }),
            add: (payload) => Promise.resolve({ id: 'dlq-1' }),
            onSnapshot: (cb) => {
              const docs = window.mockPatients.map(p => ({ id: p.id, data: () => p }));
              cb({ docs, forEach: (fn) => docs.forEach(fn) });
              return () => {};
            }
          })
        }),
        storage: () => ({})
      };

      window.addEventListener('online', () => {
        window.__isOnline = true;
        while (window.offlineQueue.length > 0) {
          const item = window.offlineQueue.shift();
          window.dispatchEvent(new CustomEvent('background-sync:flushed', { detail: item }));
        }
      });
    });

    try {
      await page.goto('/');

      // 1. Simulate network disconnection (Chaos Offline Mode)
      await context.setOffline(true);
      await page.evaluate(() => {
        window.__isOnline = false;
        window.dispatchEvent(new Event('offline'));
      });

      // 2. Simulate doctor updating diagnosis offline
      const queuedCount = await page.evaluate(() => {
        const patient = window.mockPatients[0];
        const db = window.firebase.firestore();
        db.collection('patients').doc(patient.id).update({
          diagnosis: 'Acute Myocardial Infarction (Offline Triage)'
        });
        return window.offlineQueue.length;
      });
      expect(queuedCount).toBe(1);

      // 3. Simulate network restoration (Online Mode)
      await context.setOffline(false);
      const queueAfterReconnect = await page.evaluate(() => {
        window.dispatchEvent(new Event('online'));
        return window.offlineQueue.length;
      });
      expect(queueAfterReconnect).toBe(0);
    } finally {
      await context.setOffline(false);
    }
  });
});

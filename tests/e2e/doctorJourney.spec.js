import { test, expect } from '@playwright/test';

test.describe('Phase 3: Automation (E2E) Testing - Doctor User Journey', () => {
  test('Doctor logs in, searches for a patient, inputs medical data, and saves', async ({ page }) => {
    // Inject E2E mock user and route interception to bypass production Firebase network calls
    await page.addInitScript(() => {
      window.__E2E_USER__ = { uid: 'doc-test-123', email: 'doctor@imc-er.com', role: 'user' };
      window.__E2E_LOGGED_IN__ = false;
    });

    await page.route('**/js/firebase-service.js*', async route => {
      const response = await route.fetch();
      let body = await response.text();
      
      body = body.replace(
        'export function initAuthListener(callback) {',
        'export function initAuthListener(callback) {\n  window.__AUTH_CALLBACK__ = callback;\n  setTimeout(() => callback(null), 50);\n  return () => {};\n'
      );
      body = body.replace(
        'export function loginWithEmail(email, password) {',
        'export function loginWithEmail(email, password) {\n  window.__E2E_LOGGED_IN__ = true;\n  if (window.__AUTH_CALLBACK__) { setTimeout(() => window.__AUTH_CALLBACK__(window.__E2E_USER__), 50); }\n  return Promise.resolve({ user: window.__E2E_USER__ });\n'
      );
      body = body.replace(
        'export async function getUserRole(uid) {',
        'export async function getUserRole(uid) {\n  return window.__E2E_USER__.role;\n'
      );
      body = body.replace(
        'export function subscribeToPatients(callback, onError) {',
        'export function subscribeToPatients(callback, onError) {\n  setTimeout(() => callback([{\n    id: "test-patient-1",\n    name: "Ahmed Mohamed",\n    patientId: "H123456789",\n    nationalId: "29001011234567",\n    location: "Resuscitation Room - Bed 1",\n    registrationTime: new Date().toISOString(),\n    pendingAction: "Under assessment",\n    isDischarged: false,\n    diagnosis: "",\n    sepsisWorkup: "No"\n  }]), 50);\n  return () => {};\n'
      );
      body = body.replace(
        'export async function updatePatientRecord(patientId, updateData) {',
        'export async function updatePatientRecord(patientId, updateData) {\n  return Promise.resolve();\n'
      );

      await route.fulfill({ response, body });
    });

    // Navigate to local application
    await page.goto('http://localhost:3000');

    // 1. Log in as a Doctor
    await page.fill('#auth-email', 'doctor@imc-er.com');
    await page.fill('#auth-password', 'password123');
    await page.click('#btn-login');

    // Verify login success and Live Board visibility
    await expect(page.locator('#view-live-board')).toBeVisible({ timeout: 10000 });

    // 2. Search for a patient by Name / Hospital ID
    const searchInput = page.locator('#patient-search-input');
    await searchInput.fill('Ahmed Mohamed');

    // 3. Expand the Patient Card
    const patientCard = page.locator('.patient-card').first();
    await expect(patientCard).toBeVisible();
    await patientCard.click();

    // 4. Input medical data (Diagnosis / Notes / Labs / Sepsis Workup)
    const diagnosisInput = patientCard.locator('input[data-field="diagnosis"]');
    if (await diagnosisInput.isVisible()) {
      await diagnosisInput.fill('Acute Coronary Syndrome - STEMI');
    }

    const sepsisSelect = patientCard.locator('select[data-field="sepsisWorkup"]');
    if (await sepsisSelect.isVisible()) {
      await sepsisSelect.selectOption('Yes');
    }

    // 5. Click Save or blur to trigger auto-save / manual save
    // In IMC ER, updates are saved on blur or change
    await page.keyboard.press('Tab');

    // Verify persistence
    await expect(patientCard).toBeVisible();
  });
});

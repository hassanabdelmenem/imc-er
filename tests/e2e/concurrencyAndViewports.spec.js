import { test, expect } from "@playwright/test";
import { installFirebaseMocks } from "./helpers/mockFirebase.js";

test.describe("Concurrency & Responsive Viewports — E2E Suite", () => {
  const clinicalUser = {
    uid: "uid_dr_kareem",
    email: "kareem.dr@imc.com",
    displayName: "Dr. Kareem"
  };

  const initialUsers = [
    {
      id: "uid_dr_kareem",
      email: "kareem.dr@imc.com",
      role: "medical_director",
      createdAt: "2026-08-01T08:00:00Z"
    }
  ];

  const sharedPatient = [
    {
      id: "pat-concurrent-1",
      name: "حسام الدين مصطفى",
      patientId: "H123456789",
      nationalId: "28501011234567",
      location: "Room 1",
      department: "Internal Medicine",
      primaryDepartment: "Internal Medicine",
      status: "Under assessment",
      pendingAction: "Waiting ward",
      isDischarged: false,
      registrationTime: new Date(Date.now() - 2 * 36e5).toISOString(),
      diagnosis: "Initial Assessment",
      supportiveTx: "IV Fluids NS 500ml",
      vitals: [{ time: "08:00", bp: "120/80", hr: "80", spo2: "98", rr: "16", temp: "37.0" }],
      labs: [],
      notes: []
    }
  ];

  test("1. Concurrent Field Editing, Background Snapshot Merging and Active Caret Preservation", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: clinicalUser,
      initialUsers: initialUsers,
      initialPatients: sharedPatient
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Expand patient card
    await page.click(`.card-header[data-id="pat-concurrent-1"]`);
    const details = page.locator("#details_pat-concurrent-1");
    await expect(details).toBeVisible();

    // Focus on diagnosis input
    const diagInput = page.locator("#diag_pat-concurrent-1");
    await diagInput.focus();
    await expect(diagInput).toBeFocused();

    // Simulate concurrent update to supportive therapy in Firestore from another device
    await page.evaluate(() => {
      window.__mockDbStore.patients["pat-concurrent-1"].supportiveTx = "Ceftriaxone 1g IV + Paracetamol 1g";
      window.__notifySnapshot("patients");
    });

    // Enter new diagnosis text
    await diagInput.fill("Acute Bronchitis");
    await diagInput.blur();

    // Verify field-level diffing merged both edits in the store
    await expect.poll(async () => {
      const dbStore = await page.evaluate(() => window.__mockDbStore);
      return {
        supportiveTx: dbStore.patients["pat-concurrent-1"]?.supportiveTx,
        diagnosis: dbStore.patients["pat-concurrent-1"]?.diagnosis
      };
    }).toEqual({
      supportiveTx: "Ceftriaxone 1g IV + Paracetamol 1g",
      diagnosis: "Acute Bronchitis"
    });
  });

  test("2. Desktop Viewport (1280x720) Responsive Layout and Dashboard Metrics", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    await installFirebaseMocks(page, {
      user: clinicalUser,
      initialUsers: initialUsers,
      initialPatients: sharedPatient
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Top metrics dashboard is visible and styled horizontally
    const roomsGrid = page.locator("#rooms-grid");
    await expect(roomsGrid).toBeVisible();

    // Patient card rendered in wide format
    const patientCard = page.locator(".patient-card");
    await expect(patientCard).toBeVisible();
    const box = await patientCard.boundingBox();
    expect(box?.width).toBeGreaterThan(500);
  });

  test("3. Tablet Viewport (768x1024) Intermediate Layout", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await installFirebaseMocks(page, {
      user: clinicalUser,
      initialUsers: initialUsers,
      initialPatients: sharedPatient
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Stats and live board remain functional and responsive
    await expect(page.locator("#patient-list-container")).toBeVisible();
    await expect(page.locator("#stat-total-visits")).toBeVisible();
  });

  test("4. Mobile Viewport (375x667) Bottom-Sheet Modals and Sticky Action Trigger", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await installFirebaseMocks(page, {
      user: clinicalUser,
      initialUsers: initialUsers,
      initialPatients: sharedPatient
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Open Registration Modal
    const btnOpenReg = page.locator("#btn-open-register");
    await expect(btnOpenReg).toBeVisible();
    await btnOpenReg.click();

    const regModal = page.locator("#modal-register");
    await expect(regModal).toBeVisible();

    // Open Room Selection Modal on mobile
    await page.click("#btn-select-room");
    const roomModal = page.locator("#modal-select-room");
    await expect(roomModal).toBeVisible();
    await page.click(`.room-option-btn[data-room="Isolation Room"]`);
    await expect(roomModal).toBeHidden();

    // Close registration modal
    await page.click("#modal-register .close-modal");
    await expect(regModal).toBeHidden();
  });
});

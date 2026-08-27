import { test, expect } from "@playwright/test";
import { installFirebaseMocks } from "./helpers/mockFirebase.js";

test.describe("System Owner Governance & Oversight — E2E Suite", () => {
  const ownerUser = {
    uid: "uid_owner_admin",
    email: "owner@imc.com",
    displayName: "Dr. System Owner"
  };

  const initialUsers = [
    {
      id: "uid_owner_admin",
      email: "owner@imc.com",
      name: "Dr. System Owner",
      role: "owner",
      createdAt: "2026-01-01T00:00:00Z"
    },
    {
      id: "uid_pending_dr_tariq",
      email: "tariq.er@imc.com",
      name: "Dr. Tariq ER",
      role: "pending",
      createdAt: "2026-08-20T10:00:00Z"
    },
    {
      id: "uid_staff_nurse_mona",
      email: "mona.nurse@imc.com",
      name: "Nurse Mona",
      role: "chief_nurse",
      createdAt: "2026-07-15T08:00:00Z"
    },
    {
      id: "uid_staff_dr_yasmin",
      email: "yasmin.dir@imc.com",
      name: "Dr. Yasmin",
      role: "medical_director",
      createdAt: "2026-06-01T08:00:00Z"
    }
  ];

  const samplePatients = [
    {
      id: "pat-owner-active-1",
      name: "محمود حسن علي",
      patientId: "M100200300",
      nationalId: "27501011234567",
      location: "Room 1",
      department: "Internal Medicine",
      primaryDepartment: "Internal Medicine",
      status: "Under assessment",
      pendingAction: "Waiting ICU",
      isDischarged: false,
      registrationTime: new Date(Date.now() - 2 * 36e5).toISOString(),
      vitals: [{ time: "08:00", bp: "120/80", hr: "78", spo2: "99", rr: "16", temp: "37.0" }],
      labs: [],
      notes: []
    },
    {
      id: "pat-owner-disch-1",
      name: "فاطمة إبراهيم خليل",
      patientId: "F400500600",
      nationalId: "28202021234568",
      location: "Room 2",
      department: "General Surgery",
      primaryDepartment: "General Surgery",
      status: "Discharged",
      pendingAction: "Discharged",
      dischargeOutcome: "Improved",
      isDischarged: true,
      registrationTime: new Date(Date.now() - 5 * 36e5).toISOString(),
      dischargeTime: new Date(Date.now() - 1 * 36e5).toISOString(),
      vitals: [],
      labs: [],
      notes: []
    }
  ];

  test.beforeEach(async ({ page }) => {
    await installFirebaseMocks(page, {
      user: ownerUser,
      initialUsers: initialUsers,
      initialPatients: samplePatients,
      initialRemoteConfig: { enable_batch_purge: true, enable_edge_ai_synthesis: true }
    });
  });

  test("1. Owner Access & Governance Tab Visibility with Pending Badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Owner Tab MUST be visible and active
    const ownerTab = page.locator("#tab-owner");
    await expect(ownerTab).toBeVisible();
    await expect(ownerTab).not.toHaveClass(/hidden/);

    // Pending count badge shows (1) because tariq.er@imc.com is pending
    const badge = page.locator("#badge-pending-users");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("1");

    // Both Purge buttons visible for Owner
    await expect(page.locator("#btn-delete-discharged")).toBeVisible();
    await expect(page.locator("#btn-delete-all")).toBeVisible();
  });

  test("2. Staff Roster & Pending Approval Queue Inspection", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Switch to Owner Governance Tab
    await page.click("#tab-owner");
    await expect(page.locator("#view-owner")).toBeVisible();
    await expect(page.locator("#view-live-board")).toHaveClass(/hidden/);

    // Summary Tiles rendered
    const usersContainer = page.locator("#users-list-container");
    await expect(usersContainer).toContainText("PENDING APPROVAL");
    await expect(usersContainer).toContainText("CHIEF NURSE");

    // Pending Request for Dr. Tariq
    const pendingCard = usersContainer.locator(".user-card-pending");
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard).toContainText("Dr. Tariq ER");
    await expect(pendingCard).toContainText("tariq.er@imc.com");
  });

  test("3. Promotes Pending User to Clinical Staff Role", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();
    await page.click("#tab-owner");

    const pendingCard = page.locator(".user-card-pending:has-text('tariq.er@imc.com')");
    await expect(pendingCard).toBeVisible();

    // Select role "Emergency Physician" in Approve As dropdown
    const selectRole = pendingCard.locator("select.select-role");
    await selectRole.selectOption("chief_nurse");

    // Verify user role updated in in-memory mock store
    await expect.poll(async () => {
      const dbStore = await page.evaluate(() => window.__mockDbStore);
      return dbStore.users["uid_pending_dr_tariq"]?.role;
    }).toBe("chief_nurse");
  });

  test("4. Updates Role Assignment for Existing Staff Member", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();
    await page.click("#tab-owner");

    // Locate Nurse Mona in staff roster
    const monaCard = page.locator(".user-card:has-text('mona.nurse@imc.com')");
    await expect(monaCard).toBeVisible();

    // Change role to emergency_manager
    const selectRole = monaCard.locator("select.select-role");
    await selectRole.selectOption("emergency_manager");

    // Verify Firestore updated
    await expect.poll(async () => {
      const dbStore = await page.evaluate(() => window.__mockDbStore);
      return dbStore.users["uid_staff_nurse_mona"]?.role;
    }).toBe("emergency_manager");
  });

  test("5. Removes Deactivated Staff Account from Roster", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();
    await page.click("#tab-owner");

    const yasminCard = page.locator(".user-card:has-text('yasmin.dir@imc.com')");
    await expect(yasminCard).toBeVisible();

    // Accept remove confirmation dialog
    page.once("dialog", async dialog => {
      expect(dialog.message()).toMatch(/remove yasmin.dir@imc.com completely|إزالة yasmin.dir@imc.com نهائياً/);
      await dialog.accept();
    });

    const removeBtn = yasminCard.locator(".btn-remove-user");
    await removeBtn.click();

    // Verify removed from DOM and Firestore
    await expect(page.locator(".user-card:has-text('yasmin.dir@imc.com')")).toBeHidden();
    const dbStore = await page.evaluate(() => window.__mockDbStore);
    expect(dbStore.users["uid_staff_dr_yasmin"]).toBeUndefined();
  });

  test("6. Dynamic Remote Config Kill Switch Hides Batch Purge Controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Purge buttons initially visible
    await expect(page.locator("#btn-delete-discharged")).toBeVisible();
    await expect(page.locator("#btn-delete-all")).toBeVisible();

    // Dynamically toggle Remote Config kill-switch via in-memory mock helper
    await page.evaluate(() => {
      if (typeof window.__updateRemoteConfig === "function") {
        window.__updateRemoteConfig({ enable_batch_purge: false });
      }
    });

    // Purge buttons must now be hidden
    await expect(page.locator("#btn-delete-discharged")).toHaveClass(/hidden/);
    await expect(page.locator("#btn-delete-all")).toHaveClass(/hidden/);
  });

  test("7. Emergency Purge ALL Patient Records (Active & Discharged)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    const btnDeleteAll = page.locator("#btn-delete-all");
    await expect(btnDeleteAll).toBeVisible();

    // Handle Purge All Confirmation dialog
    page.once("dialog", async dialog => {
      expect(dialog.message()).toMatch(/delete ALL patient records|حذف جميع سجلات المرضى/);
      await dialog.accept();
    });

    await btnDeleteAll.click();

    // Verify all patients purged from in-memory store
    await expect.poll(async () => {
      const dbStore = await page.evaluate(() => window.__mockDbStore);
      return Object.keys(dbStore.patients).length;
    }).toBe(0);

    // Active and Discharged containers empty
    await expect(page.locator("#patient-list-container .patient-card")).toHaveCount(0);
    await expect(page.locator("#discharged-list-container .patient-card")).toHaveCount(0);
  });
});

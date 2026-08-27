import { test, expect } from "@playwright/test";
import { installFirebaseMocks } from "./helpers/mockFirebase.js";

test.describe("Access Gate & Role-Based Security Quarantine — E2E Suite", () => {
  const sensitivePatients = [
    {
      id: "pat-secret-1",
      name: "مريض سري للغاية",
      patientId: "S999888777",
      nationalId: "28801011234567",
      location: "Room 1",
      department: "Internal Medicine",
      primaryDepartment: "Internal Medicine",
      status: "Under assessment",
      pendingAction: "Waiting ICU",
      isDischarged: false,
      registrationTime: new Date().toISOString(),
      vitals: [],
      labs: [],
      notes: []
    }
  ];

  test("1. Pending User is Quarantined Behind Access Gate with Zero PHI Leakage", async ({ page }) => {
    const pendingUser = {
      uid: "uid_pending_user",
      email: "nurse.applicant@imc.com",
      displayName: "Applicant Nurse"
    };
    const pendingDoc = {
      id: "uid_pending_user",
      email: "nurse.applicant@imc.com",
      role: "pending",
      createdAt: "2026-08-20T10:00:00Z"
    };

    await installFirebaseMocks(page, {
      user: pendingUser,
      initialUsers: [pendingDoc],
      initialPatients: sensitivePatients
    });

    await page.goto("/");

    // Access Gate MUST be visible
    const gate = page.locator("#access-gate");
    await expect(gate).toBeVisible();
    await expect(gate).not.toHaveClass(/hidden/);

    // App Section MUST be strictly hidden
    await expect(page.locator("#app-section")).toBeHidden();
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);

    // Gate Message informs user of pending state
    const gateMsg = page.locator("#gate-message");
    await expect(gateMsg).toBeVisible();
    await expect(gateMsg).toContainText(/pending/i);

    // Retry button is hidden for regular pending state
    await expect(page.locator("#btn-gate-retry")).toHaveClass(/hidden/);

    // Verify zero PHI leakage: patient cards and names are completely absent from DOM
    await expect(page.locator("#patient-list-container .patient-card")).toHaveCount(0);
    await expect(page.locator("text=مريض سري للغاية")).toHaveCount(0);
    await expect(page.locator("text=S999888777")).toHaveCount(0);
  });

  test("2. Blocked User is Strictly Quarantined with Disabled Access Message", async ({ page }) => {
    const blockedUser = {
      uid: "uid_blocked_user",
      email: "former.staff@imc.com",
      displayName: "Former Staff"
    };
    const blockedDoc = {
      id: "uid_blocked_user",
      email: "former.staff@imc.com",
      role: "blocked",
      createdAt: "2026-05-10T10:00:00Z"
    };

    await installFirebaseMocks(page, {
      user: blockedUser,
      initialUsers: [blockedDoc],
      initialPatients: sensitivePatients
    });

    await page.goto("/");

    // Access Gate visible, App Section hidden
    await expect(page.locator("#access-gate")).toBeVisible();
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);

    // Gate message displays Blocked notification
    const gateMsg = page.locator("#gate-message");
    await expect(gateMsg).toContainText(/revoked|blocked/i);

    // Zero PHI leakage
    await expect(page.locator("#patient-list-container .patient-card")).toHaveCount(0);
    await expect(page.locator("text=مريض سري للغاية")).toHaveCount(0);
  });

  test("3. Unfiled Access Request Shows Retry Button and Successfully Submits", async ({ page }) => {
    const unfiledUser = {
      uid: "uid_unfiled_user",
      email: "new.entrant@imc.com",
      displayName: "New Entrant"
    };

    // User doc does not exist yet in initialUsers, and initial bootstrap is simulated as ensure failure
    await installFirebaseMocks(page, {
      user: unfiledUser,
      initialUsers: [],
      initialPatients: sensitivePatients,
      simulateEnsureFailure: true
    });

    await page.goto("/");

    // Gate shows unfiled error
    const gate = page.locator("#access-gate");
    await expect(gate).toBeVisible();
    const gateMsg = page.locator("#gate-message");
    await expect(gateMsg).toContainText(/could not file your access request/i);

    // Retry button MUST be visible
    const retryBtn = page.locator("#btn-gate-retry");
    await expect(retryBtn).toBeVisible();
    await expect(retryBtn).not.toHaveClass(/hidden/);

    // Turn off simulated failure in the mock store
    await page.evaluate(() => {
      window.__simulateEnsureFailure = false;
    });

    // Click Retry Button
    await retryBtn.click();

    // In-gate status transitions to request sent
    await expect(gateMsg).toContainText(/Access request filed/i);
    // Verify user doc was created in in-memory store
    const dbStore = await page.evaluate(() => window.__mockDbStore);
    expect(dbStore.users["uid_unfiled_user"]).toBeDefined();
    expect(dbStore.users["uid_unfiled_user"].role).toBe("pending");
  });

  test("4. Dynamic Promotion from Pending to Approved Clinical Staff Unlocks Application", async ({ page }) => {
    const applicantUser = {
      uid: "uid_applicant",
      email: "applicant@imc.com",
      displayName: "Nurse Applicant"
    };
    const applicantDoc = {
      id: "uid_applicant",
      email: "applicant@imc.com",
      role: "pending",
      createdAt: "2026-08-20T10:00:00Z"
    };

    await installFirebaseMocks(page, {
      user: applicantUser,
      initialUsers: [applicantDoc],
      initialPatients: sensitivePatients
    });

    await page.goto("/");

    // Initially in access gate
    await expect(page.locator("#access-gate")).toBeVisible();
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);

    // Administrator promotes applicant in Firestore to chief_nurse and triggers auth re-evaluation
    await page.evaluate(() => {
      if (window.__mockDbStore && window.__notifyAuth) {
        window.__mockDbStore.users["uid_applicant"].role = "chief_nurse";
        // Trigger auth state listener to re-evaluate user privileges
        window.__notifyAuth({
          uid: "uid_applicant",
          email: "applicant@imc.com",
          displayName: "Nurse Applicant"
        });
      }
    });

    // App Section automatically unlocks and becomes visible
    await expect(page.locator("#access-gate")).toHaveClass(/hidden/);
    await expect(page.locator("#app-section")).toBeVisible();

    // Patient board is now populated
    await expect(page.locator("#patient-list-container")).toContainText("مريض سري للغاية");
  });

  test("5. Adversarial Navigation Attempts from Inside Gate are Strictly Prevented", async ({ page }) => {
    const pendingUser = {
      uid: "uid_adversary",
      email: "adversary@imc.com",
      displayName: "Adversary"
    };
    const pendingDoc = {
      id: "uid_adversary",
      email: "adversary@imc.com",
      role: "pending",
      createdAt: "2026-08-20T10:00:00Z"
    };

    await installFirebaseMocks(page, {
      user: pendingUser,
      initialUsers: [pendingDoc],
      initialPatients: sensitivePatients
    });

    await page.goto("/");
    await expect(page.locator("#access-gate")).toBeVisible();

    // Attempt to invoke switchTab(owner) programmatically
    await page.evaluate(() => {
      if (typeof window.switchTab === "function") window.switchTab("owner");
    });
    await expect(page.locator("#view-owner")).toHaveClass(/hidden/);
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);

    // Attempt to invoke switchTab(live-board) programmatically
    await page.evaluate(() => {
      if (typeof window.switchTab === "function") window.switchTab("live-board");
    });
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);
    await expect(page.locator("#access-gate")).toBeVisible();
  });
});

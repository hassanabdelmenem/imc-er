/**
 * ============================================================================
 * IMC ER Console — Milestone 3 Empirical Challenger 2 E2E Stress Suite
 * ============================================================================
 * Adversarial UI boundary testing, negative RBAC, and AI attestation gating.
 * ============================================================================
 */
import { test, expect } from "@playwright/test";
import { installFirebaseMocks } from "./helpers/mockFirebase.js";

test.describe("Milestone 3 Adversarial Boundary & Negative RBAC E2E Suite", () => {
  const chiefNurseUser = {
    uid: "uid_nurse_salma",
    email: "salma.nurse@imc.com",
    displayName: "Salma Hassan, RN"
  };

  const medDirUser = {
    uid: "uid_med_director",
    email: "director.tarek@imc.com",
    displayName: "Dr. Tarek Youssef"
  };

  const pendingUser = {
    uid: "uid_pending_dr",
    email: "new.doctor@imc.com",
    displayName: "Dr. New Applicant"
  };

  const blockedUser = {
    uid: "uid_blocked_user",
    email: "former.staff@imc.com",
    displayName: "Former Staff"
  };

  const initialUsers = [
    { id: "uid_nurse_salma", email: "salma.nurse@imc.com", role: "chief_nurse" },
    { id: "uid_med_director", email: "director.tarek@imc.com", role: "medical_director" },
    { id: "uid_pending_dr", email: "new.doctor@imc.com", role: "pending" },
    { id: "uid_blocked_user", email: "former.staff@imc.com", role: "blocked" }
  ];

  const samplePatients = [
    {
      id: "pat-adv-1",
      name: "حسام الدين فهمي",
      patientId: "A112233445",
      nationalId: "28804150101235",
      location: "Room 3",
      department: "Cardiology",
      primaryDepartment: "Cardiology",
      status: "Under assessment",
      pendingAction: "Waiting CCU",
      isDischarged: false,
      registrationTime: new Date(Date.now() - 36e5).toISOString(),
      vitals: [{ time: "09:00", bp: "135/85", hr: "88", spo2: "98", rr: "18", temp: "37.1" }],
      labs: [{ name: "Troponin", result: "0.02", time: "09:30" }],
      notes: [{ author: "Nurse Salma", text: "Patient resting in bed.", time: "09:15" }]
    },
    {
      id: "pat-adv-discharged",
      name: "رانيا كمال السيد",
      patientId: "B998877665",
      nationalId: "30107200101246",
      location: "Cardio Observations",
      department: "Internal Medicine",
      primaryDepartment: "Internal Medicine",
      status: "Discharged",
      pendingAction: "None",
      isDischarged: true,
      dischargeOutcome: "Improved",
      registrationTime: new Date(Date.now() - 4 * 36e5).toISOString(),
      vitals: [{ time: "08:00", bp: "120/80", hr: "75", spo2: "99", rr: "16", temp: "36.8" }],
      labs: [],
      notes: []
    }
  ];

  test("1. Registration Modal: Rejects Latin characters, malformed Hospital ID, and short NID with native alerts", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: chiefNurseUser,
      initialUsers,
      initialPatients: samplePatients,
      initialRemoteConfig: { enable_batch_purge: true, enable_edge_ai_synthesis: true }
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Open Registration Modal
    await page.click("#btn-open-register");
    const regModal = page.locator("#modal-register");
    await expect(regModal).toBeVisible();

    // 1.1 Non-Arabic name attempt
    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.fill("#reg-name", "John Smith");
    await page.fill("#reg-hospital-id", "H123456789");
    await page.fill("#reg-national-id", "28804150101235");
    await page.click("#btn-submit-register");

    expect(dialogMessage).toMatch(/Arabic Name Only|الاسم عربي فقط/);
    await expect(regModal).toBeVisible();

    // 1.2 Invalid Hospital ID format attempt (too short)
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.fill("#reg-name", "أحمد إبراهيم");
    await page.fill("#reg-hospital-id", "H12345"); // 5 digits instead of 9
    await page.click("#btn-submit-register");

    expect(dialogMessage).toMatch(/1 Letter \+ 9 Nums|حرف \+ 9 أرقام/);
    await expect(regModal).toBeVisible();

    // 1.3 Invalid NID format attempt (too short)
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.fill("#reg-hospital-id", "H123456789");
    await page.fill("#reg-national-id", "2880415"); // 7 digits instead of 14
    await page.click("#btn-submit-register");

    expect(dialogMessage).toMatch(/NID: 14 Digits|القومي: 14 رقم/);
    await expect(regModal).toBeVisible();

    // 1.4 Valid submission succeeds and closes modal
    await page.fill("#reg-national-id", "28804150101235");
    await page.click("#btn-submit-register");
    await expect(regModal).toBeHidden();
  });

  test("2. Negative RBAC: Chief Nurse has no access to Owner Tab or Purge Controls", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: chiefNurseUser,
      initialUsers,
      initialPatients: samplePatients,
      initialRemoteConfig: { enable_batch_purge: true, enable_edge_ai_synthesis: true }
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Owner Tab strictly hidden
    const ownerTab = page.locator("#tab-owner");
    await expect(ownerTab).toHaveClass(/hidden/);

    // Data Control section and Purge buttons hidden
    const dataControlActions = page.locator("#data-control-actions");
    await expect(dataControlActions).toHaveClass(/hidden/);
  });

  test("3. Negative RBAC: Medical Director has Discharged Purge but NO Owner Tab or Purge ALL", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: medDirUser,
      initialUsers,
      initialPatients: samplePatients,
      initialRemoteConfig: { enable_batch_purge: true, enable_edge_ai_synthesis: true }
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Owner Tab strictly hidden
    const ownerTab = page.locator("#tab-owner");
    await expect(ownerTab).toHaveClass(/hidden/);

    // Purge Discharged is visible, Purge ALL is hidden
    const btnDeleteDischarged = page.locator("#btn-delete-discharged");
    await expect(btnDeleteDischarged).toBeVisible();

    const btnDeleteAll = page.locator("#btn-delete-all");
    await expect(btnDeleteAll).toHaveClass(/hidden/);
  });

  test("4. Negative RBAC: Pending and Blocked users quarantined behind Access Gate", async ({ page }) => {
    // 4.1 Pending User
    await installFirebaseMocks(page, {
      user: pendingUser,
      initialUsers,
      initialPatients: samplePatients
    });

    await page.goto("/");
    await expect(page.locator("#access-gate")).toBeVisible();
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);
    await expect(page.locator("#gate-message")).toContainText(/approval|قيد المراجعة/i);

    // 4.2 Blocked User
    await installFirebaseMocks(page, {
      user: blockedUser,
      initialUsers,
      initialPatients: samplePatients
    });

    await page.goto("/");
    await expect(page.locator("#access-gate")).toBeVisible();
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);
    await expect(page.locator("#gate-message")).toContainText(/revoked|إيقاف/i);
  });

  test("5. Edge AI Attestation Gating: Discharge blocked until clinical attestation is checked", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: chiefNurseUser,
      initialUsers,
      initialPatients: samplePatients,
      initialRemoteConfig: { enable_batch_purge: true, enable_edge_ai_synthesis: true }
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Expand patient card and trigger discharge modal for pat-adv-1
    await page.click(`.card-header[data-id="pat-adv-1"]`);
    const details = page.locator("#details_pat-adv-1");
    await expect(details).toBeVisible();

    const dischargeTrigger = page.locator(`.btn-discharge-trigger[data-id="pat-adv-1"]`);
    await expect(dischargeTrigger).toBeVisible();
    await dischargeTrigger.click();

    const dischargeModal = page.locator("#modal-discharge");
    await expect(dischargeModal).toBeVisible();

    // Select outcome
    await page.selectOption("#discharge-outcome-select", "Improved");

    // Generate AI Summary
    const btnGenAI = page.locator("#btn-generate-ai-summary");
    await btnGenAI.click();

    const summaryEditor = page.locator("#ai-summary-editor");
    await expect(summaryEditor).not.toHaveValue("");
    await expect(summaryEditor).toHaveValue(/Admission & Working Diagnosis|حسام الدين فهمي/);

    // Verify attestation checkbox is NOT checked
    const attestationCheckbox = page.locator("#ai-attestation-checkbox");
    expect(await attestationCheckbox.isChecked()).toBe(false);

    // Attempt 5.1: Save AI summary without attestation -> alert and blocked
    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.click("#btn-save-ai-summary");
    expect(dialogMessage).toMatch(/Clinical Attestation Required|إقرار سريري مطلوب/);

    // Attempt 5.2: Submit Discharge without attestation -> alert and modal remains open
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.click("#btn-submit-discharge");
    expect(dialogMessage).toMatch(/Clinical Attestation Required|إقرار سريري مطلوب/);
    await expect(dischargeModal).toBeVisible();

    // Step 5.3: Check attestation checkbox and submit -> success and modal closes
    await attestationCheckbox.check();
    expect(await attestationCheckbox.isChecked()).toBe(true);

    await page.click("#btn-submit-discharge");
    await expect(dischargeModal).toBeHidden();
  });
});

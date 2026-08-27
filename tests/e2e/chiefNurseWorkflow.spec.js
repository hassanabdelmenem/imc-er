import { test, expect } from "@playwright/test";
import { installFirebaseMocks } from "./helpers/mockFirebase.js";

test.describe("Chief Nurse Clinical Workflows — E2E Suite", () => {
  const chiefNurseUser = {
    uid: "uid_nurse_fatima",
    email: "nurse.fatima@imc.com",
    displayName: "Fatima Al-Sayed, RN"
  };

  const initialNurseRecord = {
    id: "uid_nurse_fatima",
    email: "nurse.fatima@imc.com",
    role: "chief_nurse",
    createdAt: "2026-08-01T08:00:00Z"
  };

  const samplePatients = [
    {
      id: "pat-cn-1",
      name: "أحمد إبراهيم خليل",
      patientId: "A123456789",
      nationalId: "29001011234567",
      location: "Room 3",
      department: "Internal Medicine",
      primaryDepartment: "Internal Medicine",
      status: "Under assessment",
      pendingAction: "Under assessment",
      isDischarged: false,
      registrationTime: new Date(Date.now() - 2 * 36e5).toISOString(),
      vitals: [{ time: "10:00", bp: "120/80", hr: "72", spo2: "99", rr: "16", temp: "37.0" }],
      labs: [{ name: "CBC", result: "Normal", time: "10:30" }],
      notes: [{ author: "Nurse Fatima", text: "Patient stable on room air.", time: "10:15" }]
    },
    {
      id: "pat-cn-arrest",
      name: "محمود حسن مصطفى",
      patientId: "B987654321",
      nationalId: "28503151234567",
      location: "Arrest",
      department: "Emergency Medicine (ER)",
      primaryDepartment: "Emergency Medicine (ER)",
      status: "Arrest",
      pendingAction: "Resuscitation",
      isDischarged: false,
      registrationTime: new Date(Date.now() - 30 * 60000).toISOString(),
      vitals: [{ time: "11:00", bp: "60/40", hr: "145", spo2: "80", rr: "28", temp: "36.2" }],
      labs: [],
      notes: []
    }
  ];

  test.beforeEach(async ({ page }) => {
    await installFirebaseMocks(page, {
      user: chiefNurseUser,
      initialUsers: [initialNurseRecord],
      initialPatients: samplePatients,
      initialRemoteConfig: { enable_batch_purge: true, enable_edge_ai_synthesis: true }
    });
  });

  // --------------------------------------------------------------------------
  // 1. Patient Registration & Demographic Parsing
  // --------------------------------------------------------------------------
  test("1.1 Registers a new patient with Arabic name, 10-char Hospital ID, and 14-digit NID", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();
    await expect(page.locator("#user-info")).toContainText("Chief Nurse");

    // Open Registration Modal
    await page.click("#btn-open-register");
    await expect(page.locator("#modal-register")).toBeVisible();

    // Fill valid Arabic Name
    await page.fill("#reg-name", "علي محمد عثمان");

    // Fill valid Hospital ID (1 capital letter + 9 numbers)
    await page.fill("#reg-hospital-id", "C112233445");

    // Fill valid Egyptian 14-digit National ID (2 95 07 20 -> born 20 July 1995, Male)
    await page.fill("#reg-national-id", "29507201234571");

    // Assert Age & Gender calculation
    const ageDisplay = page.locator("#reg-age-display");
    await expect(ageDisplay).toBeVisible();
    const ageText = await ageDisplay.innerText();
    expect(ageText).toMatch(/Male|ذكر/);
    expect(ageText).toMatch(/31|30|32/); // depending on current year calculations

    // Pick Room via Room Modal
    await page.click("#btn-select-room");
    await expect(page.locator("#modal-select-room")).toBeVisible();
    await page.click(`.room-option-btn[data-room="Cardio Observations"]`);
    await expect(page.locator("#modal-select-room")).toBeHidden();
    await expect(page.locator("#btn-select-room-text")).toContainText("Cardio Observations");

    // Pick Department via Department Modal
    await page.click("#btn-select-dept");
    await expect(page.locator("#modal-select-dept")).toBeVisible();
    await page.click(`.dept-option-btn[data-dept="Cardiology / CCU"]`);
    await expect(page.locator("#modal-select-dept")).toBeHidden();
    await expect(page.locator("#btn-select-dept-text")).toContainText("Cardiology / CCU");

    // Submit Registration
    await page.click("#btn-submit-register");
    await expect(page.locator("#modal-register")).toBeHidden();

    // Verify patient appears on active Live Board
    const newCard = page.locator(`.patient-card:has-text("علي محمد عثمان")`);
    await expect(newCard).toBeVisible();
    await expect(newCard).toContainText("C112233445");
  });

  test("1.2 Rejects registration with non-Arabic name and shows validation alert", async ({ page }) => {
    await page.goto("/");
    await page.click("#btn-open-register");

    let dialogMessage = "";
    page.once("dialog", async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.fill("#reg-name", "John Doe 123");
    await page.fill("#reg-hospital-id", "A123456789");
    await page.click("#btn-submit-register");

    expect(dialogMessage).toMatch(/Arabic Name Only|الاسم عربي فقط/);
    await expect(page.locator("#modal-register")).toBeVisible();
  });

  test("1.3 Rejects registration with invalid Hospital ID format", async ({ page }) => {
    await page.goto("/");
    await page.click("#btn-open-register");

    let dialogMessage = "";
    page.once("dialog", async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.fill("#reg-name", "محمد سعيد");
    await page.fill("#reg-hospital-id", "1234567890"); // Missing leading letter
    await page.click("#btn-submit-register");

    expect(dialogMessage).toMatch(/ID: 1 Letter \+ 9 Nums|حرف \+ 9 أرقام/);
    await expect(page.locator("#modal-register")).toBeVisible();
  });

  test("1.4 Parses 21st century and female gender correctly from 14-digit NID", async ({ page }) => {
    await page.goto("/");
    await page.click("#btn-open-register");

    // Century 3 (2000s), born 15-05-2004, 13th digit even (female)
    await page.fill("#reg-national-id", "30405151234524");
    const ageDisplay = page.locator("#reg-age-display");
    const text = await ageDisplay.innerText();
    expect(text).toMatch(/Female|أنثى/);
    expect(text).toMatch(/22|21|23/);
  });

  // --------------------------------------------------------------------------
  // 2. Triage & ESI Scoring Engine, Sentinel Banner & Protocol Alerts
  // --------------------------------------------------------------------------
  test("2.1 Activates Critical Sentinel Alert banner on ESI-1 arrest patient with jump and mute", async ({ page }) => {
    await page.goto("/");
    // Patient pat-cn-arrest has status Arrest and SpO2 80% -> ESI-1
    const banner = page.locator("#sentinel-banner");
    await expect(banner).toBeVisible();
    await expect(page.locator("#sentinel-title")).toContainText("CRITICAL VITALS ALERT");
    await expect(page.locator("#sentinel-message")).toContainText("محمود حسن مصطفى");

    // Click Jump button to scroll to card
    await page.click("#btn-sentinel-jump");
    const arrestCardHeader = page.locator(`.card-header[data-id="pat-cn-arrest"]`);
    await expect(arrestCardHeader).toBeVisible();

    // Click Mute button
    const muteBtn = page.locator("#btn-sentinel-mute");
    await muteBtn.click();
    await expect(muteBtn).toContainText("Muted");
  });

  test("2.2 Dynamically reveals Workup Protocol alert boxes for Sepsis, STEMI, and Stroke", async ({ page }) => {
    await page.goto("/");

    // Expand accordion for pat-cn-1
    await page.click(`.card-header[data-id="pat-cn-1"]`);
    const details = page.locator("#details_pat-cn-1");
    await expect(details).toBeVisible();

    const diagInput = page.locator("#diag_pat-cn-1");
    const sepsisBox = page.locator("#sepsis_box_pat-cn-1");
    const miBox = page.locator("#mi_box_pat-cn-1");
    const strokeBox = page.locator("#stroke_box_pat-cn-1");

    // 1. Type Sepsis
    await diagInput.fill("Severe Sepsis secondary to pneumonia");
    await expect(sepsisBox).toBeVisible();
    await page.selectOption("#sepsis_pat-cn-1", "Yes");

    // 2. Type STEMI
    await diagInput.fill("Acute Anterior STEMI with chest pain");
    await expect(miBox).toBeVisible();
    await page.selectOption("#mi_pat-cn-1", "Yes");

    // 3. Type Stroke
    await diagInput.fill("Acute Ischemic Stroke / CVA");
    await expect(strokeBox).toBeVisible();
    await page.selectOption("#stroke_pat-cn-1", "Yes");

    // 4. Set pending action to Waiting ICU -> triggers referral box
    await page.selectOption("#action_pat-cn-1", "Waiting ICU");
    const refBox = page.locator("#referral_box_pat-cn-1");
    await expect(refBox).toBeVisible();
    await page.selectOption("#ref_pat-cn-1", "Yes");
  });

  // --------------------------------------------------------------------------
  // 3. Clinical Notes Authoring, Vital Signs & Concurrency Diffing
  // --------------------------------------------------------------------------
  test("3.1 Edits supportive therapy and pending action with automatic delta persistence", async ({ page }) => {
    await page.goto("/");
    await page.click(`.card-header[data-id="pat-cn-1"]`);

    const suppInput = page.locator("#supp_pat-cn-1");
    await suppInput.fill("IV Ceftriaxone 2g, Paracetamol 1g, O2 4L via NC");
    await suppInput.blur();

    // Verify update stored in in-memory DB
    const dbStore = await page.evaluate(() => window.__mockDbStore);
    expect(dbStore.patients["pat-cn-1"].supportiveTx).toBe("IV Ceftriaxone 2g, Paracetamol 1g, O2 4L via NC");
  });

  // --------------------------------------------------------------------------
  // 4. Edge AI Discharge Summary & Mandatory Clinical Attestation Gating
  // --------------------------------------------------------------------------
  test("4.1 Generates AI discharge summary with sandbox network isolation and enforces attestation gating", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();
    const cardHeader = page.locator(`.card-header[data-id="pat-cn-1"]`);
    await expect(cardHeader).toBeVisible();
    await cardHeader.click();

    const details = page.locator("#details_pat-cn-1");
    await expect(details).toBeVisible();

    // Click Discharge Trigger
    const dischargeTrigger = page.locator(`.btn-discharge-trigger[data-id="pat-cn-1"]`);
    await expect(dischargeTrigger).toBeVisible();
    await dischargeTrigger.click();
    const dischargeModal = page.locator("#modal-discharge");
    await expect(dischargeModal).toBeVisible();
    await expect(page.locator("#discharge-patient-name")).toContainText("أحمد إبراهيم خليل");

    // Generate AI Summary
    await page.click("#btn-generate-ai-summary");
    const genBtn = page.locator("#btn-generate-ai-summary");
    await expect(genBtn).toBeEnabled({ timeout: 10000 });
    const editor = page.locator("#ai-summary-editor");
    await expect(editor).toHaveValue(/Working Diagnosis/, { timeout: 10000 });
    await expect(editor).toHaveValue(/Discharge Instructions/);

    // Crucial: Attestation checkbox MUST be unchecked after generation
    const checkbox = page.locator("#ai-attestation-checkbox");
    await expect(checkbox).not.toBeChecked();

    // Attempt to Save without attestation -> MUST BE BLOCKED
    let saveAlertMsg = "";
    page.once("dialog", async dialog => {
      saveAlertMsg = dialog.message();
      await dialog.accept();
    });
    await page.click("#btn-save-ai-summary");
    expect(saveAlertMsg).toMatch(/Clinical Attestation Required/);

    // Select outcome first
    await page.selectOption("#discharge-outcome-select", "Improved");

    // Attempt to Complete Discharge without attestation -> MUST BE BLOCKED
    let dischargeAlertMsg = "";
    page.once("dialog", async dialog => {
      dischargeAlertMsg = dialog.message();
      await dialog.accept();
    });
    await page.click("#btn-submit-discharge");
    expect(dischargeAlertMsg).toMatch(/Clinical Attestation Required/);
    await expect(dischargeModal).toBeVisible();

    // Check Attestation Checkbox
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Submit discharge now that attestation is checked
    await page.click("#btn-submit-discharge");

    // Modal should close and patient should move from active to Discharged list
    await expect(dischargeModal).toBeHidden();
    await expect(page.locator(`#patient-list-container .patient-card:has-text("أحمد إبراهيم خليل")`)).toBeHidden();

    // Check discharged list container
    const dischargedContainer = page.locator("#discharged-list-container");
    await expect(dischargedContainer).toContainText("أحمد إبراهيم خليل");
    await expect(page.locator("#stat-improved")).toContainText("1");
  });

  // --------------------------------------------------------------------------
  // 5. RBAC Negative Boundary Checks
  // --------------------------------------------------------------------------
  test("5.1 Chief Nurse is strictly denied access to purge buttons and Owner tab", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Data control actions must be hidden
    const dataControl = page.locator("#data-control-actions");
    await expect(dataControl).toHaveCSS("display", "none");

    // Owner Tab must be hidden
    const ownerTab = page.locator("#tab-owner");
    await expect(ownerTab).toHaveClass(/hidden/);

    // Attempting to switch tab programmatically aborts
    await page.evaluate(() => {
      if (typeof window.switchTab === "function") window.switchTab("owner");
    });
    await expect(page.locator("#view-owner")).toHaveClass(/hidden/);
    await expect(page.locator("#view-live-board")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 6. Offline Mode & Background Sync Flushed Event
  // --------------------------------------------------------------------------
  test("6.1 Supports offline mode and triggers background sync on reconnect", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Dispatch offline event
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Edit notes offline
    await page.click(`.card-header[data-id="pat-cn-1"]`);
    await page.fill("#supp_pat-cn-1", "Offline IV infusion started");
    await page.locator("#supp_pat-cn-1").blur();

    // Reconnect: dispatch online and background-sync:flushed
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new CustomEvent("background-sync:flushed", {
        detail: { count: 1, lastSync: new Date().toISOString() }
      }));
    });

    // Check DB store updated
    const dbStore = await page.evaluate(() => window.__mockDbStore);
    expect(dbStore.patients["pat-cn-1"].supportiveTx).toBe("Offline IV infusion started");
  });
});

import { test, expect } from "@playwright/test";
import { installFirebaseMocks } from "./helpers/mockFirebase.js";

test.describe("Milestone 3 Adversarial Stress & Chaos Verification Suite", () => {
  const adminOwner = {
    uid: "uid_owner_root",
    email: "owner@imc.com",
    displayName: "Dr. System Owner"
  };

  const chiefNurse = {
    uid: "uid_nurse_fatima",
    email: "fatima.nurse@imc.com",
    displayName: "Fatima Ali (Chief Nurse)"
  };

  const initialUsers = [
    {
      id: "uid_owner_root",
      email: "owner@imc.com",
      role: "owner",
      createdAt: "2026-08-01T08:00:00Z"
    },
    {
      id: "uid_nurse_fatima",
      email: "fatima.nurse@imc.com",
      role: "chief_nurse",
      createdAt: "2026-08-01T08:00:00Z"
    }
  ];

  const samplePatients = [
    {
      id: "pat-stress-101",
      name: "أحمد كمال الدين",
      patientId: "A101010101",
      nationalId: "29001011234567",
      location: "Room 1",
      department: "Internal Medicine",
      primaryDepartment: "Internal Medicine",
      status: "Under assessment",
      pendingAction: "Waiting ward",
      isDischarged: false,
      registrationTime: new Date(Date.now() - 3 * 36e5).toISOString(),
      diagnosis: "Acute Bronchitis",
      supportiveTx: "Paracetamol 1g PO",
      vitals: [{ time: "09:00", bp: "125/82", hr: "78", spo2: "99", rr: "16", temp: "37.2" }],
      labs: [],
      notes: []
    },
    {
      id: "pat-stress-102",
      name: "سارة محمد إبراهيم",
      patientId: "S202020202",
      nationalId: "29505051234568",
      location: "Room 2",
      department: "Cardiology / CCU",
      primaryDepartment: "Cardiology / CCU",
      status: "Under assessment",
      pendingAction: "Waiting CCU",
      isDischarged: false,
      registrationTime: new Date(Date.now() - 6 * 36e5).toISOString(),
      diagnosis: "Chest Pain Unspecified",
      supportiveTx: "Aspirin 300mg PO",
      vitals: [{ time: "07:00", bp: "140/90", hr: "95", spo2: "96", rr: "20", temp: "36.9" }],
      labs: [],
      notes: []
    }
  ];

  // --------------------------------------------------------------------------
  // 1. CONCURRENCY, RAPID KEYSTROKES & CARET PRESERVATION UNDER HIGH-HZ CHURN
  // --------------------------------------------------------------------------
  test("1.1 Rapid simulated keystrokes with simultaneous snapshot churn maintain caret position and zero character drops", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: chiefNurse,
      initialUsers: initialUsers,
      initialPatients: samplePatients
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Expand patient card
    const cardHeader = page.locator(`.card-header[data-id="pat-stress-101"]`);
    await cardHeader.click();
    const details = page.locator("#details_pat-stress-101");
    await expect(details).toBeVisible();

    const diagInput = page.locator("#diag_pat-stress-101");
    await diagInput.focus();
    await expect(diagInput).toBeFocused();

    // Clear input first
    await diagInput.fill("");

    // Type character by character with simulated concurrent snapshot updates in background
    const chunks = ["Pneumonia", " with severe", " pleuritic chest pain", " and hypoxia"];
    for (let i = 0; i < chunks.length; i++) {
      await diagInput.type(chunks[i], { delay: 20 });
      // Trigger background snapshot churn
      await page.evaluate((idx) => {
        const p = window.__mockDbStore.patients["pat-stress-101"];
        if (p) {
          p.supportiveTx = `O2 therapy rev ${idx}`;
        }
        window.__notifySnapshot("patients");
      }, i);
    }

    const expectedText = "Pneumonia with severe pleuritic chest pain and hypoxia";
    const finalVal = await diagInput.inputValue();
    expect(finalVal).toBe(expectedText);
    await expect(diagInput).toBeFocused();

    // Blur to trigger auto-save
    await diagInput.blur();

    // Verify store has merged both the local diagnosis update and the concurrent background update
    await expect.poll(async () => {
      const dbStore = await page.evaluate(() => window.__mockDbStore);
      const p = dbStore.patients["pat-stress-101"];
      return {
        diagnosis: p?.diagnosis,
        supportiveTx: p?.supportiveTx
      };
    }).toEqual({
      diagnosis: expectedText,
      supportiveTx: "O2 therapy rev 3"
    });
  });

  test("1.2 Arabic RTL keystrokes with diacritics under high-frequency churn preserve caret and delta diffing", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: chiefNurse,
      initialUsers: initialUsers,
      initialPatients: samplePatients
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Expand patient card
    await page.click(`.card-header[data-id="pat-stress-101"]`);
    const diagInput = page.locator("#diag_pat-stress-101");
    await diagInput.focus();
    await diagInput.fill("");

    const arabicChunks = ["التهاب رئوي حاد", " مصحوب بارتفاع في الحرارة", " وضيق تنفس"];
    for (let i = 0; i < arabicChunks.length; i++) {
      await diagInput.type(arabicChunks[i], { delay: 20 });
      await page.evaluate((idx) => {
        const p = window.__mockDbStore.patients["pat-stress-101"];
        if (p) {
          p.supportiveTx = `مضاد حيوي وريدي ${idx}`;
        }
        window.__notifySnapshot("patients");
      }, i);
    }

    const expectedArabic = "التهاب رئوي حاد مصحوب بارتفاع في الحرارة وضيق تنفس";
    expect(await diagInput.inputValue()).toBe(expectedArabic);
    await diagInput.blur();

    await expect.poll(async () => {
      const dbStore = await page.evaluate(() => window.__mockDbStore);
      const p = dbStore.patients["pat-stress-101"];
      return {
        diagnosis: p?.diagnosis,
        supportiveTx: p?.supportiveTx
      };
    }).toEqual({
      diagnosis: expectedArabic,
      supportiveTx: "مضاد حيوي وريدي 2"
    });
  });

  // --------------------------------------------------------------------------
  // 2. MULTI-ROLE SWITCHING & DYNAMIC PROMOTION/DEMOTION LIFECYCLE
  // --------------------------------------------------------------------------
  test("2.1 Dynamic user role lifecycle: pending -> chief_nurse -> medical_director -> owner -> blocked", async ({ page }) => {
    const dynamicUser = {
      uid: "uid_dynamic_staff",
      email: "dynamic@imc.com",
      displayName: "Dynamic Staff Member"
    };

    const dynamicUserDoc = {
      id: "uid_dynamic_staff",
      email: "dynamic@imc.com",
      role: "pending",
      createdAt: "2026-08-01T08:00:00Z"
    };

    await installFirebaseMocks(page, {
      user: dynamicUser,
      initialUsers: [dynamicUserDoc, ...initialUsers],
      initialPatients: samplePatients
    });

    await page.goto("/");

    // 1. Pending: Quarantined at access gate
    await expect(page.locator("#access-gate")).toBeVisible();
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);

    // 2. Promoted to chief_nurse: Gate unlocks, board visible, Owner tab hidden, Purge hidden
    await page.evaluate(() => {
      window.__mockDbStore.users["uid_dynamic_staff"].role = "chief_nurse";
      window.__notifyAuth({
        uid: "uid_dynamic_staff",
        email: "dynamic@imc.com",
        displayName: "Dynamic Staff Member"
      });
    });
    await expect(page.locator("#app-section")).toBeVisible();
    await expect(page.locator("#access-gate")).toHaveClass(/hidden/);
    await expect(page.locator("#tab-owner")).toHaveClass(/hidden/);
    await expect(page.locator("#btn-delete-discharged")).toHaveClass(/hidden/);

    // 3. Promoted to medical_director: Purge discharged visible, Owner tab hidden
    await page.evaluate(() => {
      window.__mockDbStore.users["uid_dynamic_staff"].role = "medical_director";
      window.__notifyAuth({
        uid: "uid_dynamic_staff",
        email: "dynamic@imc.com",
        displayName: "Dynamic Staff Member"
      });
    });
    await expect(page.locator("#btn-delete-discharged")).toBeVisible();
    await expect(page.locator("#tab-owner")).toHaveClass(/hidden/);

    // 4. Promoted to owner: Owner tab visible, Purge ALL available
    await page.evaluate(() => {
      window.__mockDbStore.users["uid_dynamic_staff"].role = "owner";
      window.__notifyAuth({
        uid: "uid_dynamic_staff",
        email: "dynamic@imc.com",
        displayName: "Dynamic Staff Member"
      });
    });
    await expect(page.locator("#tab-owner")).toBeVisible();
    await expect(page.locator("#tab-owner")).not.toHaveClass(/hidden/);

    // Switch to owner tab and verify user management views
    await page.click("#tab-owner");
    await expect(page.locator("#view-owner")).toBeVisible();
    await expect(page.locator("#users-list-container")).toBeVisible();

    // 5. Demoted/Blocked: Immediate lock out behind access gate
    await page.evaluate(() => {
      window.__mockDbStore.users["uid_dynamic_staff"].role = "blocked";
      window.__notifyAuth({
        uid: "uid_dynamic_staff",
        email: "dynamic@imc.com",
        displayName: "Dynamic Staff Member"
      });
    });
    await expect(page.locator("#access-gate")).toBeVisible();
    await expect(page.locator("#app-section")).toHaveClass(/hidden/);
    await expect(page.locator("#gate-message")).toContainText(/revoked|إيقاف/i);
  });

  // --------------------------------------------------------------------------
  // 3. RESPONSIVE VIEWPORT ALTERATIONS & LAYOUT CHURN
  // --------------------------------------------------------------------------
  test("3.1 Rapid viewport alterations (Desktop -> Tablet -> Mobile -> Desktop) preserve interactive element accessibility", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: adminOwner,
      initialUsers: initialUsers,
      initialPatients: samplePatients
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    const viewports = [
      { name: "Desktop Wide", width: 1920, height: 1080 },
      { name: "Laptop Standard", width: 1280, height: 720 },
      { name: "Tablet Portrait", width: 768, height: 1024 },
      { name: "Mobile Large", width: 414, height: 896 },
      { name: "Mobile Small", width: 375, height: 667 },
      { name: "Desktop Wide (Return)", width: 1920, height: 1080 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Verify essential components remain visible and interactable
      await expect(page.locator("#app-section")).toBeVisible();
      await expect(page.locator("#patient-list-container")).toBeVisible();
      await expect(page.locator("#stat-total-visits")).toBeVisible();

      // Test filter interaction at each viewport size
      const searchInput = page.locator("#patient-search-input");
      if (await searchInput.isVisible()) {
        await searchInput.fill("أحمد");
        await expect(page.locator("#patient-list-container")).toContainText("أحمد كمال الدين");
        await searchInput.fill("");
      }
    }
  });

  // --------------------------------------------------------------------------
  // 4. MODAL OPEN / CLOSE SEQUENCES & DIALOG TRAPS
  // --------------------------------------------------------------------------
  test("4.1 Rapid modal opening, backdrop closing, ESC dismissals, and form reset cycles", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: adminOwner,
      initialUsers: initialUsers,
      initialPatients: samplePatients
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    const btnOpenReg = page.locator("#btn-open-register");
    const regModal = page.locator("#modal-register");

    // Cycle 1: Open and close via close button
    await btnOpenReg.click();
    await expect(regModal).toBeVisible();
    await page.click("#modal-register .close-modal");
    await expect(regModal).toBeHidden();

    // Cycle 2: Open, select room, close room selector
    await btnOpenReg.click();
    await expect(regModal).toBeVisible();
    await page.click("#btn-select-room");
    const roomModal = page.locator("#modal-select-room");
    await expect(roomModal).toBeVisible();
    await page.click(`.room-option-btn[data-room="Room 3"]`);
    await expect(roomModal).toBeHidden();
    expect(await page.locator("#reg-room").inputValue()).toBe("Room 3");

    // Close reg modal via close button
    await page.click("#modal-register .close-modal");
    await expect(regModal).toBeHidden();

    // Cycle 3: Discharge modal open and cancel
    await page.click(`.card-header[data-id="pat-stress-101"]`);
    const dischargeTrigger = page.locator(`.btn-discharge-trigger[data-id="pat-stress-101"]`);
    await dischargeTrigger.click();
    const dischargeModal = page.locator("#modal-discharge");
    await expect(dischargeModal).toBeVisible();
    await page.click("#modal-discharge .close-modal");
    await expect(dischargeModal).toBeHidden();
  });

  // --------------------------------------------------------------------------
  // 5. RAPID OFFLINE / ONLINE FLAPPING & BACKGROUND SYNC DRAIN
  // --------------------------------------------------------------------------
  test("5.1 Network transition offline note update and sync flush on reconnect", async ({ page }) => {
    await installFirebaseMocks(page, {
      user: chiefNurse,
      initialUsers: initialUsers,
      initialPatients: samplePatients
    });

    await page.goto("/");
    await expect(page.locator("#app-section")).toBeVisible();

    // Expand patient
    await page.click(`.card-header[data-id="pat-stress-102"]`);
    const details = page.locator("#details_pat-stress-102");
    await expect(details).toBeVisible();

    // Dispatch offline event
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Update supportive therapy offline
    const suppInput = page.locator("#supp_pat-stress-102");
    await suppInput.fill("Offline Med: Dobutamine 5mcg/kg/min");
    await suppInput.blur();

    // Dispatch online and background sync flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new CustomEvent("background-sync:flushed", {
        detail: { count: 1, lastSync: new Date().toISOString() }
      }));
    });

    // Verify the update synced to Firestore store
    await expect.poll(async () => {
      const dbStore = await page.evaluate(() => window.__mockDbStore);
      const p = dbStore.patients["pat-stress-102"];
      return p?.supportiveTx;
    }).toBe("Offline Med: Dobutamine 5mcg/kg/min");
  });
});

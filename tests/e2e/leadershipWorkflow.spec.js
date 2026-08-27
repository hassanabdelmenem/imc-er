import { test, expect } from "@playwright/test";
import { installFirebaseMocks } from "./helpers/mockFirebase.js";

test.describe("Leadership Tier Workflows — E2E Suite", () => {
  const leadershipRoles = ["medical_director", "emergency_manager", "emergency_deputy_manager"];

  for (const role of leadershipRoles) {
    test.describe(`Role: ${role}`, () => {
      const userObj = {
        uid: `uid_${role}`,
        email: `${role}@imc.com`,
        displayName: `Dr. Leadership (${role})`
      };

      const userDoc = {
        id: `uid_${role}`,
        email: `${role}@imc.com`,
        role: role,
        createdAt: "2026-08-01T08:00:00Z"
      };

      const samplePatients = [
        {
          id: `pat-lead-active-1`,
          name: "سامي عبد الرحمن",
          patientId: "M111222333",
          nationalId: "28001011234567",
          location: "Room 4",
          department: "Internal Medicine",
          primaryDepartment: "Internal Medicine",
          status: "Under assessment",
          pendingAction: "Waiting ICU",
          isDischarged: false,
          registrationTime: new Date(Date.now() - 5 * 36e5).toISOString(), // 5 hrs (in 4-6h bracket)
          vitals: [{ time: "08:00", bp: "110/70", hr: "84", spo2: "97", rr: "18", temp: "37.1" }],
          labs: [],
          notes: []
        },
        {
          id: `pat-lead-active-2`,
          name: "خالد سعيد فوزي",
          patientId: "K444555666",
          nationalId: "29202021234568",
          location: "Cardio Observations",
          department: "Cardiology / CCU",
          primaryDepartment: "Cardiology / CCU",
          status: "Under assessment",
          pendingAction: "Waiting CCU",
          isDischarged: false,
          registrationTime: new Date(Date.now() - 14 * 36e5).toISOString(), // 14 hrs (in 12-24h bracket)
          vitals: [{ time: "06:00", bp: "135/85", hr: "92", spo2: "96", rr: "16", temp: "36.8" }],
          labs: [],
          notes: []
        },
        {
          id: `pat-lead-disch-1`,
          name: "هدى محمود كمال",
          patientId: "H777888999",
          nationalId: "28803031234569",
          location: "Room 3",
          department: "Internal Medicine",
          primaryDepartment: "Internal Medicine",
          status: "Discharged",
          pendingAction: "Discharged",
          dischargeOutcome: "Ward Admission",
          isDischarged: true,
          registrationTime: new Date(Date.now() - 5 * 36e5).toISOString(),
          dischargeTime: new Date(Date.now() - 1 * 36e5).toISOString(),
          vitals: [],
          labs: [],
          notes: []
        },
        {
          id: `pat-lead-disch-2`,
          name: "نادية حسن أحمد",
          patientId: "N123123123",
          nationalId: "29404041234570",
          location: "Arrest",
          department: "Emergency Medicine (ER)",
          primaryDepartment: "Emergency Medicine (ER)",
          status: "Discharged",
          pendingAction: "Discharged",
          dischargeOutcome: "Improved",
          isDischarged: true,
          registrationTime: new Date(Date.now() - 4 * 36e5).toISOString(),
          dischargeTime: new Date(Date.now() - 2 * 36e5).toISOString(),
          vitals: [],
          labs: [],
          notes: []
        }
      ];

      test.beforeEach(async ({ page }) => {
        await installFirebaseMocks(page, {
          user: userObj,
          initialUsers: [userDoc],
          initialPatients: samplePatients,
          initialRemoteConfig: { enable_batch_purge: true, enable_edge_ai_synthesis: true }
        });
      });

      test(`1. Shift Capacity Tracking & Analytics Dashboard (${role})`, async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#app-section")).toBeVisible();
        await expect(page.locator("#user-info")).toBeVisible();

        // 4 total patients (2 active + 2 discharged in current shift)
        await expect(page.locator("#stat-total-visits")).toContainText("4");
        await expect(page.locator("#stat-admissions")).toContainText("1");
        await expect(page.locator("#stat-improved")).toContainText("1");

        // Toggle Admissions breakdown
        const admHeader = page.locator("#analytics-admissions-header");
        await admHeader.click();
        const admBody = page.locator("#analytics-admissions-body");
        await expect(admBody).toBeVisible();
        await expect(page.locator("#stat-adm-ward")).toContainText("1");
      });

      test(`2. Length of Stay and Waitlist KPI Filters (${role})`, async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#app-section")).toBeVisible();

        // Length of Stay > 4h filter (pat-lead-active-1 is active and 5h elapsed -> count 1)
        const filter4h = page.locator("#filter-time-4");
        await filter4h.click();
        await expect(page.locator("#list-header-title")).toContainText("4");
        await expect(page.locator("#list-header-count")).toContainText("1");
        await expect(page.locator("#patient-list-container")).toContainText("سامي عبد الرحمن");

        // Length of Stay > 12h filter (pat-lead-active-2 is active and 14h elapsed -> count 1)
        const filter12h = page.locator("#filter-time-12");
        await filter12h.click();
        await expect(page.locator("#list-header-title")).toContainText("12");
        await expect(page.locator("#list-header-count")).toContainText("1");
        await expect(page.locator("#patient-list-container")).toContainText("خالد سعيد فوزي");

        // Waitlist ICU filter
        const filterWaitIcu = page.locator("#filter-wait-icu");
        await filterWaitIcu.click();
        await expect(page.locator("#list-header-title")).toContainText("Wait ICU");
        await expect(page.locator("#patient-list-container")).toContainText("سامي عبد الرحمن");

        // Waitlist CCU filter
        const filterWaitCcu = page.locator("#filter-wait-ccu");
        await filterWaitCcu.click();
        await expect(page.locator("#list-header-title")).toContainText("Wait CCU");
        await expect(page.locator("#patient-list-container")).toContainText("خالد سعيد فوزي");
      });

      test(`3. Clinical Review & Sepsis Protocol Alert Monitoring (${role})`, async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#app-section")).toBeVisible();

        // Expand pat-lead-active-1
        const cardHeader = page.locator(`.card-header[data-id="pat-lead-active-1"]`);
        await expect(cardHeader).toBeVisible();
        await cardHeader.click();

        const details = page.locator("#details_pat-lead-active-1");
        await expect(details).toBeVisible();

        // Update diagnosis to Sepsis -> triggers alert box
        const diag = page.locator("#diag_pat-lead-active-1");
        await diag.fill("Severe Sepsis Alert");
        await expect(page.locator("#sepsis_box_pat-lead-active-1")).toBeVisible();
      });

      test(`4. Patient Clinical Discharge to ICU (${role})`, async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#app-section")).toBeVisible();

        // Expand pat-lead-active-1
        const cardHeader = page.locator(`.card-header[data-id="pat-lead-active-1"]`);
        await expect(cardHeader).toBeVisible();
        await cardHeader.click();

        // Trigger discharge
        const dischargeTrigger = page.locator(`.btn-discharge-trigger[data-id="pat-lead-active-1"]`);
        await expect(dischargeTrigger).toBeVisible();
        await dischargeTrigger.click();

        const dischargeModal = page.locator("#modal-discharge");
        await expect(dischargeModal).toBeVisible();

        // Select outcome and submit discharge
        await page.selectOption("#discharge-outcome-select", "ICU Admission");
        await page.click("#btn-submit-discharge");

        // Modal hidden and record moves to discharged list
        await expect(dischargeModal).toBeHidden();
        await expect(page.locator(`#patient-list-container .patient-card:has-text("سامي عبد الرحمن")`)).toBeHidden();
        await expect(page.locator(`#discharged-list-container .patient-card:has-text("سامي عبد الرحمن")`)).toBeVisible();
      });

      test(`5. Shift Handoff Batch Purging of Discharged Patients (${role})`, async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#app-section")).toBeVisible();

        // Data control container visible
        const dataControl = page.locator("#data-control-actions");
        await expect(dataControl).toHaveCSS("display", "flex");

        // Purge Discharged button visible
        const btnPurgeDischarged = page.locator("#btn-delete-discharged");
        await expect(btnPurgeDischarged).toBeVisible();
        await expect(btnPurgeDischarged).not.toHaveClass(/hidden/);

        // Handle confirm dialog
        page.once("dialog", async dialog => {
          expect(dialog.message()).toMatch(/delete all discharged patient records|حذف جميع سجلات المرضى المغادرين/);
          await dialog.accept();
        });

        await btnPurgeDischarged.click();

        // Verify discharged records purged from DOM and in-memory store
        const dbStore = await page.evaluate(() => window.__mockDbStore);
        expect(dbStore.patients["pat-lead-disch-1"]).toBeUndefined();
        expect(dbStore.patients["pat-lead-disch-2"]).toBeUndefined();
        // Active patients still exist
        expect(dbStore.patients["pat-lead-active-1"]).toBeDefined();
        expect(dbStore.patients["pat-lead-active-2"]).toBeDefined();
      });

      test(`6. Negative Security Enforcement: Owner Tab & Purge ALL Blocked (${role})`, async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#app-section")).toBeVisible();

        // Owner Tab MUST be hidden
        const ownerTab = page.locator("#tab-owner");
        await expect(ownerTab).toHaveClass(/hidden/);

        // Purge ALL button MUST be hidden
        const btnDeleteAll = page.locator("#btn-delete-all");
        await expect(btnDeleteAll).toHaveClass(/hidden/);

        // Attempting to switch to owner tab programmatically fails
        await page.evaluate(() => {
          if (typeof window.switchTab === "function") window.switchTab("owner");
        });
        await expect(page.locator("#view-owner")).toHaveClass(/hidden/);
        await expect(page.locator("#view-live-board")).toBeVisible();

        // Attempting to purge all programmatically triggers security rejection
        let alertMsg = "";
        page.once("dialog", async dialog => {
          alertMsg = dialog.message();
          await dialog.accept();
        });
        await page.evaluate(() => {
          if (typeof window.confirmAndDeletePatients === "function") {
            window.confirmAndDeletePatients(true);
          }
        });
        expect(alertMsg).toMatch(/Only the System Owner can purge all patients|فقط المالك يمكنه حذف جميع السجلات/);

        // Active records still intact
        const dbStore = await page.evaluate(() => window.__mockDbStore);
        expect(dbStore.patients["pat-lead-active-1"]).toBeDefined();
      });
    });
  }
});

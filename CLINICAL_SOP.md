# IMC UNIFIED EMERGENCY COMMAND CENTER
## Standard Operating Procedures (SOP) & Clinical User Manual

**Document Version:** 2026.4 (Phase 9 Production Release)  
**Effective Date:** July 2026  
**Applicability:** Clinical & Administrative Personnel using the IMC ER Console (`imc-er`)

---

## 1. Executive Summary & Purpose

This manual covers the **Tertiary Care EMR Console** at <https://imc-er-manager.web.app> — command console, hospital bed occupancy, and administrative shift analytics — built on Google Firebase and Cloud Firestore.

> **Data boundary — read this before relying on cross-platform data.**
>
> This console runs on its own Firebase project (`imc-er-manager`) with its own
> Cloud Firestore database. Other departmental applications run on **separate
> projects with separate databases**, and no synchronisation exists between
> them.
>
> A patient registered, updated, or discharged here **does not appear** in any
> other application, and vice versa. Do not assume a record entered elsewhere
> is visible on this console, or that an update made here propagates outward.
> Where a patient is handled by more than one system, each must be updated
> directly.
>
> Earlier versions of this document described three "synchronized clinical
> platforms" forming "a single, real-time healthcare ecosystem" sharing one
> canonical backend. That was never true of this console's database, and acting
> on it risks treating a patient from an incomplete record.

This manual outlines the standard operating procedures for **clinical staff (Doctors, Nurses, CMOs)** and **operations managers (Shift Supervisors, Hospital Owners)**. All users must adhere to these guidelines to ensure patient safety, data integrity, and regulatory compliance.

---

## 2. Handling Offline Mode & Network Interruptions

Our 2026 architecture is built with an **Offline-First, Zero-Data-Loss Guarantee** utilizing Service Workers (`sw.js`) and local state synchronization (`Nanostores`).

### 2.1 What Happens When You Lose Network Connectivity?
1. **Automatic Detection:** If hospital Wi-Fi or cellular connectivity drops, the system immediately displays a yellow/orange **Offline Status Indicator** in the top navigation bar (`⚠️ Offline Mode — Changes Cached Locally`).
2. **Continued Access:** You can continue browsing previously loaded patient charts, viewing vital histories, and inspecting active medications without interruption.
3. **Writing Clinical Notes Offline:** 
   - When offline, you may continue typing clinical notes, updating triage statuses, and logging vital observations.
   - When you click **Save** or **Update Notes**, the system stores the payload securely in encrypted local browser storage indexed by patient ID.

### 2.2 Background Synchronization upon Reconnection
1. **Automatic Flush:** As soon as network connectivity is restored, the system's Background Sync engine automatically detects the live connection and transmits all queued local updates (`background-sync:flushed`) to the Cloud Firestore database in strict chronological order.
2. **Visual Confirmation:** Once all queued notes are synced, the status bar returns to **🟢 Online — Synchronized** and a confirmation notification appears.
3. **Troubleshooting & Dead-Letter Protection:** If an atomic sync transaction encounters a network glitch during transmission, our backend **Dead-Letter Queue (`dead_letter_queue`)** captures the exact payload and alerts the IT On-Call Supervisor. No clinical note is ever discarded or overwritten.

> [!IMPORTANT]
> **Doctor Protocol During Offline Mode:** Do not close your browser tab while the **⚠️ Offline Mode** banner is displayed if you have unsaved notes. Wait until connection is restored and the banner turns green (`🟢 Synchronized`) before closing your session or logging out.

---

## 3. Verifying Edge AI Discharge Summaries (`window.ai`)

To accelerate clinical documentation, our system integrates local **Edge AI Synthesis** (`window.ai` / Gemini Nano) to draft patient discharge summaries directly within your browser.

### 3.1 Zero-PHI Leakage & Client-Side Sandbox Guarantee
- **Absolute Privacy:** All AI inference is executed **100% locally on your workstation or device CPU/NPU**.
- **Network Isolation Gatekeeper:** During AI summary generation, the system activates a strict client-side sandbox (`NetworkIsolationGatekeeper`) that intercepts and blocks outbound network requests. 
- **Zero Cloud Leakage:** **No Protected Health Information (PHI)**—including patient names, hospital IDs, diagnoses, or clinical notes—is ever transmitted to external cloud servers, third-party LLM providers, or public internet APIs.

### 3.2 AI Discharge Synthesis Procedure
1. **Initiate Synthesis:** Open the patient profile hub and click the **✨ AI Discharge Summary** button inside the Discharge tab.
2. **Automated Aggregation:** The local engine scans the patient's entire encounter timeline (Chief Complaint, Vitals History, Lab Summaries, Active Medications, and Doctor Notes) and structures a cohesive 4-part clinical draft:
   - **Section 1:** Chief Complaint & Hospital Course
   - **Section 2:** Key Vitals & Diagnostic Findings
   - **Section 3:** Treatment Given & Clinical Interventions
   - **Section 4:** Discharge Instructions & Follow-up Plan

### 3.3 Mandatory Clinical Sign-Off Protocol
> [!WARNING]
> **Clinical Responsibility:** The AI summary is a preliminary draft designed to assist documentation speed. **It does not replace clinical judgment.**
1. **Mandatory Verification:** The attending physician **MUST** read each generated section carefully and verify all medical data, drug dosages, and diagnostic interpretations against original patient records.
2. **Required Edits:** Use the interactive text box to modify any incomplete or imprecise statements before finalizing.
3. **Final Attestation & Sign-Off:** Once verified, check the attestation box (*"I have clinically reviewed and verified this discharge summary"*) and click **Save & Finalize**. Unverified AI drafts cannot be printed or submitted to the central EMR.

---

## 4. Patient Data Purging Protocol & Administrative Rules

To maintain optimal board performance and comply with data governance regulations, patient records are managed through tiered archiving and controlled purging.

### 4.1 Role-Based Purge Authorization
- **Strict Role Limits:** Only authenticated users with the **Owner (`owner`)** or **Manager (`manager`)** role can execute batch purges or archive patient records.
- **Doctor Restrictions:** Attending physicians (`doctor` / `cmo`) can mark patients as **Discharged** and complete summaries, but cannot permanently purge records from the active board or database.

### 4.2 Standard Shift Cleanup & Batch Purging Rules
1. **Daily Shift End Cleanup:** At the conclusion of each 12-hour shift (8:00 AM / 8:00 PM), the Shift Supervisor/Manager must access the **Manager Dashboard**.
2. **Purging Discharged Patients (`Purge Discharged`):**
   - Click **Purge Discharged Patients** to remove all completed, discharged records from the active ER tracking board.
   - Before executing, verify that all discharged patients have a completed and signed-off **Discharge Summary** attached.
3. **Emergency Reset / Purge All (`Purge All Records`):**
   - *Use strictly in emergency staging resets or disaster recovery scenarios.*
   - Clicking **Purge All** requires double-confirmation via system modal and permanently archives active records to historical cold storage (`archive_patients`).
4. **Audit Trail Compliance:** Every purge operation is automatically logged with the user's email, timestamp, and record count in the immutable `settings/audit_logs` collection.

---

## 5. Role-Based Access Quick Reference

| Operational Capability | Attending Doctor (`doctor` / `cmo`) | Shift Manager (`manager`) | Hospital Owner (`owner`) |
| :--- | :---: | :---: | :---: |
| View Active Patient Board & Vitals | ✅ Yes | ✅ Yes | ✅ Yes |
| Add / Admit New Patients | ✅ Yes | ✅ Yes | ✅ Yes |
| Update Clinical Notes & Prescriptions | ✅ Yes | ❌ No *(Read-Only)* | ✅ Yes |
| Generate & Review Edge AI Summaries | ✅ Yes | ❌ No *(Read-Only)* | ✅ Yes |
| View Shift Occupancy & Analytics | ✅ Yes | ✅ Yes | ✅ Yes |
| Execute Batch Purge (`Purge Discharged`) | ❌ No | ✅ Yes | ✅ Yes |
| Manage User Roles & Permissions | ❌ No | ❌ No | ✅ Yes |
| Toggle System Kill-Switches (Remote Config) | ❌ No | ❌ No | ✅ Yes |

---

## 6. Support & Escalation

If you encounter persistent synchronization errors, unexpected UI behaviors, or required feature flag modifications:
- **First Line Support:** Contact the on-duty IT Shift Coordinator via Command Center Intercom (`Ext. 404`).
- **Emergency System Escalation:** Contact the System Lead Orchestrator (`hassan.abdelmenem@gmail.com`).

*END OF STANDARD OPERATING PROCEDURES*

# IMC UNIFIED EMERGENCY COMMAND CENTER
## Standard Operating Procedures (SOP) & Clinical User Manual

**Document Version:** 2026.5  
**Effective Date:** August 2026  
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

This manual outlines the standard operating procedures for every role the console grants: the **clinical tier** (Chief Nurse) and the **leadership tier** (Medical Director, Emergency Manager, Emergency Deputy Manager), together with the **Owner**, who administers accounts. Section 5 is the authoritative capability reference. All users must adhere to these guidelines to ensure patient safety, data integrity, and regulatory compliance.

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
> **Clinical Protocol During Offline Mode:** Do not close your browser tab while the **⚠️ Offline Mode** banner is displayed if you have unsaved notes. Wait until connection is restored and the banner turns green (`🟢 Synchronized`) before closing your session or logging out.

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

To keep the active board legible, records are removed from it in two distinct
ways. **Discharge** takes a patient off the board and keeps the record.
**Purging** deletes the record outright. Only the second is irreversible, and
only it is restricted by the rules below.

### 4.1 Role-Based Purge Authorization

Purging is the only irreversible action in the console. Authorization is split
across two tiers, and the split is enforced in `firestore.rules`, not merely
hidden in the interface:

- **Discharged records** may be purged by the **Owner** (`owner`) and by the
  **leadership tier**: Medical Director (`medical_director`), Emergency Manager
  (`emergency_manager`), Emergency Deputy Manager (`emergency_deputy_manager`).
- **Active, non-discharged records** may be deleted by the **Owner** alone.
- **Chief Nurse** (`chief_nurse`) holds full clinical access to the board —
  registering, updating and discharging patients — but cannot purge or delete
  any record. The Data Control section is not displayed to this role.

Marking a patient **Discharged** is a clinical action available to every role
above. It takes the patient off the active board without destroying anything.
Purging is what destroys it.

### 4.2 Standard Shift Cleanup & Batch Purging Rules
1. **Daily Shift End Cleanup:** At the conclusion of each 12-hour shift (8:00 AM / 8:00 PM), a member of the leadership tier opens the **Data Control** section on the Live Board.
2. **Purging Discharged Patients (`Purge Discharged`):**
   - Click **Purge Discharged Patients** to remove all completed, discharged records from the active ER tracking board.
   - Before executing, verify that all discharged patients have a completed and signed-off **Discharge Summary** attached.
3. **Emergency Reset / Purge All (`Purge All`):**
   - Owner only. Use strictly for emergency staging resets or disaster recovery.
   - Clicking **Purge All** requires double confirmation via the system modal.
   > [!WARNING]
   > **A purge deletes permanently. There is no archive.** The operation issues
   > Firestore batch deletes against the `patients` collection. It does not copy
   > records anywhere first, and nothing in this project can read them back.
   >
   > Revisions of this document before 2026.5 stated that Purge All "permanently
   > archives active records to historical cold storage (`archive_patients`)".
   > No such collection exists and no archival step runs. Treat every purge as
   > unrecoverable.

4. **Audit trail — not implemented.**
   > [!WARNING]
   > Revisions before 2026.5 stated that every purge is logged with the user's
   > email, timestamp and record count to an immutable `settings/audit_logs`
   > collection. That collection does not exist and no purge logging runs.
   >
   > Until it is built, a purge leaves no record inside the application. If a
   > governance review requires an audit trail, capture it outside the system at
   > the time of the purge.

---

## 5. Role-Based Access Quick Reference

Two tiers reach patient data, plus the Owner. "Leadership tier" below means
Medical Director, Emergency Manager and Emergency Deputy Manager, which carry an
identical permission set.

| Operational Capability | Chief Nurse (`chief_nurse`) | Leadership tier | Owner (`owner`) |
| :--- | :---: | :---: | :---: |
| View active patient board & vitals | ✅ Yes | ✅ Yes | ✅ Yes |
| Register / admit new patients | ✅ Yes | ✅ Yes | ✅ Yes |
| Update clinical notes, diagnoses, triage | ✅ Yes | ✅ Yes | ✅ Yes |
| Generate & review Edge AI summaries | ✅ Yes | ✅ Yes | ✅ Yes |
| Discharge a patient | ✅ Yes | ✅ Yes | ✅ Yes |
| View shift occupancy & analytics | ✅ Yes | ✅ Yes | ✅ Yes |
| Purge **discharged** records | ❌ No | ✅ Yes | ✅ Yes |
| Delete **active** records / Purge All | ❌ No | ❌ No | ✅ Yes |
| Approve sign-ups & assign roles | ❌ No | ❌ No | ✅ Yes |
| Toggle system kill-switches (Remote Config) | ❌ No | ❌ No | ✅ Yes |

Two further states are not job titles and grant nothing: `pending` (signed up,
awaiting the Owner's approval) and `blocked` (access revoked). Neither can read
any patient record. A new sign-up stays on `pending` until the Owner assigns one
of the roles above from the **Pending Access Requests** queue in the Owner tab.

---

## 6. Support & Escalation

If you encounter persistent synchronization errors, unexpected UI behaviors, or required feature flag modifications:
- **First Line Support:** Contact the on-duty IT Shift Coordinator via Command Center Intercom (`Ext. 404`).
- **Emergency System Escalation:** Contact the System Lead Orchestrator (`hassan.abdelmenem@gmail.com`).

*END OF STANDARD OPERATING PROCEDURES*

# BRIEFING — 2026-08-23T03:05:00Z

## Mission
Design a comprehensive RBAC security rule test suite in Vitest (`tests/unit/rbac-security.test.js`) validating every match block in `firestore.rules` across all 7 roles, including all required negative test cases, and document the exact test architecture.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Security & RBAC Boundary Verification Explorer
- Working directory: /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m1_explorer_2
- Original parent: bd831e8b-f60e-4bf8-9216-abd3b4bd82d8
- Milestone: Milestone 1 (Security & RBAC Boundary Verification)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in source tree directly
- Analyze problems, synthesize findings, produce structured reports
- Validate firestore.rules across all 7 roles
- Design negative test cases for specific security boundaries

## Current Parent
- Conversation ID: bd831e8b-f60e-4bf8-9216-abd3b4bd82d8
- Updated: 2026-08-23T03:05:00Z

## Investigation State
- **Explored paths**:
  - `firestore.rules` (full inspection of helper functions, match blocks, default deny posture, schema validation rules)
  - `tests/unit/roleModel.test.js`, `tests/unit/authDomain.test.js`, `tests/unit/accessRequests.test.js`, `tests/unit/observability.test.js`
  - `public/js/config.js` (`CLINICAL_ROLES`, `LEADERSHIP_ROLES`, `ASSIGNABLE_ROLES`, `MANAGER_TIER_ROLES`, `OWNER_EMAILS`)
  - `CLINICAL_SOP.md` (role definitions, purge permissions, offline DLQ guarantees)
  - `ORIGINAL_REQUEST.md` and `PROJECT.md` (M1 objectives and acceptance criteria)
- **Key findings**:
  - `firestore.rules` defines 6 distinct match scopes: `/users/{userId}`, `/settings/{docId}`, `/patients/{patientId}`, `/patients/{patientId}/{subcollection=**}`, `/dead_letter_queue/{docId}`, `/telemetry_alerts/{docId}`, and default catch-all `/{document=**}`.
  - Role hierarchy strictly separates 7 personas: `owner` (system admin), leadership tier (`medical_director`, `emergency_manager`, `emergency_deputy_manager`), `chief_nurse` (clinical board without data control purges), and denied lifecycle personas (`pending`, `blocked`).
  - Critical security boundary: Leadership can ONLY delete discharged records (`isDischarged: true` or `status: 'Discharged'`); Chief Nurse CANNOT delete any record; Owner can delete active and discharged records.
  - User administration boundary: Owner alone can assign roles and delete user documents. Leadership and Chief Nurse are strictly prohibited from modifying other users' roles or elevating self privilege.
  - Observability boundary: Clinical staff can append/create DLQ and telemetry records, but Owner alone can inspect (read), update, or clear (delete) them.
  - Schema boundary: `isValidPatientData` enforces strict string type and character length limits on 9 patient attributes (name <= 100, nationalId <= 14, diagnosis <= 1000, supportiveTx <= 1000, patientId <= 50, status <= 100, pendingAction <= 100, primaryDepartment <= 100, dischargeSummary <= 20000).
- **Unexplored areas**: None for M1 RBAC specification.

## Key Decisions Made
- Constructed a pure-JS AST/expression rules evaluator engine (`FirestoreRulesEngine`) in `proposed_rbac-security.test.js` that evaluates security rules operations without requiring an external Java Firestore emulator daemon, executing 43 assertions in ~300ms.
- Authored comprehensive positive and negative test cases covering all 7 roles across all 6 match blocks and schema boundaries.

## Artifact Index
- `proposed_rbac-security.test.js` — Complete, executable Vitest test suite ready to be placed into `tests/unit/rbac-security.test.js`
- `handoff.md` — 5-component handoff report detailing test architecture, observations, logic chains, caveats, and verification commands
- `progress.md` — Liveness heartbeat and step tracking
- `DISPATCH.md` — Incoming message log

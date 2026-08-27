# Original User Request

## 2026-08-23T02:56:34Z

Assign each team member a specific operational role inside the IMC ER application (`owner`, `medical_director`, `emergency_manager`, `chief_nurse`, and unapproved/blocked personas) to comprehensively test all application workflows, enforce RBAC security boundaries, conduct adversarial and chaos testing, expand automated test suites (Playwright and Vitest), resolve any discovered bugs, and verify system-wide stability.

Working directory: /Users/hassanabdelmenem/antigravity/imc-er
Integrity mode: development

## Reference Documentation
- Standard Operating Procedures & Role Specifications: `CLINICAL_SOP.md`
- Security Rules & Access Model: `firestore.rules`, `tests/unit/roleModel.test.js`

## Requirements

### R1. Multi-Role Clinical & Administrative Simulation
Simulate realistic end-to-end workflows for every defined application role:
- **Chief Nurse (`chief_nurse`)**: Execute patient registration, triage scoring, vital signs logging, clinical note authoring, offline mode entry with local storage caching, background synchronization upon reconnect, Edge AI discharge summary draft generation and attestation sign-off, and patient discharge.
- **Leadership Tier (`medical_director`, `emergency_manager`, `emergency_deputy_manager`)**: Execute shift capacity tracking, clinical review, patient discharge, and batch purging of discharged patients during shift handoff.
- **Owner (`owner`)**: Execute user account management (approving pending access requests, rejecting/blocking users, modifying role assignments), Remote Config feature toggle administration, dead-letter queue inspection, single active record deletion, and emergency system purges.
- **Pending & Blocked Personas**: Attempt patient reads, writes, and admin actions to verify strict access denial.

### R2. Role-Based Access Control (RBAC) & Security Boundary Verification
Audit and test security enforcement across both client UI state and Cloud Firestore security rules. Ensure negative test coverage where agents attempt out-of-scope actions (e.g. Chief Nurse attempting data purges or role changes; Leadership tier attempting active record deletion; Pending/Blocked users attempting to read or write patient data) and verify all unauthorized actions are strictly rejected.

### R3. Adversarial, Offline Chaos & Concurrent Stress Testing
Subject the application to edge-case stress scenarios, including concurrent editing by multiple clinicians on the same patient chart, rapid offline-online network flapping during note drafting, offline queue synchronization conflicts, and edge AI sandbox isolation verification (ensuring zero outbound network leakage of PHI).

### R4. Automated Test Suite Expansion & Bug Remediation
Run all existing Vitest (unit, integration, load) and Playwright (E2E) suites. Write new automated test suites covering all role workflows and boundary edge cases. Fix any discovered bugs, layout flaws, or race conditions in the codebase without breaking existing functionality.

## Acceptance Criteria

### Role Capability & Boundary Verification
- [ ] Every role (`chief_nurse`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `owner`, `pending`, `blocked`) has automated test scenarios verifying all permitted operations.
- [ ] Negative test cases verify that restricted operations (unauthorized purges, unauthorized role modifications, unapproved user data access) fail with appropriate permission rejections.
- [ ] Owner emergency reset/purge requires confirmation and only deletes intended records without leaving corrupted state.

### Offline Resilience & Data Integrity
- [ ] Offline patient note creation persists to local storage and successfully synchronizes via background sync upon reconnection with zero data loss.
- [ ] Failed sync transactions properly route to the dead-letter queue without silent data drops.
- [ ] Concurrent edits from multiple simulated clinicians resolve deterministically without corrupting patient history.

### Edge AI Discharge Synthesis & Sandbox Security
- [ ] AI discharge summary synthesis correctly compiles the 4-part summary from encounter history.
- [ ] Network isolation during local AI synthesis is verified with zero outbound network transmissions.
- [ ] Unverified AI summaries are prevented from finalizing or printing without clinical attestation.

### Automated Test Execution
- [ ] All Vitest test suites (`npm run test:unit`, `npm run test:integration`, `npm run test:load`) execute and pass cleanly with 100% success rate.
- [ ] All Playwright E2E suites (`npm run test:e2e`) execute and pass cleanly across all supported viewports and role flows.
- [ ] A final verification summary document is generated detailing all role test results, uncovered issues, and applied fixes.

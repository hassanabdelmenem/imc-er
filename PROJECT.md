# Project: IMC ER Verification, Testing, and Remediation

## Architecture
IMC ER is a mission-critical Emergency Room clinical and administrative management application built on a vanilla JavaScript ESM frontend (`public/js/`), styled with CSS (`public/css/`), powered by Google Firebase (Auth, Cloud Firestore v10.8.1, Remote Config, Service Worker caching), with on-device Post-Quantum hybrid cryptography (`ClinicalCryptoEngine`) and on-device Edge AI discharge summary synthesis (`EdgeAIClinicalEngine` + `NetworkIsolationGatekeeper`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Email/Password Auth | Authenticates staff via Firebase Auth | M1 | Survey | VERIFIED |
| 2 | Google OAuth Sign-In | OAuth popup with fallback to redirect & loop detection | M1 | Survey | VERIFIED |
| 3 | Access Gate Router | Directs non-approved users to gate screens (`pending`, `blocked`) | M1 | Survey | VERIFIED |
| 4 | Owner Administration | Manages user access, approves/rejects/blocks, assigns roles | M1 | Survey | VERIFIED |
| 5 | Leadership Purge Discharged | Removes all discharged patient records from board during shift handoff | M1 | Survey | VERIFIED |
| 6 | Owner Emergency Purge All | Permanently deletes all active & discharged records with confirmation | M1 | Survey | VERIFIED |
| 7 | Chief Nurse Role Enforcement | Full clinical board access; strictly denied purge/delete and user management | M1 | Survey | VERIFIED |
| 8 | Blocked & Pending Role Enforcement | Complete denial of patient data reads/writes and admin actions | M1 | Survey | VERIFIED |
| 9 | Firestore Security Rules Parity | Emulator/Unit verification of all positive & negative permission paths | M1 | Survey | VERIFIED |
| 10 | Patient Registration & Validation | Admits patient with Arabic name regex, Hospital ID regex, and Room/Dept | M3 | Survey | VERIFIED |
| 11 | National ID Demographic Parser | Calculates century, birthdate, age, and gender from 14-digit Egyptian NID | M3 | Survey | VERIFIED |
| 12 | Live Board Urgency Triage & ESI | Computes 5-level ESI based on vitals, clinical status, and triage rules | M3 | Survey | VERIFIED |
| 13 | Live Board Filter & Search | Filters active patients by room, length of stay, waitlist action, or search | M3 | Survey | VERIFIED |
| 14 | Protocol Alert Triggers | Auto-reveals workup alert boxes for Sepsis, MI, Stroke, and Referral | M3 | Survey | VERIFIED |
| 15 | Patient Discharge Flow | Sets status to Discharged, records outcome, and links summary | M3 | Survey | VERIFIED |
| 16 | Shift Analytics Dashboard | Calculates total visits, admissions (Ward/ICU/CCU/PICU), and outcomes | M3 | Survey | VERIFIED |
| 17 | Concurrency-Safe Field Diffing | Calculates delta changes to prevent overwriting peer clinician edits | M2 | Survey | VERIFIED |
| 18 | Caret & Focus Preservation | Preserves active DOM field selection during background snapshot updates | M2 | Survey | VERIFIED |
| 19 | Network Isolation Sandbox | Enforces client sandbox blocking outbound network calls during AI inference | M2 | Survey | VERIFIED |
| 20 | 4-Part Discharge Summary Generation | On-device AI / deterministic synthesis of clinical summary | M2 | Survey | VERIFIED |
| 21 | Clinical Attestation Sign-Off | Mandatory clinical attestation gating before discharge finalization | M2 | Survey | VERIFIED |
| 22 | Service Worker Multi-Tier Caching | Caches assets and clinical APIs with Network-First and SWR | M2 | Survey | VERIFIED |
| 23 | Background Sync Queue Replay | Queues local modifications offline and replays chronologically on reconnect | M2 | Survey | VERIFIED |
| 24 | Dead-Letter Queue (DLQ) | Intercepts failed transactions and logs payload/error to `/dead_letter_queue` | M2 | Survey | VERIFIED |
| 25 | Observability & Remote Config | CWV monitoring (LCP/INP), pre-auth buffer, and live kill-switch toggling | M2 | Survey | VERIFIED |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Security & RBAC Boundary Verification | Multi-role simulation & automated unit tests for all 7 role personas (`chief_nurse`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `owner`, `pending`, `blocked`) across client UI gates and Firestore rules (positive and negative assertions). Verified by 2 review iterations, stress challenges, and forensic audits. | None | DONE |
| M2 | Adversarial Chaos, Offline Queue Sync & Edge AI Sandbox | Automated tests for rapid network flapping, offline note caching, background sync replay, DLQ transaction routing, concurrent editing delta diffing, and `NetworkIsolationGatekeeper` zero-PHI leakage. Verified across 25 test files (288 tests) and clean forensic audit. | M1 | DONE |
| M3 | Comprehensive E2E Testing Track | Requirement-driven opaque-box test suite expansion covering Tiers 1-4 (Feature Coverage, Boundary/Corner Cases, Cross-Feature Combinations, Real-World Workflows). | M1, M2 | DONE |
| M4 | Bug Remediation, Layout Hardening & Full Suite Pass | Fix all identified bugs, edge-case UI issues, attestation gating, and ensure 100% pass rate across `test:unit`, `test:integration`, `test:load`, `test:e2e`, and `build:check`. | M1, M2, M3 | DONE |
| M5 | Final Verification Report & Delivery | Final comprehensive verification report detailing role simulation outcomes, security audit, chaos resilience metrics, test coverage, and sign-off. | M4 | DONE |

---

## Code Layout
- `public/`: Web application root (Vanilla JS ESM + CSS + Assets)
  - `public/index.html`: Main SPA HTML layout
  - `public/css/style.css`: Core design system, responsive styles, `.hidden` priority
  - `public/js/app.js`: Main application controller, UI event handling, state orchestration
  - `public/js/config.js`: Application constants, role definitions, OAuth domains
  - `public/js/store.js`: Reactive in-memory state store and event emitter
  - `public/js/firebase-service.js`: Firebase Auth, Firestore batching, and DLQ operations
  - `public/js/edge-ai-service.js`: ESI triage engine, Gemini Nano AI, and `NetworkIsolationGatekeeper`
  - `public/js/crypto-engine.js`: AES-256-GCM + ML-KEM-768 hybrid encryption
  - `public/js/telemetry-rum.js`: RUM observability, LCP/INP tracking, and ActiveSentinel
  - `public/js/components/ui-components.js`: Reusable UI badges and cards
  - `public/js/i18n.js`: Localization dictionary (English / Arabic)
  - `public/sw.js`: Workbox Service Worker for offline caching
- `firestore.rules`: Cloud Firestore security rules
- `scripts/`: Build and preflight utilities (`build-prod.js`, `preflight.js`)
- `tests/`: Automated test suites
  - `tests/unit/`: Vitest unit test suites (`rbac-security.test.js` [43 tests], `roleSimulation.test.js` [22 tests], `roleSimulationStress.test.js` [12 tests], `roleModel.test.js` [12 tests], `accessRequests.test.js` [10 tests], `authDomain.test.js` [12 tests], `nationalId.test.js` [10 tests], `observability.test.js` [13 tests], `concurrent-editing.test.js` [8 tests], `redirectSignIn.test.js` [10 tests])
  - `tests/integration/`: Vitest integration test suites (`patientTransfer`, `offlineChaos`)
  - `tests/load/`: Vitest load test suites (`concurrentDoctors`)
  - `tests/e2e/`: Playwright end-to-end test suites (`authHandshake.spec.js`, `offlineSync.spec.js`)
- `dist/`: Production distribution mirroring `public/` (verified via `npm run build:check`)

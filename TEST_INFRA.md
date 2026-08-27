# E2E Test Infra: IMC ER

## Test Philosophy
- Opaque-box, requirement-driven testing. Derived directly from `ORIGINAL_REQUEST.md`, `CLINICAL_SOP.md`, and `firestore.rules`.
- Multi-tier methodology:
  - **Tier 1: Feature Coverage (>=5 per feature area)**: Positive tests verifying each clinical, administrative, security, and offline feature in isolation.
  - **Tier 2: Boundary & Corner Cases (>=5 per feature area)**: Negative tests, malformed inputs (invalid NID, invalid HospID, non-Arabic name, unauthorized actions), and payload size limits.
  - **Tier 3: Cross-Feature Combinations (Pairwise)**: Interacting features (concurrent multi-clinician edits with background sync, offline note drafting with remote config kill-switch toggling, AI discharge summary with network isolation and attestation gating).
  - **Tier 4: Real-World Clinical Workloads & Multi-Role Scenarios**: Full shift simulations for `chief_nurse`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `owner`, and `pending`/`blocked` personas.

---

## Feature Inventory & Test Coverage Mapping
| # | Feature Area | Source (Requirement) | Tier 1 (Positive) | Tier 2 (Boundary/Negative) | Tier 3 (Cross-Feature) | Tier 4 (Workloads) |
|---|--------------|---------------------|:-----------------:|:--------------------------:|:----------------------:|:------------------:|
| 1 | RBAC & Security Boundaries | ORIGINAL_REQUEST §R2, CLINICAL_SOP §5 | 5 | 8 | 4 | 7 Roles Simulated |
| 2 | Clinical Workflows & Live Board | ORIGINAL_REQUEST §R1, CLINICAL_SOP §1-§4 | 8 | 6 | 4 | Real-world triage/discharge |
| 3 | Demographics (14-digit NID) | ORIGINAL_REQUEST §R1, CLINICAL_SOP §1 | 5 | 5 | 2 | Admission batch parsing |
| 4 | Offline Sync & Dead-Letter Queue | ORIGINAL_REQUEST §R3, CLINICAL_SOP §2 | 5 | 5 | 4 | Network flapping simulation |
| 5 | Edge AI Sandbox & Attestation | ORIGINAL_REQUEST §R3, CLINICAL_SOP §3 | 5 | 4 | 3 | Zero-PHI network isolation |
| 6 | Concurrency & Keystroke Preservation | ORIGINAL_REQUEST §R3, CLINICAL_SOP §1 | 4 | 4 | 4 | Multi-doctor concurrent edits |
| 7 | Shift Analytics & Observability | ORIGINAL_REQUEST §R1, CLINICAL_SOP §4 | 4 | 3 | 2 | 8 AM shift reset & RUM |

---

## Test Architecture
- **Unit & Component Testing Runner**: Vitest (`npm run test:unit`) with jsdom environment.
- **Integration & Chaos Runner**: Vitest (`npm run test:integration`) simulating IndexedDB/localStorage offline queues, network loss, and Firestore snapshot listeners.
- **Load Stress Runner**: Vitest (`npm run test:load`) simulating 100 concurrent doctor sessions and 5,000 patient cards.
- **End-to-End Runner**: Playwright (`npm run test:e2e`) executing multi-role browser workflows against local web server.

---

## Coverage Thresholds
- Tier 1: ≥ 35 positive test cases covering all inventoried features.
- Tier 2: ≥ 35 negative & boundary test cases covering all forbidden actions and malformed inputs.
- Tier 3: ≥ 15 cross-feature integration test cases.
- Tier 4: ≥ 7 role-based end-to-end clinical workflow scenarios.
- Overall Target: 100% test pass rate across all Vitest and Playwright test suites.

# BRIEFING — 2026-08-23T04:37:30Z

## Mission
Design concrete, reproducible test specifications for the 4-tier E2E testing methodology in Milestone 3 (Comprehensive E2E Testing Track) across all IMC ER clinical, administrative, security, and offline features.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Specification Mining, Quality Engineering, E2E Test Architecture
- Working directory: /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m3_spec_miner_2
- Original parent: bd831e8b-f60e-4bf8-9216-abd3b4bd82d8
- Milestone: Milestone 3 — Comprehensive E2E Testing Track

## 🔒 Key Constraints
- Comprehensive coverage across all 4 tiers of E2E testing methodology:
  * Tier 1: Feature Coverage (>=5 test cases per feature area across 10 areas: Auth, Registration, Triage, Clinical Notes, Crypto, AI Discharge, Offline Sync, DLQ, Remote Config, Role Purges).
  * Tier 2: Boundary & Corner Cases (empty/max lengths, extreme vitals, non-Latin Arabic strings, rapid network flapping, pre-auth buffering, token boundary checks).
  * Tier 3: Cross-Feature Combinations (pairwise interactions: Auth + RBAC, Triage + ESI, Offline + DLQ, Arabic Crypto + Caret Preservation, AI Attestation + Discharge).
  * Tier 4: Real-World Scenarios (5 full clinical workflows: MCI Surge, STEMI Pathway, Shift Handover Concurrency, Extended Outage Recovery, Hostile Insider Quarantine).
- Read-only probe; do not implement application code changes.
- Ground all specifications in authoritative codebases (`public/js/`, `firestore.rules`, `CLINICAL_SOP.md`, `PROJECT.md`, `TEST_INFRA.md`).

## Current Parent
- Conversation ID: bd831e8b-f60e-4bf8-9216-abd3b4bd82d8
- Updated: 2026-08-23T04:37:30Z

## Task Summary
- **What to build**: Complete, reproducible test specification document for Milestone 3.
- **Success criteria**: Exhaustive test matrices with inputs, mocks, UI assertions, and acceptance criteria covering all 4 tiers.
- **Interface contracts**: `PROJECT.md`, `TEST_INFRA.md`, `CLINICAL_SOP.md`, `firestore.rules`.
- **Code layout**: `public/js/`, `firestore.rules`, `tests/`.

## Key Decisions Made
- Organized Tier 1 into 10 feature areas with 5+ test cases each (total 50+ cases) with unambiguous DOM selectors, mock hooks, and assertions.
- Formulated Tier 2 boundary cases targeting exact Firestore schema rules (e.g. 100/101 chars, 14/15 NID chars, 20000/20001 AI summary chars) and clinical vital outliers.
- Formulated Tier 3 cross-feature combinations capturing race conditions, background sync replay, caret preservation, and cryptographic integrity.
- Formulated Tier 4 real-world workloads with full clinical state machines for MCI Surge, STEMI Pathway, Shift Handover, Outage Recovery, and Quarantine.

## Artifact Index
- `.agents/teamwork_preview_m3_spec_miner_2/DISPATCH.md` — Dispatch instructions
- `.agents/teamwork_preview_m3_spec_miner_2/BRIEFING.md` — Situational awareness
- `.agents/teamwork_preview_m3_spec_miner_2/progress.md` — Liveness & progress tracking
- `.agents/teamwork_preview_m3_spec_miner_2/handoff.md` — Comprehensive 5-component handoff report with complete test specs

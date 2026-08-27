# BRIEFING — 2026-08-23T05:58:02Z

## Mission
Discover and document all functional requirements, role operating procedures, offline sync & DLQ specifications, Edge AI sandbox guarantees, and adversarial/chaos test boundaries for the IMC ER system.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Teamwork specialist, Specification Miner
- Working directory: /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_spec_miner_survey_3
- Original parent: bd831e8b-f60e-4bf8-9216-abd3b4bd82d8
- Milestone: IMC ER Specification Mining & Verification Matrix

## 🔒 Key Constraints
- Read-only: do NOT implement code changes.
- Exhaustively probe all functional specifications, CLINICAL_SOP.md, ORIGINAL_REQUEST.md, SYNC.md, DEPLOYMENT_MANIFEST.md, security rules, and tests.
- Produce structured Feature Inventory and test verification matrix with explicit acceptance criteria.
- Submit results via handoff.md and send_message to parent.

## Current Parent
- Conversation ID: bd831e8b-f60e-4bf8-9216-abd3b4bd82d8
- Updated: 2026-08-23T05:58:02Z

## Task Summary
- **What to build**: Specification discovery report and verification matrix.
- **Success criteria**: Comprehensive feature inventory, role matrix, offline sync & DLQ specs, Edge AI sandbox specs, chaos/boundary test scenarios.
- **Interface contracts**: CLINICAL_SOP.md, firestore.rules, public/js/config.js, ORIGINAL_REQUEST.md.
- **Code layout**: public/ (source), dist/ (artifact), tests/ (unit, integration, load, e2e), firestore.rules.

## Key Decisions Made
- Extracted complete role capabilities across all 7 states (`owner`, `medical_director`, `emergency_manager`, `emergency_deputy_manager`, `chief_nurse`, `pending`, `blocked`).
- Mapped offline caching, queue replay, DLQ fallback, and telemetry buffering lifecycle.
- Formalized Edge AI network isolation sandbox requirements and 4-part summary schema.
- Built explicit acceptance criteria and chaos testing matrix covering concurrent editing, network flapping, and security boundaries.

## Artifact Index
- /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_spec_miner_survey_3/DISPATCH.md — Dispatch log
- /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_spec_miner_survey_3/progress.md — Liveness heartbeat
- /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_spec_miner_survey_3/handoff.md — Complete 5-component specification mining report

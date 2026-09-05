# Graph Report - imc-er  (2026-09-05)

## Corpus Check
- 358 files · ~240,775 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1383 nodes · 2107 edges · 127 communities (81 shown, 46 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 133 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c1849fc1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Orchestrator Handoffs & Gates
- M3 Challenger/Explorer/Reviewer Team
- firebase-service.js
- iOS/Firebase Init Patterns
- Original User Request: IMC ER Multi-Role Testing & RBAC Verification
- Data Connect Cloud Functions
- NPM Package Dependencies
- Empirical Stress Test Harness
- Data Connect Schema Examples
- Data Connect Deployment & SDKs
- test-app.cjs
- Legacy Archive & Migration
- RBAC Adversarial Boundary Tests
- RBAC Security Test Proposal
- app.js
- RBAC Security Rules Tests
- RBAC Test Config & Roles
- UX/UI Guidelines for Clinical Management Applications
- M1 Reviewer Team Cycle
- edge-ai-service.js
- Explorer 2 Edge AI & Attestation Test Design Report
- Nanostores State Store
- M1 Explorer/Reviewer Handoffs
- M4 Worker & Gate Status
- Auth Domain Preflight Checks
- M2 Worker 2 Handoff Report (Remediation)
- M2 Worker 1 Handoff Report
- Admin Role Assignment Script
- Data Connect Native SQL
- M2 Challenger 2 Adversarial Penetration Report
- Clinical SOP & RBAC Roles
- i18n & Manager Role Checks
- Role Simulation Stress Test
- Accessibility & Contrast Fixes
- AI Logic Flutter/Web Chat
- M1 Challenger 2/3 Remediation
- Reviewer 2 Independent Review Report
- App Hosting CLI Config
- Firebase Auth Basics Skill
- M3 Access Gate Spec Design
- RBAC Permission Matrix Survey
- M1 Explorer/Auditor Handoffs
- ORIGINAL_REQUEST.md
- IMC ER Feature Inventory
- Flutter Firebase Setup Guide
- Edge AI Discharge Sign-Off
- m2-adversarial-challenge.test.js
- Role Simulation Test Suite
- Chief Nurse Workflow Analysis
- patch.cjs
- M2 Challenger 2 Retest Dispatch
- Xcode SPM Setup Script
- M4 Worker 1 Dispatch Instructions
- M3 E2E Mock Firebase Layer
- AI Logic iOS/Android Setup
- NetworkIsolationGatekeeper
- Production Build Script
- M2 Path/Query Attack Harness
- Codebase Survey & Audit Briefings
- M1 Challenger 1 RBAC Stress
- M3 Worker 1 Gate Mechanisms
- Clinical Crypto Engine (PQ)
- M2 Concurrency Harness Script
- Firebase Android Setup Guide
- Firebase Web Setup Guide
- M1 Auditor 2 Remediation
- Dead-Letter Queue Sync
- Remote Config Deploy Script
- Static File Server Script
- Firestore Security Rules Guides
- Remote Config Platform Setup
- Survey Explorer Test Readiness
- M1 Forensic Integrity Audit
- M2 Spec Miner & Worker
- Firestore Auth Rule Variables
- Data Connect Transaction Directives
- m2-adversarial-challenger.test.js
- Auth Domain Unit Tests
- Android Studio Refresh Guide
- Android Studio Setup Guide
- Antigravity MCP Setup
- Claude Code Firebase Plugin
- Gemini CLI Firebase Extension
- Firestore SDK Usage Guides
- Firebase Hosting Basics
- Chief Nurse Workflows List
- Antigravity Refresh Guide
- Claude Code Refresh Guide
- Gemini CLI Refresh Guide
- Other Agents Refresh Guide
- Cursor MCP Setup
- GitHub Copilot MCP Setup
- Other Agents MCP Setup
- Data Connect Connector Config
- Data Connect Full-Text Search
- Data Connect Flutter Caching
- Data Connect iOS Subscriptions
- Data Connect Web Caching
- Xcode SPM Package Manifest
- Weekly Supply Chain Audit
- SQL Connect VS Code Ext
- Data Connect Filter Operators
- Data Connect Realtime Refresh
- Data Connect Type Mapping
- Data Connect Enumerations
- Admin Node SDK Regen Rule
- Data Connect Android Caching
- Data Connect Android Enum Handling
- Data Connect Android Realtime Rule
- Data Connect Android SDK Regen
- Data Connect Flutter SDK Regen
- Data Connect iOS Caching
- Data Connect iOS Enum Handling
- Data Connect iOS SDK Regen
- Data Connect Web Enum Handling
- Data Connect Web SDK Regen
- Data Connect String Filters
- Firestore iOS SDK Rule
- Firestore Android SDK Usage
- Firestore Flutter Setup
- Firestore Edition Detection
- Firestore Standard Edition Guides
- M1 Spec Miner Progress
- M1 Worker 1 Progress
- M2 Auditor 1 Dispatch

## God Nodes (most connected - your core abstractions)
1. `FirestoreRulesEngine` - 27 edges
2. `FirestoreRulesEngine` - 25 edges
3. `FirestoreRulesEngine` - 25 edges
4. `FirestoreRulesEngine` - 24 edges
5. `ORIGINAL_REQUEST.md` - 17 edges
6. `setupEventListeners()` - 16 edges
7. `renderActivePatientList()` - 16 edges
8. `Worker 1 Briefing (M3 E2E Implementation)` - 16 edges
9. `Reviewer 1 Independent Review Report` - 16 edges
10. `M4 Worker 2 Handoff Report` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Correction: ui-components.js Not Dead (Test-Covered)` --semantically_similar_to--> `Correction of Prior False SOP Claims`  [INFERRED] [semantically similar]
  DESIGN_AUDIT_2026.md → CLINICAL_SOP.md
- `Reviewer 2 Independent Review Report` --references--> `captureActiveFieldState()`  [EXTRACTED]
  .agents/teamwork_preview_m2_reviewer_2/handoff.md → public/js/app.js
- `Explorer 1 Offline Chaos Test Design Report` --references--> `diffPatientFields()`  [EXTRACTED]
  .agents/teamwork_preview_m2_explorer_1/handoff.md → public/js/app.js
- `Reviewer 2 Independent Review Report` --references--> `diffPatientFields()`  [EXTRACTED]
  .agents/teamwork_preview_m2_reviewer_2/handoff.md → public/js/app.js
- `Explorer 2 Edge AI & Attestation Test Design Report` --references--> `EdgeAIClinicalEngine`  [EXTRACTED]
  .agents/teamwork_preview_m2_explorer_2/handoff.md → public/js/edge-ai-service.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Firebase Hosting Preview to Merge to Drift-Check Lifecycle** — github_workflows_firebase_hosting_pull_request_workflow, github_workflows_firebase_hosting_merge_workflow, github_workflows_firebase_drift_check_workflow [EXTRACTED 0.90]
- **Edge AI Sandbox & Attestation Test Design Workflow** — agents_teamwork_preview_m2_explorer_2_handoff, tests_unit_edge_ai_sandbox_test, tests_integration_discharge_attestation_test [EXTRACTED 0.95]
- **Offline Chaos & DLQ Test Architecture Workflow** — agents_teamwork_preview_m2_explorer_1_handoff, tests_integration_offlinechaos_test, public_js_telemetry_rum_deadletterqueue [EXTRACTED 0.95]
- **Milestone 4 Verification & Audit Chain** — agents_teamwork_preview_orchestrator_gen4_orchestrator, agents_teamwork_preview_worker_m4_1_worker, agents_teamwork_preview_victory_auditor_auditor, final_verification_report_doc [EXTRACTED 0.95]
- **Explorer M3.1 Investigation & Handoff Workflow** — agents_teamwork_preview_explorer_m3_1_briefing_doc, agents_teamwork_preview_explorer_m3_1_dispatch_doc, agents_teamwork_preview_explorer_m3_1_analysis_doc, agents_teamwork_preview_explorer_m3_1_handoff_doc [EXTRACTED 1.00]
- **2026 Modernization Pipeline: Global Engineering Standards Applied Across Three Apps** — agents_rules_global_er_app_final, agents_rules_global_hospital_emr, agents_rules_global_imc_er_console, agents_rules_global_accessibility_wcag22, agents_rules_global_nanostores_enforcement, agents_rules_global_cicd_pipeline_security, agents_rules_global_ml_kem_cryptography, agents_rules_global_offline_first_pwa [EXTRACTED 1.00]
- **Three independent reviewers verify Worker 1's Milestone 1 deliverables** — agents_teamwork_preview_m1_reviewer_1_handoff, agents_teamwork_preview_m1_reviewer_2_handoff, agents_teamwork_preview_m1_worker_1_handoff [EXTRACTED 1.00]
- **Milestone 1 spec-mining and design feed into worker implementation** — agents_teamwork_preview_m1_explorer_2_handoff, agents_teamwork_preview_m1_spec_miner_3_handoff, agents_teamwork_preview_m1_worker_1_handoff [EXTRACTED 1.00]
- **Milestone 1 Iteration 2: DOM and Listener Remediation Workflow** — agents_teamwork_preview_m1_worker_2_handoff, concept_users_unsubscribe_cleanup, concept_patients_unsubscribe_cleanup, public_js_app [EXTRACTED 1.00]
- **Milestone 3 Playwright Track Deliverables Bundle** — tests_e2e_helpers_mockfirebase_interceptor, tests_e2e_chiefnurseworkflow_spec_suite, tests_e2e_leadershipworkflow_spec_suite, tests_e2e_ownerworkflow_spec_suite, tests_e2e_accessgatesecurity_spec_suite, tests_e2e_concurrencyandviewports_spec_suite [EXTRACTED 1.00]
- **Milestone 3 Playwright Track: Implementation + Multi-Agent Review Cycle** — agents_teamwork_preview_m3_worker_1_briefing_doc, agents_teamwork_preview_m3_reviewer_1_handoff_doc, agents_teamwork_preview_m3_reviewer_2_briefing_doc, agents_teamwork_preview_m3_challenger_2_briefing_doc [EXTRACTED 1.00]
- **M2 Iteration 2: Remediate, Rebuild, and Independently Review Sandbox Fix** — agents_teamwork_preview_m2_worker_2_handoff, agents_teamwork_preview_m2_reviewer_3_handoff, concept_networkisolationgatekeeper [EXTRACTED 1.00]
- **M2 Spec-to-Implementation: PQ Crypto Test Suite Handoff** — agents_teamwork_preview_m2_spec_miner_3_handoff, agents_teamwork_preview_m2_worker_1_handoff, concept_clinicalcryptoengine [EXTRACTED 1.00]
- **Mandatory npx firebase-tools@latest CLI Convention Across Firebase Skills** — agents_skills_firebase_basics_skill_doc, agents_skills_firebase_ai_logic_basics_skill_doc, agents_skills_firebase_app_hosting_basics_skill_doc, agents_skills_firebase_auth_basics_skill_doc [EXTRACTED 1.00]
- **Orchestrator Generational Succession Chain** — agents_teamwork_preview_orchestrator_handoff, agents_teamwork_preview_orchestrator_gen2_briefing, agents_teamwork_preview_orchestrator_gen3_briefing [EXTRACTED 1.00]
- **Firestore Provisioning Workflow (rules + indexes + config)** — agents_skills_firebase_firestore_references_standard_provisioning_guide, agents_skills_firebase_firestore_references_standard_security_rules_generator, agents_skills_firebase_firestore_references_standard_indexes_guide [EXTRACTED 1.00]
- **Sandbox Escape Discovery-Remediation-Verification Cycle** — agents_teamwork_preview_m2_challenger_2_handoff, concept_challenger2_sandbox_escape_vulnerability, concept_url_parsing_remediation, agents_teamwork_preview_m2_challenger_2_retest_briefing [EXTRACTED 1.00]
- **Spec Mining to Final Report Authorship Pipeline** — agents_teamwork_preview_spec_miner_survey_3_specminer, imc_er_feature_inventory_matrix, agents_teamwork_preview_worker_m4_1_worker [INFERRED 0.70]
- **Client-Side Caching Configuration Across SDKs** — agents_skills_firebase_data_connect_reference_sdk_android_client_caching, agents_skills_firebase_data_connect_reference_sdk_flutter_client_caching, agents_skills_firebase_data_connect_reference_sdk_ios_client_caching, agents_skills_firebase_data_connect_reference_sdk_web_client_caching [INFERRED 0.75]
- **Documentation Self-Correction of False Prior Claims** — clinical_sop_prior_doc_corrections, deployment_manifest_history_correction, design_audit_2026_ui_components_correction [INFERRED 0.75]
- **Platform-Specific Firestore Client SDK Setup Guides** — agents_skills_firebase_firestore_references_standard_ios_setup_guide, agents_skills_firebase_firestore_references_standard_android_sdk_usage_guide, agents_skills_firebase_firestore_references_standard_flutter_setup_guide [INFERRED 0.75]
- **M1 Dual-Layer RBAC Verification via Client & Server Test Design** — role_simulation_test_plan, rbac_security_test_architecture_plan, milestone_1_security_rbac_boundary_verification [INFERRED 0.80]
- **Milestone 3 Comprehensive E2E Track: Explore -> Spec Mine -> Test Write Pipeline** — agents_teamwork_preview_m3_explorer_1_briefing_doc, agents_teamwork_preview_m3_spec_miner_2_handoff_doc, agents_teamwork_preview_m3_test_writer_3_briefing_doc [INFERRED 0.80]
- **Codebase & RBAC Survey Team** — agents_teamwork_preview_explorer_survey_1_briefing_survey_explorer1_role, agents_teamwork_preview_explorer_survey_2_briefing_survey_explorer2_role, agents_teamwork_preview_explorer_survey_1_briefing_codebase_survey_milestone [INFERRED 0.85]
- **Firebase AI Logic Cross-Platform Initialization Pattern** — agents_skills_firebase_ai_logic_basics_references_flutter_setup_init_pattern, agents_skills_firebase_ai_logic_basics_references_ios_setup_init_pattern, agents_skills_firebase_ai_logic_basics_references_usage_patterns_android_init_pattern, agents_skills_firebase_ai_logic_basics_references_usage_patterns_web_init_pattern [INFERRED 0.85]
- **Milestone 1 test artifact triad validating RBAC across rules, DOM, and lifecycle** — tests_unit_rbac_security_test_suite, tests_unit_rolesimulation_test_suite, tests_unit_rolesimulationstress_test_suite [INFERRED 0.85]
- **M1 Client-Lifecycle Bug Discovery -> Remediation -> Verification Cycle** — agents_teamwork_preview_m1_challenger_2_handoff_handoff, remediation_users_dom_and_subscription_cleanup, agents_teamwork_preview_m1_challenger_3_handoff_handoff [INFERRED 0.85]
- **M1 Iteration 2 Parallel Forensic + Empirical Cross-Validation** — agents_teamwork_preview_m1_auditor_2_handoff_handoff, agents_teamwork_preview_m1_challenger_3_handoff_handoff, milestone_1_iteration_2_security_rbac_remediation [INFERRED 0.85]
- **Milestone 2 Forensic Audit Consensus on Edge AI Sandbox** — agents_teamwork_preview_m2_auditor_1_handoff, agents_teamwork_preview_m2_auditor_2_handoff, public_js_edge_ai_service, concept_network_isolation_gatekeeper [INFERRED 0.85]
- **Milestone 2 Explore-Review-Challenge Verification Pipeline** — agents_teamwork_preview_m2_explorer_1_agent, agents_teamwork_preview_m2_explorer_2_agent, agents_teamwork_preview_m2_reviewer_1_agent, agents_teamwork_preview_m2_reviewer_2_agent, agents_teamwork_preview_m2_challenger_3_agent, agents_teamwork_preview_m2_challenger_2_retest_agent [INFERRED 0.85]
- **Milestone 3 E2E Verification Gate Flow** — agents_teamwork_preview_m3_worker_1_handoff, agents_teamwork_preview_orchestrator_gen3_gate_status, agents_teamwork_preview_orchestrator_briefing_milestone3, agents_teamwork_preview_m3_worker_1_dispatch [INFERRED 0.85]
- **Milestone 1 Forensic Audit Workflow** — agents_teamwork_preview_m1_auditor_1_briefing_milestone1_rbac_verification, agents_teamwork_preview_m1_auditor_1_briefing_forensic_auditor_role, agents_teamwork_preview_m1_auditor_1_handoff_mutation_testing_verification, agents_teamwork_preview_m1_auditor_1_handoff_clean_verdict [INFERRED 0.85]
- **Milestone 3 Explorer Team Investigation** — agents_teamwork_preview_explorer_m3_1_progress_explorer1_role, agents_teamwork_preview_explorer_m3_2_briefing_explorer2_role, agents_teamwork_preview_explorer_m3_3_briefing_explorer3_role, agents_teamwork_preview_explorer_m3_2_briefing_milestone3_e2e_expansion [INFERRED 0.85]
- **M3 Dual-Track Verification: Forensic Audit + Adversarial Challenge** — agents_teamwork_preview_m3_auditor_1_handoff, agents_teamwork_preview_m3_challenger_1_briefing, concept_rbac_sop_alignment [INFERRED 0.85]
- **Native Agent Package/Extension Manager Pattern (Claude Code & Gemini CLI)** — agents_skills_firebase_basics_references_refresh_claude_plugin_update_cmd, agents_skills_firebase_basics_references_refresh_gemini_cli_extensions_update_cmd, agents_skills_firebase_basics_references_setup_claude_code_marketplace_plugin, agents_skills_firebase_basics_references_setup_gemini_cli_extension_install [INFERRED 0.85]
- **npx skills CLI Refresh/Update Pattern Across Agents** — agents_skills_firebase_basics_references_refresh_android_studio_npx_skills_cmd, agents_skills_firebase_basics_references_refresh_antigravity_npx_skills_cmd, agents_skills_firebase_basics_references_refresh_other_agents_npx_skills_cmd [INFERRED 0.85]
- **RBAC Role Model Consistency Across Docs** — clinical_sop_purge_protocol, deployment_manifest_role_definitions, final_verification_report_rbac_matrix, sync_document [INFERRED 0.85]
- **Resilient Enum Handling Across Client SDKs** — agents_skills_firebase_data_connect_reference_sdk_android_enum_handling, agents_skills_firebase_data_connect_reference_sdk_flutter_enum_handling, agents_skills_firebase_data_connect_reference_sdk_ios_enum_handling, agents_skills_firebase_data_connect_reference_sdk_web_enum_handling [INFERRED 0.85]
- **SDK Regeneration Required After Operation Changes** — agents_skills_firebase_data_connect_reference_sdk_admin_node_operation_storage_rule, agents_skills_firebase_data_connect_reference_sdk_android_operation_storage_rule, agents_skills_firebase_data_connect_reference_sdk_flutter_operation_storage_rule, agents_skills_firebase_data_connect_reference_sdk_ios_operation_storage_rule, agents_skills_firebase_data_connect_reference_sdk_web_operation_storage_rule [INFERRED 0.85]
- **Standard Firebase MCP Server JSON Configuration Pattern** — agents_skills_firebase_basics_references_setup_antigravity_mcp_config_json, agents_skills_firebase_basics_references_setup_cursor_mcp_json, agents_skills_firebase_basics_references_setup_github_copilot_mcp_json, agents_skills_firebase_basics_references_setup_other_agents_mcp_config [INFERRED 0.90]
- **Build and Deploy Pipeline Verification Chain** — deployment_manifest_build_process, sync_public_dist_trees, run_log_build_and_deploy_job [INFERRED 0.95]
- **Milestone 4 Final Verification Report Authoring (Duplicate Worker Dispatch)** — agents_teamwork_preview_m4_worker_1_dispatch, agents_teamwork_preview_m4_worker_2_dispatch, agents_teamwork_preview_m4_worker_2_handoff [INFERRED 0.95]

## Communities (127 total, 46 thin omitted)

### Community 0 - "Orchestrator Handoffs & Gates"
Cohesion: 0.06
Nodes (60): M1 Auditor Handoff Report, M2 Auditor Handoff Report, M3 Auditor Handoff Report, Gen3 Orchestrator Handoff Report, Orchestrator Gen3 Agent Role, Gen3 Orchestrator Progress Log, Gen4 Orchestrator Briefing, Gen4 Orchestrator Dispatch (+52 more)

### Community 1 - "M3 Challenger/Explorer/Reviewer Team"
Cohesion: 0.07
Nodes (48): Challenger 1 Progress Log (M3), Challenger 2 Briefing (M3), Challenger 2 Dispatch (M3), Challenger 2 Progress Log (M3), Explorer 1 Briefing (M3), Explorer 1 Dispatch (M3), Explorer 1 Progress Heartbeat (M3), Reviewer 1 Briefing (M3) (+40 more)

### Community 2 - "firebase-service.js"
Cohesion: 0.05
Nodes (32): createActionButton(), createMiniButton(), createPatientCardShell(), createSkeletonLoader(), createStatusBadge(), createTriageBadge(), PENDING_ACTIONS, ROOMS (+24 more)

### Community 3 - "iOS/Firebase Init Patterns"
Cohesion: 0.07
Nodes (36): AppDelegate Safe Init Pattern (UIKit, Traditional), Firebase CLI Project/App Creation (projects:create, apps:create IOS, apps:sdkconfig), Combine (ObservableObject / @Published / @StateObject), FirebaseApp.configure(), GoogleService-Info.plist, Firebase iOS Setup Guide, FirebaseApp.configure() Must Run Before Firebase-Dependent State Object Init (Property Initializers Run Before App.init()), Swift Observation Framework (@Observable / @State) (+28 more)

### Community 4 - "Original User Request: IMC ER Multi-Role Testing & RBAC Verification"
Cohesion: 0.06
Nodes (35): Chief Nurse Role Workflow, Dead-Letter Queue (Failed Sync Routing), Original User Request: IMC ER Multi-Role Testing & RBAC Verification, Edge AI Discharge Summary Synthesis & Attestation, IMC ER Application, Leadership Tier Roles (medical_director, emergency_manager, emergency_deputy_manager), Adversarial, Offline Chaos & Concurrent Stress Testing, Owner Role (Account & System Administration) (+27 more)

### Community 5 - "Data Connect Cloud Functions"
Cohesion: 0.07
Nodes (31): Auth Context Mappings (authType/authId), Event Filtering (service/operation/connector), Event Payload Structure, Infinite Loop Constraint (No Before-Snapshot), onMutationExecuted Cloud Function Trigger, Cloud Function Region Matching Rule, dataconnect.yaml Configuration, Admin SDK Bulk Operations (+23 more)

### Community 6 - "NPM Package Dependencies"
Cohesion: 0.06
Nodes (30): firebase-admin, jsdom, devDependencies, firebase-admin, jsdom, @playwright/test, @testing-library/dom, @testing-library/user-event (+22 more)

### Community 7 - "Empirical Stress Test Harness"
Cohesion: 0.13
Nodes (6): __dirname, failures, __filename, FirestoreRulesEngine, ROOT, rulesContent

### Community 8 - "Data Connect Schema Examples"
Cohesion: 0.09
Nodes (30): firebase.json, .firebaserc, Firebase Service Initialization Guide, npx firebase-tools init Command, Role-Checked Mutations (CreatePost, PublishPost, GrantRole via @check on BlogPermission.role), Blog Schema with Roles (User, BlogPermission, UserRole, Post, Comment), Checkout Mutation (@transaction, @redact, @check Cart Not Empty), E-Commerce Schema (User, Product, CartItem, Order, OrderItem, OrderStatus) (+22 more)

### Community 9 - "Data Connect Deployment & SDKs"
Cohesion: 0.07
Nodes (30): Deployment Workflow & Schema Migrations, SQL Connect Emulator, Firebase CLI Commands, Resilient Enum Handling (Flutter), Firebase Init Commands, SDK Initialization (Web), Full-Text Search Pipeline (.search()), Mandatory Pipeline Architecture (Zero Tolerance) (+22 more)

### Community 10 - "test-app.cjs"
Cohesion: 0.25
Nodes (10): diag, diffPatientFields(), dom, getVal(), { JSDOM }, patientsList, radio, savePatientCardFields() (+2 more)

### Community 11 - "Legacy Archive & Migration"
Cohesion: 0.13
Nodes (22): Build Process (build-prod.js, dist/ parity), CI Workflows (hosting/config deploy/drift check), IMC ER Deployment & Architecture Manifest, imc-er-manager Firebase Project Binding, Firebase Hosting/Firestore Rules/Remote Config Surfaces, Known Inconsistencies (trafficSplit, unwired tests, unaudited crypto), OAUTH_REGISTERED_HOSTS / Auth Handler Origin, PWA Service Worker (sw.js) (+14 more)

### Community 14 - "app.js"
Cohesion: 0.05
Nodes (73): M1 Worker 2 Handoff Report, M1 Worker 2 Progress Log, M2 Challenger 1 Adversarial Verification Report, M2 Challenger 1 Progress Log, Reviewer 1 Briefing, Reviewer 1 Independent Review Report, Reviewer 1 Progress Log, M2 Challenger 1 Verdict: APPROVE (Concurrency/Keystroke/Collision) (+65 more)

### Community 16 - "RBAC Test Config & Roles"
Cohesion: 0.13
Nodes (19): ALL_ROLES, createEngine(), PERSONAS, ROOT, ASSIGNABLE_ROLES, CLINICAL_ROLES, FIREBASE_CONFIG, LEADERSHIP_ROLES (+11 more)

### Community 17 - "UX/UI Guidelines for Clinical Management Applications"
Cohesion: 0.50
Nodes (3): I. The Core UX Laws:, II. The 20 Execution Rules:, UX/UI Guidelines for Clinical Management Applications

### Community 18 - "M1 Reviewer Team Cycle"
Cohesion: 0.12
Nodes (21): Reviewer 1 Briefing, Reviewer 1 Dispatch, Reviewer 1 Progress, Reviewer 2 Briefing, Reviewer 2 Dispatch, Reviewer 2 Handoff: Role Simulation & Adversarial Review, Reviewer 2 Progress, Reviewer 3 Briefing (+13 more)

### Community 19 - "edge-ai-service.js"
Cohesion: 0.15
Nodes (13): M2 Auditor 1 Briefing, M2 Auditor 1 Dispatch, M2 Auditor 1 Forensic Audit Report, M2 Auditor 1 Progress Log, Reviewer 1 Dispatch, diffPatientFields Delta Diffing Algorithm, EdgeAIClinicalEngine Subsystem (ESI Triage & Discharge Synthesis), Active Field Caret/Keystroke Preservation (captureActiveFieldState/restoreActiveFieldState) (+5 more)

### Community 20 - "Explorer 2 Edge AI & Attestation Test Design Report"
Cohesion: 0.16
Nodes (15): Challenger 2 Retest Agent (Empirical Challenger), Challenger 2 Retest Handoff Report, Challenger 2 Retest Progress Log, Challenger 3 Agent (Empirical Challenger/Critic/Specialist), Challenger 3 Briefing, Challenger 3 Verdict Report, Challenger 3 Progress Log, Explorer 2 Agent (Investigation/Synthesis) (+7 more)

### Community 21 - "Nanostores State Store"
Cohesion: 0.12
Nodes (12): activeDepartment, activePatientsStore, activeSentinelAlert, activeTriageFilter, Atom, computed(), isAudioMuted, map() (+4 more)

### Community 22 - "M1 Explorer/Reviewer Handoffs"
Cohesion: 0.17
Nodes (19): Explorer 2 Handoff: RBAC Security Test Suite Architecture, Explorer 2 Progress Heartbeat, Reviewer 1 Handoff: Milestone 1 Review Report, Spec Miner 3 Briefing, Spec Miner 3 Handoff: RBAC Boundary Specification Mining Report, Worker 1 Dispatch, FirestoreRulesEngine (in-memory rule simulation engine), MANAGER_TIER_ROLES (owner + leadership, excludes chief_nurse) (+11 more)

### Community 23 - "M4 Worker & Gate Status"
Cohesion: 0.24
Nodes (7): M4 Worker 1 Briefing, M4 Worker 2 Briefing, M4 Worker 2 Handoff Report, M4 Worker 2 Progress Log, Orchestrator Gen3 Gate Status (Milestone 3), FINAL_VERIFICATION_REPORT.md, installFirebaseMocks()

### Community 24 - "Auth Domain Preflight Checks"
Cohesion: 0.26
Nodes (16): OAUTH_REGISTERED_HOSTS, PRODUCTION_HOST, resolveAuthDomain(), checkAuthorizedDomains(), checkEmailPasswordEnabled(), checkHostingSchema(), checkOAuthHandler(), checkProductionResolves() (+8 more)

### Community 25 - "M2 Worker 2 Handoff Report (Remediation)"
Cohesion: 0.16
Nodes (14): M2 Auditor 2 Briefing, M2 Auditor 2 Dispatch, Challenger 3 Dispatch, Reviewer 3 Briefing (M2 Iteration 2 Remediation Review), Reviewer 3 Dispatch (M2 Iteration 2 Remediation Review), Reviewer 3 Handoff Report (APPROVE Verdict), Reviewer 3 Progress Tracker, Worker 2 Briefing (M2 Sandbox Escape Remediation) (+6 more)

### Community 26 - "M2 Worker 1 Handoff Report"
Cohesion: 0.13
Nodes (17): M2 Challenger 2 Briefing, M2 Challenger 2 Dispatch, Spec Miner 3 Handoff: Test Suite Designs for Concurrency, Focus Preservation & PQ Crypto, Spec Miner 3 Progress Log, M2 Worker 1 Handoff Report, Worker 1 Progress Heartbeat, Challenger 1 Briefing (M3 Adversarial Stress Test), Challenger 1 Dispatch (M3 Adversarial Stress Test) (+9 more)

### Community 27 - "Admin Role Assignment Script"
Cohesion: 0.12
Nodes (13): appConfig, ASSIGNABLE_ROLES, auth, CLINICAL_ROLES, db, __dirname, LEADERSHIP_ROLES, LEGACY_ROLES (+5 more)

### Community 28 - "Data Connect Native SQL"
Cohesion: 0.12
Nodes (16): Raw SQL Schema Modification Constraint, PostgreSQL Extensions via Native SQL, Native SQL Root Fields (_select/_execute/etc.), Native SQL Syntax Isolation Rule, Auto-Generated CRUD Fields, Key Scalars, @col Directive, @default Directive (+8 more)

### Community 29 - "M2 Challenger 2 Adversarial Penetration Report"
Cohesion: 0.17
Nodes (14): M2 Auditor 2 Forensic Audit Report (Iteration 2), M2 Auditor 2 Progress Log, M2 Challenger 2 Adversarial Penetration Report, M2 Challenger 2 Progress Log, M2 Challenger 2 Retest Briefing, Orchestrator Gen3 Dispatch Log, M2 Challenger 2 Retest: Sandbox Perimeter Re-verification, NetworkIsolationGatekeeper Sandbox Escape Vulnerability (+6 more)

### Community 30 - "Clinical SOP & RBAC Roles"
Cohesion: 0.22
Nodes (14): Single-Project Data Boundary, IMC Unified Emergency Command Center SOP, Correction of Prior False SOP Claims, Patient Data Purging Protocol, Role: Chief Nurse, Role: Leadership Tier (Medical Director/Emergency Manager/Deputy), Roles: Pending / Blocked, Multi-Role Clinical & Administrative Simulation (+6 more)

### Community 31 - "i18n & Manager Role Checks"
Cohesion: 0.27
Nodes (8): currentLang, ROLE_LABEL_KEYS, setLanguage(), tr(), translateDischargeOutcome(), translatePendingAction(), translateRole(), TRANSLATIONS

### Community 32 - "Role Simulation Stress Test"
Cohesion: 0.15
Nodes (15): authMocks, batchOperations, emitPatients(), emitRemoteConfig(), emitUsers(), firestoreMocks, indexHtml, patientsUnsubSpy (+7 more)

### Community 33 - "Accessibility & Contrast Fixes"
Cohesion: 0.09
Nodes (26): CTA Button Contrast Fix, lang/dir Attribute Sync Fix, Authenticated-App Review Gap, Length-of-Stay Escalation Ramp, --on-los-hi Contrast Token, IMC ER Accessibility & UI Audit, Role Badge Contrast Fix, Search Results Live-Region Announcer (+18 more)

### Community 34 - "AI Logic Flutter/Web Chat"
Cohesion: 0.15
Nodes (15): Flutter Chat Session (startChat multi-turn), Flutter Setup for Firebase AI Logic, Flutter AI Logic Init Pattern (firebase_ai, FirebaseAI.googleAI), Firebase AI Logic Web SDK Usage Patterns, Web AI Logic Init Pattern (getAI, GoogleAIBackend), Nano Banana Image Generation (ResponseModality.IMAGE), Mandatory Backend Provisioning via `npx firebase-tools init ailogic`, App Check (Critical Safety Requirement for AI Logic) (+7 more)

### Community 35 - "M1 Challenger 2/3 Remediation"
Cohesion: 0.17
Nodes (15): Challenger 2 Briefing (Client-Side Role Simulation Stress Test), Challenger 2 Dispatch Message, Challenger 2 Handoff Report (Verdict: CHALLENGE_FAILED), Challenger 2 Progress Log, Challenger 3 Briefing (Remediation Verification Stress Test), Challenger 3 Dispatch Message, Challenger 3 Handoff Report (Verdict: APPROVE, remediation verified), Challenger 3 Progress Log (+7 more)

### Community 36 - "Reviewer 2 Independent Review Report"
Cohesion: 0.15
Nodes (15): Explorer 1 Agent (Investigation/Synthesis), Explorer 1 Briefing, Explorer 1 Dispatch, Explorer 1 Offline Chaos Test Design Report, Explorer 1 Progress Log, Reviewer 2 Briefing, Reviewer 2 Dispatch, Reviewer 2 Independent Review Report (+7 more)

### Community 37 - "App Hosting CLI Config"
Cohesion: 0.25
Nodes (9): App Hosting Configuration (apphosting.yaml), runConfig (cpu, memoryMiB, minInstances, maxInstances, concurrency), App Hosting Emulation, apphosting.emulator.yaml (Local Override Config), Firebase App Hosting (SSR/ISR full-stack deployment), Blaze Pay-As-You-Go Plan Requirement for App Hosting, App Hosting Basics, Firebase Hosting vs App Hosting Decision Criteria (+1 more)

### Community 38 - "Firebase Auth Basics Skill"
Cohesion: 0.19
Nodes (13): Firebase Authentication on Android (Kotlin), Email/Password Sign-Up & Sign-In (createUserWithEmailAndPassword, signInWithEmailAndPassword), Firebase Authentication Web SDK, Email Link Authentication (Passwordless), signInWithPopup Multi-Provider Flow (Google, Facebook, Apple, Twitter, GitHub, Microsoft, Yahoo), Firebase Auth & Google Sign-In for Flutter, Prototyping Workaround: Client-Side Sort to Avoid Firestore Composite Index, google_sign_in 7.2.0 Breaking API Changes (signIn() renamed to authenticate(), token separation) (+5 more)

### Community 39 - "M3 Access Gate Spec Design"
Cohesion: 0.22
Nodes (14): accessGateSecurity.spec.js Test Suite Design, AI Discharge Summary Mandatory Attestation Gating - prevents automated PHI sign-off without clinician verification, leadershipWorkflow.spec.js Test Suite Design, ownerWorkflow.spec.js Test Suite Design, Remote Config Kill-Switch (enable_batch_purge / enable_edge_ai_synthesis) - lets Owner disable risky actions live, Frontend Structure & Role Gating Analysis (Explorer 2), Explorer 2 Briefing (Milestone 3), Explorer 2 (Milestone 3 Frontend/Role-Gating Investigator) (+6 more)

### Community 40 - "RBAC Permission Matrix Survey"
Cohesion: 0.16
Nodes (14): Security & RBAC Boundary Matrix (Milestone 3), Survey Explorer 2 Dispatch, Firestore Security Rules Enforcement Model, NetworkIsolationGatekeeper (Edge AI PHI Sandbox), Complete RBAC Permission Matrix (7 Roles), RBAC, Security Rules & Permissions Survey Report, Role: blocked (access revoked, zero PHI), Role: chief_nurse (clinical tier, no purge/delete rights) (+6 more)

### Community 41 - "M1 Explorer/Auditor Handoffs"
Cohesion: 0.18
Nodes (14): Auditor 1 Progress Log (M1 Iteration 1 Forensic Audit), Explorer 1 Briefing (Multi-Role Simulation Suite Design), Explorer 1 Dispatch Message, Explorer 1 Handoff: Multi-Role Client Simulation Test Plan, Explorer 1 Progress Log, Explorer 2 Briefing (RBAC Security Rule Test Architecture Design), Explorer 2 Dispatch Message, firestore.rules (Firestore Security Rules) (+6 more)

### Community 42 - "ORIGINAL_REQUEST.md"
Cohesion: 0.18
Nodes (22): ORIGINAL_REQUEST.md, M1 Challenger 2 Handoff Report, M1 Worker 2 Briefing, M1 Worker 2 Dispatch, Worker 2 Dispatch (M2 Sandbox Escape Remediation), Orchestrator Gen1 Briefing, Milestone 1: Security & RBAC Boundary Verification & Multi-Role Simulation, Milestone 2: Adversarial Chaos, Offline Queue Sync & Edge AI Sandbox Isolation (+14 more)

### Community 43 - "IMC ER Feature Inventory"
Cohesion: 0.21
Nodes (15): Decluttering: .stat-tile/.admissions-breakdown Consolidation, Modal Dialog Keyboard/Screen-Reader Accessibility, Role: Owner, stitch-* to dashboard-* Rename, Code Layout, PROJECT.md — IMC ER Verification/Testing/Remediation, Feature Inventory (25 Features), Milestones M1-M5 (+7 more)

### Community 44 - "Flutter Firebase Setup Guide"
Cohesion: 0.18
Nodes (13): cloud_firestore Package, Firebase CLI (firebase-tools), firebase_core Package, lib/firebase_options.dart, Flutter SDK, FlutterFire CLI, flutterfire configure Command, Flutter & Firebase Setup Guide (+5 more)

### Community 45 - "Edge AI Discharge Sign-Off"
Cohesion: 0.19
Nodes (14): Mandatory Clinical Sign-Off Protocol, Edge AI Discharge Summary Synthesis, NetworkIsolationGatekeeper (Zero-PHI Sandbox), Edge AI Network Isolation, Correction of Prior Multi-App-Suite Framing, Correction: ui-components.js Not Dead (Test-Covered), Detailed Bug Remediation Log (BUG-001..006), DOM Caret & Focus Preservation (+6 more)

### Community 46 - "m2-adversarial-challenge.test.js"
Cohesion: 0.25
Nodes (6): indexHtml, mockDLQAdds, mockFirestoreBatches, mockFirestoreUpdates, mockTelemetryAdds, ROOT

### Community 47 - "Role Simulation Test Suite"
Cohesion: 0.19
Nodes (12): authMocks, batchOperations, emitPatients(), emitRemoteConfig(), emitUsers(), firestoreMocks, indexHtml, ROOT (+4 more)

### Community 48 - "Chief Nurse Workflow Analysis"
Cohesion: 0.42
Nodes (12): calculateAgeAndGender (Egyptian NID Parser), Chief Nurse RBAC Boundary, chiefNurseWorkflow.spec.js (Proposed Playwright Suite), Mandatory Clinical Attestation Gating, diffPatientFields (Concurrency-Safe Field Diffing), Chief Nurse Clinical Workflow Analysis, EdgeAIClinicalEngine, NetworkIsolationGatekeeper (+4 more)

### Community 50 - "M2 Challenger 2 Retest Dispatch"
Cohesion: 0.32
Nodes (8): M2 Challenger 1 Briefing, M2 Challenger 1 Dispatch, M2 Challenger 2 Retest Dispatch, Explorer 2 Dispatch, CLINICAL_SOP.md, PROJECT.md, Clinical Attestation Gating (saveAISummaryInModal / btn-submit-discharge), TEST_INFRA.md

### Community 51 - "Xcode SPM Setup Script"
Cohesion: 0.33
Nodes (10): addCrashlyticsRunScriptBuildPhase(), hasCrashlyticsRunScriptBuildPhase(), isUserScriptSandboxingEnabled(), main(), setDwarfWithDsymDebugInformationFormat(), Bool, Foundation, PathKit (+2 more)

### Community 52 - "M4 Worker 1 Dispatch Instructions"
Cohesion: 0.14
Nodes (16): Auditor 1 Briefing (M3 Forensic Integrity Audit), Auditor 1 Dispatch (M3 Forensic Integrity Audit), Auditor 1 Handoff: Forensic Audit Report (Verdict CLEAN), Auditor 1 Progress Log, M4 Worker 1 Dispatch Instructions, Blocked Persona (revoked access), Chief Nurse Role (chief_nurse), Emergency Deputy Manager Role (emergency_deputy_manager) (+8 more)

### Community 54 - "M3 E2E Mock Firebase Layer"
Cohesion: 0.24
Nodes (10): BypassSandbox Requirement for Local Python Server & Port 3000 - sandboxed runners cannot bind sockets or spawn child servers without it, Concurrent Editing & Caret Preservation Mechanics, tests/e2e/helpers/mockFirebase.js ESM Mock Layer, Playwright Test Environment & Runtime Mechanics Analysis (Explorer 3), Tier 1-4 E2E Test Suite Expansion Plan - mock ESM routing chosen over live Firebase to avoid latency/flakiness, Multi-Viewport Test Matrix (Desktop/Tablet/Mobile), Explorer 3 Dispatch (Milestone 3), Explorer 3 Handoff Report (Milestone 3) (+2 more)

### Community 55 - "AI Logic iOS/Android Setup"
Cohesion: 0.22
Nodes (9): Firebase AI Logic iOS Setup Guide, Function Calling (Tools) via Multi-Turn Chat Session, iOS AI Logic Init Pattern (FirebaseAI.firebaseAI()), Critical Warning: No Inline Model Init Before FirebaseApp.configure() (SwiftUI @Observable pattern), Firebase AI Logic on Android (Kotlin), Android AI Logic Init Pattern (Firebase.ai, firebase-bom), Multimodal Input (Bitmap Images + Text), Firebase Auth iOS Setup Guide (+1 more)

### Community 57 - "Production Build Script"
Cohesion: 0.22
Nodes (6): checkOnly, __dirname, OUT, ROOT, sources, SRC

### Community 58 - "M2 Path/Query Attack Harness"
Cohesion: 0.22
Nodes (7): __dirname, __filename, findings, pathAttacks, queryParamAttacks, ROOT, subdomainAttacks

### Community 59 - "Codebase Survey & Audit Briefings"
Cohesion: 0.32
Nodes (8): Codebase Survey & Testing Readiness Analysis (Milestone), Survey Explorer 1 Briefing, Survey Explorer 1 (Codebase & Module Mapping), Survey Explorer 2 Briefing, Survey Explorer 2 (RBAC & Security Survey), Forensic Integrity Auditor Briefing (Milestone 1), Forensic Integrity Auditor (Milestone 1), Milestone 1: Security & RBAC Boundary Verification

### Community 60 - "M1 Challenger 1 RBAC Stress"
Cohesion: 0.25
Nodes (8): Challenger 1 Briefing (RBAC Security Rules Stress Test), Challenger 1 Dispatch Message, Challenger 1 Handoff Report (Verdict: APPROVE), Challenger 1 Progress Log, Finding: dist/js/app.js Stale Relative to public/js/app.js, Milestone 1: Security & RBAC Boundary Verification, scripts/empirical-stress-harness.js, Verdict: APPROVE (RBAC Security Rules Stress Test, Challenger 1)

### Community 61 - "M3 Worker 1 Gate Mechanisms"
Cohesion: 0.32
Nodes (8): M3 Worker 1 Dispatch Instructions, M3 Worker 1 Handoff Report, Access Gate Quarantine (#access-gate), Mandatory AI Discharge Summary Attestation Gate, Field-Level Concurrency Diffing & Caret Preservation, mockFirebase.js ESM Route Interceptor, Remote Config Batch-Purge Kill-Switch, M3 Worker 1 Progress Log

### Community 63 - "M2 Concurrency Harness Script"
Cohesion: 0.39
Nodes (7): assert(), captureActiveFieldState(), diffPatientFields(), dom, failures, restoreActiveFieldState(), runEmpiricalHarness()

### Community 64 - "Firebase Android Setup Guide"
Cohesion: 0.40
Nodes (6): Firebase Android Setup Guide, Android Project Registration Flow (projects:create -> apps:create -> apps:sdkconfig), Active Project Workflow (projects:create / use <PROJECT_ID>), Automate Config File Retrieval via CLI (apps:sdkconfig) Instead of Console Download, developerknowledge_search_documents MCP Tool (Prioritized Firebase Knowledge Source), Firebase Basics Skill

### Community 65 - "Firebase Web Setup Guide"
Cohesion: 0.40
Nodes (6): Firebase CLI projects:create / apps:create web, firebaseConfig Object (apiKey, authDomain, projectId, ...), getFirestore() / collection() / getDocs() Usage, Firebase Web Setup Guide, initializeApp() / getAuth() (Modular Web SDK), npm install firebase

### Community 66 - "M1 Auditor 2 Remediation"
Cohesion: 0.33
Nodes (6): Auditor 2 Briefing (M1 Iteration 2 Forensic Audit), Auditor 2 Dispatch Message, Auditor 2 Forensic Audit Report (Verdict: CLEAN), dist/js/app.js (Production Build Output), Milestone 1 Iteration 2: Security & RBAC Boundary Remediation, Verdict: CLEAN (Forensic Integrity Audit, M1 Iteration 2)

### Community 67 - "Dead-Letter Queue Sync"
Cohesion: 0.20
Nodes (11): Migration to Dead-Letter Queue Error Handling, V1 Legacy Codebase Archive & Deprecation Manifest, Legacy Global State (window.activeDoctors), Migration to Nanostores Atomic State, Unencrypted Plaintext Clinical Notes (Deprecated), Background Synchronization Engine, Dead-Letter Queue Protocol, Offline-First Zero-Data-Loss Guarantee (+3 more)

### Community 68 - "Remote Config Deploy Script"
Cohesion: 0.33
Nodes (5): args, CONFIG_PATH, __dirname, dryRun, result

### Community 69 - "Static File Server Script"
Cohesion: 0.33
Nodes (5): __dirname, mimeTypes, port, rootDir, server

### Community 70 - "Firestore Security Rules Guides"
Cohesion: 0.50
Nodes (5): Firestore Security Rules Generator (Enterprise), Firestore Indexes Reference, Firestore Provisioning Guide, Firestore Security Rules Generator (Standard), Firebase Security Rules Auditor Skill

### Community 71 - "Remote Config Platform Setup"
Cohesion: 0.40
Nodes (5): Firestore iOS Setup Guide, Remote Config Android Setup, Remote Config iOS Setup, Firebase Remote Config Basics Skill, Xcode Project Setup Skill

### Community 72 - "Survey Explorer Test Readiness"
Cohesion: 0.40
Nodes (5): Baseline Test Suite Health (291 Vitest + Playwright tests, 100% pass), Survey Explorer 1 Dispatch, 8 Application Module Mapping (Registration, Triage, Vitals/Telemetry, Notes/PQ Crypto, Offline Sync, Edge AI Discharge, Discharge/Data Controls, RBAC), Codebase & Test Readiness Survey Report, Survey Explorer 1 Progress Log

### Community 73 - "M1 Forensic Integrity Audit"
Cohesion: 0.60
Nodes (5): Forensic Integrity Auditor Dispatch (Milestone 1), Milestone 1 Forensic Audit Verdict: CLEAN, Empirical Mutation Testing - injected two vulnerabilities to prove assertions actively catch regressions, not tautologies, Public/Dist Build Parity Verification (14 files, exact match), Milestone 1 Forensic Integrity Audit Report

### Community 74 - "M2 Spec Miner & Worker"
Cohesion: 0.40
Nodes (5): Spec Miner 3 Briefing (Concurrency/Focus/Crypto), Spec Miner 3 Dispatch, Worker 1 Briefing (M2 Implementation), Worker 1 Dispatch (M2 Implementation), Milestone 2: Adversarial Chaos, Offline Queue Sync & Edge AI Sandbox Isolation

### Community 76 - "Firestore Auth Rule Variables"
Cohesion: 0.33
Nodes (6): App Hosting CLI Commands, Rollout Management (apphosting:rollouts:create/list), Secrets Management via Cloud Secret Manager (apphosting:secrets:set/grantaccess), Environment Variables (BUILD/RUNTIME availability, secret binding), Exploring Firebase CLI Commands, Self-Documenting CLI via --help Discovery

### Community 77 - "Data Connect Transaction Directives"
Cohesion: 0.50
Nodes (4): response Binding, @transaction Multi-Step Operations, @check Directive, @redact Directive

### Community 78 - "m2-adversarial-challenger.test.js"
Cohesion: 0.50
Nodes (3): indexHtml, mockFirestoreUpdates, ROOT

### Community 81 - "Android Studio Refresh Guide"
Cohesion: 0.67
Nodes (3): Refresh Android Studio Local Environment Guide, npx skills add/update --agent android_studio, ~/.agents/skills Directory (Android Studio)

### Community 82 - "Android Studio Setup Guide"
Cohesion: 0.67
Nodes (3): Android Studio Setup Guide (Firebase Skills), MCP Setup Skipped for Android Studio: SSE-only Support vs Firebase CLI MCP's stdio Transport, npx skills add firebase/agent-skills --skill "*" (Android Studio)

### Community 83 - "Antigravity MCP Setup"
Cohesion: 0.67
Nodes (3): Antigravity Setup Guide (Firebase Skills + MCP), mcp_config.json Firebase Entry (Antigravity), Check firebase-basics Skill Install (Local/Global, Antigravity)

### Community 84 - "Claude Code Firebase Plugin"
Cohesion: 0.67
Nodes (3): Claude Code Setup Guide (Firebase Plugin), claude plugin marketplace add firebase/agent-skills; claude plugin install firebase@firebase, claude mcp list -s user / -s project Check

### Community 85 - "Gemini CLI Firebase Extension"
Cohesion: 0.67
Nodes (3): gemini extensions install https://github.com/firebase/agent-skills, Gemini CLI Setup Guide (Firebase Extension + MCP), gemini mcp add -e IS_GEMINI_CLI_EXTENSION=true firebase npx -y firebase-tools@latest mcp

### Community 86 - "Firestore SDK Usage Guides"
Cohesion: 0.67
Nodes (3): Python SDK Usage (Enterprise Firestore), Web SDK Usage — Pipelines (Enterprise Firestore), Firestore Web SDK Usage Guide (Standard)

### Community 87 - "Firebase Hosting Basics"
Cohesion: 0.67
Nodes (3): Hosting Configuration Reference, Hosting Deployment Reference, Firebase Hosting Basics Skill

### Community 88 - "Chief Nurse Workflows List"
Cohesion: 0.67
Nodes (3): Six Chief Nurse Clinical Workflows, Explorer 1 (Milestone 3 Frontend Investigator), Explorer 1 Progress Log (Milestone 3)

## Ambiguous Edges - Review These
- `Milestone 4: Final Verification Summary & Project Wrap-up` → `VICTORY CONFIRMED Audit Verdict`  [AMBIGUOUS]
  .agents/teamwork_preview_victory_auditor/handoff.md · relation: conceptually_related_to
- `Reviewer 1 Independent Review Report` → `Reviewer 2 Independent Review Report`  [AMBIGUOUS]
  .agents/teamwork_preview_m2_reviewer_1/handoff.md · relation: conceptually_related_to
- `@refresh Directive` → `Subscriptions (Web)`  [AMBIGUOUS]
  .agents/skills/firebase-data-connect/reference/realtime.md · relation: references

## Knowledge Gaps
- **441 isolated node(s):** `patientsList`, `usersList`, `activeFilter`, `expandedPatientCardIds`, `modalDialogState` (+436 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Milestone 4: Final Verification Summary & Project Wrap-up` and `VICTORY CONFIRMED Audit Verdict`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Reviewer 1 Independent Review Report` and `Reviewer 2 Independent Review Report`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `@refresh Directive` and `Subscriptions (Web)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Original User Request: IMC ER Multi-Role Testing & RBAC Verification` connect `Original User Request: IMC ER Multi-Role Testing & RBAC Verification` to `RBAC Test Config & Roles`, `M4 Worker 1 Dispatch Instructions`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `Sentinel Briefing` connect `Original User Request: IMC ER Multi-Role Testing & RBAC Verification` to `Orchestrator Handoffs & Gates`, `M4 Worker & Gate Status`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `TEST_INFRA.md (Test Infrastructure Documentation)` connect `Orchestrator Handoffs & Gates` to `Original User Request: IMC ER Multi-Role Testing & RBAC Verification`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `patientsList`, `usersList`, `activeFilter` to the rest of the system?**
  _441 weakly-connected nodes found - possible documentation gaps or missing edges._
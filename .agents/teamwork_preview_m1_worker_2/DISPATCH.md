## 2026-08-23T04:06:12Z
<USER_REQUEST>
You are the remediation Worker for Milestone 1 Iteration 2 (Security & RBAC Boundary Verification & Multi-Role Simulation).
Working directory: /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m1_worker_2
Workspace directory: /Users/hassanabdelmenem/antigravity/imc-er
Parent conversation ID: bd831e8b-f60e-4bf8-9216-abd3b4bd82d8
Original request: /Users/hassanabdelmenem/antigravity/imc-er/.agents/ORIGINAL_REQUEST.md
Gate failure details: /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_orchestrator/GATE_STATUS.md
Challenger report: /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m1_challenger_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Remediation Tasks:
1. In `public/js/app.js`:
   - In `showSignedOut()`, `showAccessGate()`, and `initAuthListener` (when transitioning from owner to non-owner or unapproved roles), ensure `usersUnsubscribe?.()` is called, `usersUnsubscribe = null`, and `#users-list-container` innerHTML is cleared so no stale employee/applicant DOM residue remains across sign-outs or quarantines.
   - Also ensure patient lists and DOM elements are cleanly wiped on logout and access gate.
2. Synchronize build artifacts via `npm run build` and verify with `npm run build:check`.
3. Run `npm run test:unit` and verify all 10 test suites (including `tests/unit/roleSimulationStress.test.js`) pass with 100% success rate.
4. Document the changes, tests, and verification output in /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m1_worker_2/handoff.md and report back via send_message.
</USER_REQUEST>

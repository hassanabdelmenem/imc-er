## 2026-08-23T04:14:25Z
Task:
1. Inspect `public/sw.js`, `public/js/firebase-service.js`, `public/js/telemetry-rum.js`, and `tests/integration/offlineChaos.test.js`.
2. Design comprehensive automated test suites for:
   - Rapid offline-online network flapping during patient note drafting.
   - Offline note queueing in localStorage/IndexedDB with zero data loss.
   - Chronological background sync flush upon reconnection (`background-sync:flushed`).
   - Failed transaction interception and routing to `/dead_letter_queue` with pre-auth buffering.
3. Document your test design and implementation plan in /Users/hassanabdelmenem/antigravity/imc-er/.agents/teamwork_preview_m2_explorer_1/handoff.md and report back via send_message.

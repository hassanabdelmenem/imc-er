# IMC ER Console — Deployment & Architecture Manifest

**Repository**: `hassanabdelmenem/imc-er`
**Firebase project**: `imc-er-manager`
**Hosting site**: `imc-er-manager` → <https://imc-er-manager.web.app>

This repository is bound to that one Firebase project and no other. It shares
no backend, no database, no build tooling, and no credentials with any other
application. See SYNC.md for the release model.

> **History.** An earlier version of this manifest described a combined
> "Hospital Unified EMR & ER Console Suite" spanning `er-app-final`, `hospital`,
> and `imc-er`, and stated that all three shared a single canonical backend
> (`er-icu` / `hospital-er-unified`). That is not the case for this repository:
> `public/js/config.js`, `.firebaserc`, and every workflow here point at
> `imc-er-manager`. The suite framing also carried claims that do not hold —
> a `production-gate.yml` CI gate this repo does not have, test runs across
> sibling repositories' directories, and a minifying build. Those are removed
> rather than restated. Each project is now documented on its own terms.

---

## 1. Overview

A mobile-first emergency-department console: patient registration and tracking,
role-gated clinical boards, offline-capable PWA delivery, client-side
encryption of clinical notes, and on-device discharge-summary synthesis.

The frontend is plain ES modules — no bundler, no framework — served as static
files from `dist/`.

---

## 2. Firebase surfaces

Everything below is deployed from `main`. Nothing should be changed in the
Firebase Console; the repo is the desired state.

| Surface | Source in repo | Released by |
| :--- | :--- | :--- |
| Hosting | `dist/` (built from `public/`) | `.github/workflows/firebase-hosting-merge.yml` |
| Firestore rules | `firestore.rules` | `.github/workflows/firebase-config-deploy.yml` |
| Remote Config | `remote-config.json` | `.github/workflows/firebase-config-deploy.yml` |
| Project targeting | `.firebaserc`, `firebase.json` | both |

Firestore **data**, Auth **users**, and Console-only project settings are not
in this repo and are not backed up by it.

### Collections

| Collection | Written by | Notes |
| :--- | :--- | :--- |
| `patients` | `firebase-service.js` | clinical records; access gated by `firestore.rules` |
| `users` | app + `scripts/set-admin.js` | one document per staff member, carrying `role` |
| `settings/remote_config` | operator | live kill-switch mirror, watched via `onSnapshot` |
| `dead_letter_queue` | `telemetry-rum.js` | failed batch writes, captured with payload for replay |

Batch writes are chunked at 450 operations (`firebase-service.js`), below
Firestore's 500-operation transaction limit.

### Remote Config kill-switches

Both are read by `public/js/app.js` and **default to `true`**, so a switch that
has not been published cannot disable anything.

| Parameter | Gates |
| :--- | :--- |
| `enable_edge_ai_synthesis` | client-side Edge AI discharge-summary generation |
| `enable_batch_purge` | the Purge Discharged / Purge All controls |

The app resolves them from Firebase Remote Config and then from
`settings/remote_config` in Firestore, the latter giving near-instant
propagation via a snapshot listener.

---

## 3. Roles

Defined in `public/js/config.js` and enforced in `firestore.rules`. The two must
be changed together; `scripts/set-admin.js` mirrors the same list.

| Role | Capability |
| :--- | :--- |
| `owner` | system administrator; the only role that may assign roles |
| `medical_director` | leadership tier: full clinical board access + data controls |
| `emergency_manager` | as above |
| `emergency_deputy_manager` | as above |
| `pending` | signed up, awaiting approval — no PHI access |
| `blocked` | access revoked — no PHI access |

`doctor`, `user`, `cmo`, and `manager` were retired in the 2026 restructure.
Anyone still carrying one is demoted to `pending` on next sign-in.

Default posture in the rules is deny: a signed-in user with no `/users`
document reads nothing from `patients`.

---

## 4. PWA and service worker

`public/sw.js`, cache version `v7-role-brand-concurrency-20260802`, maintaining
separate HTML, asset, and clinical-API caches. Stale caches outside the current
set are deleted on `activate` before the worker claims clients.

Hosting sends `Cache-Control: no-cache, no-store, must-revalidate` for HTML,
CSS, and JS (`firebase.json`), so a deploy is picked up on next load rather than
waiting for cache expiry.

---

## 5. Client-side cryptography

`public/js/crypto-engine.js` (`ClinicalCryptoEngine`) encrypts clinical notes in
the browser before they reach Firestore. It declares FIPS 203 ML-KEM-768 hybrid
key encapsulation with AES-256-GCM, and carries a `SIMULATED-ML-KEM-768` path
used when `window.crypto.subtle` is unavailable.

That fallback means "encrypted at rest in Firestore" holds only where the real
primitives are available. The distinction has not been independently audited and
should not be described as a compliance guarantee without one.

---

## 6. Edge AI and network isolation

`public/js/edge-ai-service.js` generates discharge summaries on-device via
`window.ai` / WebNN, with a deterministic engine when no accelerator is present.

Before synthesis, `NetworkIsolationGatekeeper.lock()` replaces `fetch`,
`XMLHttpRequest.prototype.send`, `sendBeacon`, `WebSocket`, and `EventSource`.
Requests to external origins throw
`SECURITY_EXCEPTION: Outbound network transmissions blocked during local Edge AI
PHI inference.` and log a violation to RUM telemetry. `unlock()` restores the
originals afterwards.

---

## 7. Build

`npm run build` → `scripts/build-prod.js`, which copies `public/` to `dist/`
verbatim. Hosting serves `dist/`, so both trees are committed and must agree;
`npm run build:check` verifies this and both hosting workflows run it before
deploying.

This build does not minify. Earlier revisions of this document said it did; the
committed `dist/` has always been byte-identical to `public/`.

---

## 8. CI

| Workflow | Trigger | Does |
| :--- | :--- | :--- |
| `firebase-hosting-merge.yml` | push to `main` | `dist/` check, then deploy Hosting to live |
| `firebase-hosting-pull-request.yml` | pull request | `dist/` check, then deploy a preview channel |
| `firebase-config-deploy.yml` | rules/config change on `main`, or manual | deploy Firestore rules and Remote Config |
| `firebase-drift-check.yml` | daily, after deploy, or manual | compare the live site against `dist/` |
| `weekly-sca-scan.yml` | Mondays 04:00 UTC, or manual | `npm audit`, `npm outdated` |

**No workflow runs the test suites.** `tests/unit`, `tests/integration`,
`tests/load`, and `tests/e2e` exist and run locally via `npm test` and
`npm run test:e2e`, but nothing invokes them in CI. A pull request's only
automated checks are the `dist/` gate and the preview deploy.

---

## 9. Known inconsistencies

- `trafficSplit` in `firebase.json` (`canary-v2: 100 / stable: 0`) is not part
  of the Firebase Hosting config schema and has no effect; all traffic goes to
  the single live version. Canary releases would need Hosting version rollout.
- Test suites are not wired into CI (§8).
- The cryptographic claims in §5 are unaudited.

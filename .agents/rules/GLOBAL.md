# Global Engineering Standards (2026 Modernization Pipeline)

All code produced, reviewed, or committed across the **IMC Unified Emergency Command Center** (`er-app-final` / ER Tracker Pro, `hospital` / Hospital Unified EMR, and `imc-er` / IMC ER Console) MUST strictly conform to the following 2026 engineering guardrails:

---

## 1. Accessibility (WCAG 2.2 AA Standards)
- **Semantic HTML5**: Always use appropriate semantic elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`, `<dialog>`). Never use clickable `<div>` or `<span>` elements without full keyboard (`tabindex="0"`, `onkeydown`) and ARIA handling.
- **Fluid Typography**: Responsive font scaling must use CSS `clamp()` (`font-size: clamp(1rem, 0.95rem + 0.25vw, 1.25rem);`) rather than hardcoded fixed pixel jumps across media queries.
- **Touch & Click Ergonomics**: All interactive elements (buttons, inputs, checkboxes, pills, tabs) MUST have a **minimum target size of 44x44 CSS pixels** (`min-h-[44px] min-w-[44px]` or `padding: 12px 16px`) to ensure touch accuracy in fast-paced clinical environments.
- **ARIA Landmarks & Focus Rings**: Every modal or interactive overlay must trap focus, include proper `role="dialog"` / `aria-labelledby`, and maintain visible, high-contrast focus indicators (`outline: 2px solid var(--primary)`).

---

## 2. State Management (Nanostores Enforcement)
- **Nanostores Priority**: All shared reactive frontend state (e.g., active department filters, current triage patient list, user authentication token, UI theme, offline status) MUST be managed via lightweight [Nanostores](https://github.com/nanostores/nanostores) (`atom()`, `map()`, `computed()`).
- **Legacy Prohibition**: The introduction of monolithic Redux (`redux`, `@reduxjs/toolkit`), MobX, or ad-hoc global `window.*` mutable variables is **strictly forbidden**.
- **Refactoring Flag**: If legacy global mutable state patterns are detected during a refactoring sprint, mark them immediately with `// TODO(2026-Nanostores-Refactor): Migrate to Nanostores atom/map` and convert them incrementally without breaking existing unit tests (`vitest`).

---

## 3. CI/CD & Pipeline Security
- **OIDC (OpenID Connect) Token Exchange**: Static long-lived JSON service account keys (`FIREBASE_SERVICE_ACCOUNT_*`) are deprecated. All GitHub Actions deployment pipelines must use Google Cloud Workload Identity Federation / OIDC token exchange (`permissions: id-token: write`).
- **40-Character Commit SHA Pinning**: To prevent supply-chain compromise, **every third-party GitHub Action inside `.github/workflows/*.yml` MUST be pinned to its exact 40-character commit SHA** with the version tag as a comment.
  - **Correct**: `uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`
  - **Incorrect**: `uses: actions/checkout@v4`

---

## 4. Cryptography & Data Protection (ML-KEM / FIPS 203)
- **Post-Quantum Cryptography**: All newly engineered encrypted data payloads, end-to-end clinical communication tunnels, or secure local storage keys must adhere to **FIPS 203 ML-KEM (Module-Lattice-Based Key-Encapsulation Mechanism)** or hybrid ECDH+ML-KEM algorithms.
- **Data in Transit/Rest**: Never transmit unencrypted patient personally identifiable information (PII/PHI) over non-TLS sockets. Sensitive local caching must utilize AES-256-GCM / Web Crypto API wrapped sessions.

---

## 5. Offline-First PWA Resilience
- **Service Worker Caching Strategies**:
  - **Clinical Patient Data (`/patients/*`, Firestore API)**: Enforce **Network-First** with immediate fallback to local `IndexedDB` persistence (`enableIndexedDbPersistence()` / `persistentLocalCache()`).
  - **Static Application Assets (`*.css`, `*.js`, `*.png`, `*.woff2`)**: Enforce **Cache-First** or **Stale-While-Revalidate** to ensure instant application loading during network dropouts.
- **Visual Connectivity Indicators**: The UI must display an unobtrusive, high-contrast offline badge when `navigator.onLine === false` or when Firestore transitions to offline cache mode, reassuring clinicians that local edits will sync automatically once connectivity restores.

# 📦 V1 Legacy Codebase Archive & Deprecation Manifest

**Archive Date**: 2026-07-09  
**Deprecation Status**: 🚫 **DEPRECATED & ARCHIVED (Superseded by 100% V2 Production Bundle)**  
**Governing Architecture**: 2026 Modernization Standards (`Nanostores` + `telemetry-rum.js` + `WCAG 2.2 AA` + `FIPS 203 Cryptography`)

---

## 1. Scope of Archival
With the formal authorization of the 100% production changeover (`"canary-v2": 100, "stable": 0`), all legacy V1 architectural patterns and fallback scripts across this repository have been formally retired:

1. **Legacy Global State (`window.activeDoctors`, ad-hoc DOM event arrays)**:
   - Superseded by atomic `nanostores` (`patientsStore`, `doctorStore`, `uiStateStore`, `searchQueryStore`).
2. **Synchronous Unbounded DOM Rendering**:
   - Superseded by virtualized/batched DOM fragment rendering (`document.createDocumentFragment()`) with `<template>` clone optimizations and `<br>` layout fixes.
3. **Unencrypted Plaintext Clinical Notes**:
   - Superseded by hybrid post-quantum cryptography (`crypto-engine.js` / ML-KEM-768 + AES-GCM-256).
4. **Ad-Hoc Error Handling Without Dead-Letter Queue**:
   - Superseded by structured transaction catchers that dispatch failed operations directly to `/dead_letter_queue` via `TelemetryRUM.recordFailedBatch()`.

---

## 2. Retention Policy
Any historical V1 backup snapshots, raw prototype files, or pre-Nanostores test harnesses placed in this `archive-v1/` directory are preserved strictly for compliance and auditing purposes. **Do not import or execute scripts from this folder in active production code.**

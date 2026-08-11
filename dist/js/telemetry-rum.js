/**
 * Telemetry & Observability RUM (Real User Monitoring) Script
 * Tracks Core Web Vitals (LCP on mobile > 2.5s, INP > 200ms) & Dead-Letter Queue integration.
 * Part of IMC Unified Emergency Command Center (2026 Modernization)
 */
(function() {
  'use strict';

  const LCP_MOBILE_THRESHOLD_MS = 2500;
  const INP_THRESHOLD_MS = 200;
  // Enough to cover a page load's worth of alerts before auth resolves.
  const MAX_BUFFERED_EVENTS = 50;

  function isMobileViewport() {
    return window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /**
   * Firestore sink, installed by app.js.
   *
   * This file is a classic script loaded in <head> so its PerformanceObserver
   * is registered before LCP happens; it cannot import the modular SDK itself.
   * It previously reached for `window.firebase.firestore()` — the *compat*
   * global, which this app never loads. Both writes below therefore evaluated
   * to nothing, in silence, while firestore.rules carried rules for both
   * collections and CLINICAL_SOP promised that no clinical note is ever
   * discarded. Nothing was ever written to either.
   *
   * Events raised before the sink exists are buffered rather than dropped:
   * telemetry fires during page load, long before auth resolves, and the rules
   * admit writes from approved clinical staff only.
   */
  let firestoreSink = null;
  let currentUid = 'anonymous';
  let buffered = [];
  let droppedBeforeSink = 0;

  function emit(collectionName, payload) {
    if (!firestoreSink) {
      if (buffered.length < MAX_BUFFERED_EVENTS) buffered.push({ collectionName, payload });
      else droppedBeforeSink++;
      return Promise.resolve();
    }
    return Promise.resolve()
      .then(() => firestoreSink(collectionName, payload))
      .catch((err) => {
        // The dead-letter queue is the last line: if even this write fails there
        // is nowhere further to escalate, so say so loudly rather than swallow.
        console.error(
          `[Telemetry] write to ${collectionName} failed:`,
          (err && (err.code || err.message)) || err
        );
      });
  }

  function sendTelemetryAlert(type, metricValue, threshold, extra = {}) {
    const alertData = {
      type: type,
      metric: Math.round(metricValue),
      threshold: threshold,
      url: window.location.href,
      viewportWidth: window.innerWidth,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...extra
    };

    console.warn(`[Telemetry RUM Alert] ${type} violation (${Math.round(metricValue)}ms > ${threshold}ms)`, alertData);

    // Dispatch DOM event for frontend observers / testing harnesses
    window.dispatchEvent(new CustomEvent(`telemetry:${type.toLowerCase().replace('_', '-')}`, {
      detail: alertData
    }));

    emit('telemetry_alerts', alertData);
  }

  // 1. Observe Largest Contentful Paint (LCP)
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const lcpTime = lastEntry.startTime;
          if (lcpTime > LCP_MOBILE_THRESHOLD_MS && isMobileViewport()) {
            sendTelemetryAlert('LCP_VIOLATION', lcpTime, LCP_MOBILE_THRESHOLD_MS, {
              element: lastEntry.element ? lastEntry.element.tagName : 'unknown'
            });
          }
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // LCP observer not supported
    }

    // 2. Observe Interaction to Next Paint (INP) / First Input / Event timing
    try {
      const inpObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          // If interaction duration exceeds 200ms
          if (entry.duration && entry.duration > INP_THRESHOLD_MS) {
            // Filter out minor scroll events if needed, check interactionId
            if (!entry.interactionId || entry.interactionId > 0 || entry.name.includes('click') || entry.name.includes('pointer') || entry.name.includes('key')) {
              sendTelemetryAlert('INP_VIOLATION', entry.duration, INP_THRESHOLD_MS, {
                eventName: entry.name,
                target: entry.target ? entry.target.tagName : 'unknown'
              });
            }
          }
        }
      });
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: INP_THRESHOLD_MS });
    } catch (e) {
      // Event timing observer not supported
    }
  }

  // Expose Telemetry RUM API globally for manual trigger, dead-letter queueing & testing
  window.TelemetryRUM = {
    sendAlert: sendTelemetryAlert,

    /**
     * Install the Firestore writer. Called by app.js once the modular SDK is
     * ready and the signed-in user is approved clinical staff, which is who
     * firestore.rules admits to these collections. Flushes anything buffered
     * during page load.
     */
    setSink: function(sink) {
      firestoreSink = sink;
      const pending = buffered;
      buffered = [];
      if (droppedBeforeSink > 0) {
        console.warn(`[Telemetry] ${droppedBeforeSink} event(s) dropped before the sink was installed.`);
        droppedBeforeSink = 0;
      }
      if (sink) pending.forEach((e) => emit(e.collectionName, e.payload));
    },

    /** Clear the sink on sign-out; writes would be denied by the rules anyway. */
    clearSink: function() {
      firestoreSink = null;
      currentUid = 'anonymous';
    },

    setUser: function(uid) {
      currentUid = uid || 'anonymous';
    },

    recordFailedBatch: function(payload, errorMsg, targetInfo = {}) {
      const dlqPayload = {
        failedAt: new Date().toISOString(),
        payload: payload || {},
        errorMessage: typeof errorMsg === 'string' ? errorMsg : (errorMsg && errorMsg.message ? errorMsg.message : String(errorMsg)),
        targetCollection: targetInfo.collection || 'unknown',
        targetDocId: targetInfo.docId || 'unknown',
        url: window.location.href,
        userUid: currentUid
      };

      console.error('[Telemetry DLQ] Atomic batch write failed, pushing to dead_letter_queue:', dlqPayload);
      window.dispatchEvent(new CustomEvent('telemetry:dlq-record', { detail: dlqPayload }));

      return emit('dead_letter_queue', dlqPayload);
    }
  };

  // 3. Continuous Governance Mode (Active Sentinel)
  window.ActiveSentinel = {
    mode: 'ACTIVE_SENTINEL',
    version: '2026.4',
    logs: [],
    startMonitoring: function() {
      window.addEventListener('telemetry:inp-violation', function(e) {
        const detail = e.detail || {};
        const alertMsg = `[ACTIVE SENTINEL GOVERNANCE ALERT] INP spiked above 200ms! (${detail.metric}ms duration on ${detail.eventName || 'interaction'})`;
        console.error(alertMsg, detail);
        window.ActiveSentinel.logs.push({ type: 'INP_SPIKE', timestamp: new Date().toISOString(), detail });
      });

      window.addEventListener('telemetry:dlq-record', function(e) {
        const detail = e.detail || {};
        const alertMsg = `[ACTIVE SENTINEL GOVERNANCE ALERT] Failed transaction written to /dead_letter_queue! Error: ${detail.errorMessage}`;
        console.error(alertMsg, detail);
        window.ActiveSentinel.logs.push({ type: 'DLQ_DROP', timestamp: new Date().toISOString(), detail });
      });

      console.log('[Active Sentinel] Continuous Governance Mode enabled. Monitoring INP (<200ms) & Dead-Letter Queue drops.');
    }
  };

  // Auto-start Active Sentinel governance
  window.ActiveSentinel.startMonitoring();
})();

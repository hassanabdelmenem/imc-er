/**
 * Telemetry & Observability RUM (Real User Monitoring) Script
 * Tracks Core Web Vitals (LCP on mobile > 2.5s, INP > 200ms) & Dead-Letter Queue integration.
 * Part of IMC Unified Emergency Command Center (2026 Modernization)
 */
(function() {
  'use strict';

  const LCP_MOBILE_THRESHOLD_MS = 2500;
  const INP_THRESHOLD_MS = 200;

  function isMobileViewport() {
    return window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
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

    // If Firestore is available, log asynchronously to telemetry_alerts collection
    try {
      if (window.firebase && window.firebase.firestore) {
        const db = window.firebase.firestore();
        db.collection('telemetry_alerts').add(alertData).catch(() => {
          // Fallback if telemetry logging fails (do not crash app)
        });
      }
    } catch (e) {
      // Ignore errors during telemetry transmission
    }
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
    recordFailedBatch: function(payload, errorMsg, targetInfo = {}) {
      const dlqPayload = {
        failedAt: new Date().toISOString(),
        payload: payload || {},
        errorMessage: typeof errorMsg === 'string' ? errorMsg : (errorMsg && errorMsg.message ? errorMsg.message : String(errorMsg)),
        targetCollection: targetInfo.collection || 'unknown',
        targetDocId: targetInfo.docId || 'unknown',
        url: window.location.href,
        userUid: (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) ? window.firebase.auth().currentUser.uid : 'anonymous'
      };

      console.error('[Telemetry DLQ] Atomic batch write failed, pushing to dead_letter_queue:', dlqPayload);
      window.dispatchEvent(new CustomEvent('telemetry:dlq-record', { detail: dlqPayload }));

      try {
        if (window.firebase && window.firebase.firestore) {
          const db = window.firebase.firestore();
          return db.collection('dead_letter_queue').add(dlqPayload);
        }
      } catch (e) {
        console.error('[Telemetry DLQ] Could not write to dead_letter_queue Firestore:', e);
      }
      return Promise.resolve();
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

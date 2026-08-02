/**
 * ============================================================================
 * PROPRIETARY AND CONFIDENTIAL — Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * Service Worker (`sw.js`) via Workbox (@Gemini-3-Pro - Sprint 2 Modernization)
 * ============================================================================
 * 
 * Offline-First Service Worker for IMC ER Console (`imc-er`).
 * Strategies:
 * - Network-First + IndexedDB caching for Firestore / API endpoints (`/patients/*`, `api`).
 * - Stale-While-Revalidate for static assets (`.html`, `.css`, `.js`, `.png`).
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

const CACHE_VERSION = 'v7-role-brand-concurrency-20260802';
const HTML_CACHE = `imc-er-manager-html-cache-${CACHE_VERSION}`;
const ASSETS_CACHE = `imc-er-manager-assets-cache-${CACHE_VERSION}`;
const API_CACHE = `imc-er-manager-clinical-api-cache-${CACHE_VERSION}`;
const CURRENT_CACHES = [HTML_CACHE, ASSETS_CACHE, API_CACHE];

if (workbox) {
    workbox.setConfig({ debug: false });

    // Precache shell navigation
    workbox.routing.registerRoute(
        ({ request }) => request.mode === 'navigate',
        new workbox.strategies.NetworkFirst({
            cacheName: HTML_CACHE,
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 50,
                    maxAgeSeconds: 24 * 60 * 60, // 1 day
                }),
            ],
        })
    );

    // Stale-While-Revalidate for static resources (CSS, JS, Fonts, Images)
    workbox.routing.registerRoute(
        ({ request }) =>
            request.destination === 'style' ||
            request.destination === 'script' ||
            request.destination === 'font' ||
            request.destination === 'image',
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: ASSETS_CACHE,
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 200,
                    maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                }),
            ],
        })
    );

    // Network-First with Cache Fallback for Clinical Data / API endpoints
    workbox.routing.registerRoute(
        ({ url }) => url.pathname.includes('/patients/') || url.pathname.includes('/api/') || url.hostname.includes('firestore.googleapis.com'),
        new workbox.strategies.NetworkFirst({
            cacheName: API_CACHE,
            networkTimeoutSeconds: 4,
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 500,
                    maxAgeSeconds: 12 * 60 * 60, // 12 hours
                }),
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );

    // Skip waiting on install to ensure prompt activation
    self.addEventListener('install', (event) => {
        self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (!CURRENT_CACHES.includes(cacheName)) {
                            console.log('[ServiceWorker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }).then(() => self.clients.claim())
        );
    });
} else {
    console.warn("Workbox failed to load in Service Worker.");
}

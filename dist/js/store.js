/**
 * ============================================================================
 * PROPRIETARY AND CONFIDENTIAL — Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * Nanostores State Management Module (@Gemini-3-Flash - Sprint 2 Modernization)
 * ============================================================================
 * 
 * Provides framework-agnostic atomic store (`atom`, `map`, `computed`) for
 * ER Tracker Pro (`er-app-final`), ensuring zero unnecessary DOM re-renders.
 */

// Lightweight standalone Nanostores implementation for browser / ESM environments
class Atom {
    constructor(initialValue) {
        this.value = initialValue;
        this.listeners = new Set();
    }
    get() {
        return this.value;
    }
    set(newValue) {
        if (this.value !== newValue) {
            this.value = newValue;
            this.listeners.forEach(cb => cb(this.value, this.value));
        }
    }
    subscribe(cb) {
        cb(this.value);
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }
    destroy() {
        this.listeners.clear();
    }
}

class MapStore extends Atom {
    constructor(initialObject = {}) {
        super(initialObject);
    }
    setKey(key, val) {
        const next = { ...this.value, [key]: val };
        this.set(next);
    }
}

function atom(initialValue) {
    return new Atom(initialValue);
}

function map(initialObject) {
    return new MapStore(initialObject);
}

function computed(stores, cb) {
    const storeList = Array.isArray(stores) ? stores : [stores];
    const calc = () => cb(...storeList.map(s => s.get()));
    const compStore = atom(calc());
    const unsubscribers = storeList.map(s => s.subscribe(() => {
        compStore.set(calc());
    }));
    compStore.destroy = () => {
        unsubscribers.forEach(u => u && typeof u === 'function' && u());
        compStore.listeners.clear();
    };
    return compStore;
}

// Global Application Reactive Stores
export const activeDepartment = atom("ALL");
export const activeTriageFilter = atom("ALL");
export const userRoleStore = atom("pending");
export const offlineStatusStore = atom(false);
export const activePatientsStore = atom([]);
export const patientCountStore = computed(activePatientsStore, (patients) => patients ? patients.length : 0);
export const activeSentinelAlert = atom(null);
export const isAudioMuted = atom(false);

export function playErgonomicChime() {
    if (typeof window === "undefined") return;
    if (isAudioMuted.get()) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!window._erAudioCtx) window._erAudioCtx = new AudioCtx();
        const ctx = window._erAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain1.gain.setValueAtTime(0.12, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.18);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.12); // C6
        gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.12);
        osc2.stop(ctx.currentTime + 0.35);
    } catch (err) {
        console.warn("[Sentinel] Audio chime skipped due to browser policy:", err.message);
    }
}

// Expose on window for legacy DOM event bridges and rapid prototyping synchronization
if (typeof window !== "undefined") {
    window.NanostoreClinicalStore = {
        atom,
        map,
        computed,
        activeDepartment,
        activeTriageFilter,
        userRoleStore,
        offlineStatusStore,
        activePatientsStore,
        patientCountStore,
        activeSentinelAlert,
        isAudioMuted,
        playErgonomicChime
    };
}


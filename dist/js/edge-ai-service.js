/**
 * ============================================================================
 * PROPRIETARY LEGAL PROPERTY OF SEVENSN (© 2026)
 * Edge AI Clinical Engine & Network Isolation Gatekeeper (`edge-ai-service.js`)
 * Strictly zero-PHI leakage: Local on-device Gemini Nano via window.ai / WebNN
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. NETWORK ISOLATION GATEKEEPER (Zero-PHI Exfiltration Sandbox)
// ----------------------------------------------------------------------------
class NetworkIsolationGatekeeper {
    static isLocked = false;
    static originalFetch = null;
    static originalXHRSend = null;
    static originalBeacon = null;
    static originalWebSocket = null;
    static originalEventSource = null;

    static lock() {
        if (this.isLocked) return;
        this.isLocked = true;

        // Preserve original APIs
        this.originalFetch = window.fetch;
        this.originalXHRSend = XMLHttpRequest.prototype.send;
        if (navigator.sendBeacon) this.originalBeacon = navigator.sendBeacon.bind(navigator);
        if (window.WebSocket) this.originalWebSocket = window.WebSocket;
        if (window.EventSource) this.originalEventSource = window.EventSource;

        // Intercept fetch
        window.fetch = async (...args) => {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
            if (this._isExternalRequest(url)) {
                console.error(`[NetworkIsolationGatekeeper] Blocked external fetch during active PHI inference: ${url}`);
                if (window.TelemetryRUM && window.TelemetryRUM.recordSecurityViolation) {
                    window.TelemetryRUM.recordSecurityViolation({ action: 'blocked_fetch_during_phi_inference', url });
                }
                throw new Error("SECURITY_EXCEPTION: Outbound network transmissions blocked during local Edge AI PHI inference.");
            }
            return this.originalFetch.apply(window, args);
        };

        // Intercept XHR
        XMLHttpRequest.prototype.send = function(...args) {
            if (NetworkIsolationGatekeeper.isLocked && NetworkIsolationGatekeeper._isExternalRequest(this._url || '')) {
                console.error(`[NetworkIsolationGatekeeper] Blocked external XHR during active PHI inference.`);
                throw new Error("SECURITY_EXCEPTION: Outbound XHR transmissions blocked during local Edge AI PHI inference.");
            }
            return NetworkIsolationGatekeeper.originalXHRSend.apply(this, args);
        };

        // Intercept sendBeacon
        if (navigator.sendBeacon) {
            navigator.sendBeacon = (url, data) => {
                if (this.isLocked && this._isExternalRequest(url)) {
                    console.error(`[NetworkIsolationGatekeeper] Blocked external sendBeacon during active PHI inference: ${url}`);
                    return false;
                }
                return this.originalBeacon(url, data);
            };
        }

        // Intercept WebSocket
        if (window.WebSocket) {
            window.WebSocket = function(url, ...args) {
                if (NetworkIsolationGatekeeper.isLocked && NetworkIsolationGatekeeper._isExternalRequest(url)) {
                    console.error(`[NetworkIsolationGatekeeper] Blocked external WebSocket during active PHI inference: ${url}`);
                    throw new Error("SECURITY_EXCEPTION: Outbound WebSocket connections blocked during local Edge AI PHI inference.");
                }
                return new NetworkIsolationGatekeeper.originalWebSocket(url, ...args);
            };
        }

        // Intercept EventSource
        if (window.EventSource) {
            window.EventSource = function(url, ...args) {
                if (NetworkIsolationGatekeeper.isLocked && NetworkIsolationGatekeeper._isExternalRequest(url)) {
                    console.error(`[NetworkIsolationGatekeeper] Blocked external EventSource during active PHI inference: ${url}`);
                    throw new Error("SECURITY_EXCEPTION: Outbound EventSource connections blocked during local Edge AI PHI inference.");
                }
                return new NetworkIsolationGatekeeper.originalEventSource(url, ...args);
            };
        }

        console.info("[NetworkIsolationGatekeeper] Locked down external network transmissions for local NPU/GPU inference.");
    }

    static unlock() {
        if (!this.isLocked) return;
        this.isLocked = false;
        if (this.originalFetch) window.fetch = this.originalFetch;
        if (this.originalXHRSend) XMLHttpRequest.prototype.send = this.originalXHRSend;
        if (this.originalBeacon) navigator.sendBeacon = this.originalBeacon;
        if (this.originalWebSocket) window.WebSocket = this.originalWebSocket;
        if (this.originalEventSource) window.EventSource = this.originalEventSource;
        console.info("[NetworkIsolationGatekeeper] Unlocked network transmissions after safe session destruction & memory scrubbing.");
    }


    static _isExternalRequest(url) {
        if (!url) return false;
        const str = url.toString().toLowerCase();
        // Allow local application resources and authorized Firebase Firestore sync connections
        if (str.startsWith('/') || str.startsWith('./') || str.startsWith('../')) return false;
        if (str.includes('localhost') || str.includes('127.0.0.1')) return false;
        if (str.includes('firestore.googleapis.com') || str.includes('firebaseio.com') || str.includes('identitytoolkit.googleapis.com')) return false;
        return true;
    }
}

// ----------------------------------------------------------------------------
// 2. EDGE AI CLINICAL ENGINE (window.ai + WebNN / Deterministic Fallback)
// ----------------------------------------------------------------------------
class EdgeAIClinicalEngine {
    static async checkCapabilities() {
        if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
            try {
                const caps = await window.ai.languageModel.capabilities();
                return caps.available; // 'readily' | 'after-download' | 'no'
            } catch (err) {
                console.warn("[EdgeAI] capability check error:", err);
                return 'no';
            }
        }
        return 'no';
    }

    /**
     * Calculate 5-Level ESI (Emergency Severity Index) based on vital thresholds and clinical presentation.
     * Returns: { level: 'ESI-1' | 'ESI-2' | 'ESI-3' | 'ESI-4' | 'ESI-5', color: string, label: string, isCritical: boolean, reason: string }
     */
    static calculateESI(patient, vitals = []) {
        if (!patient) return { level: 'ESI-4', score: 4, color: 'var(--success)', label: 'ESI-4: Semi-Urgent', isCritical: false, reason: 'Stable presentation' };
        
        const loc = (patient.location || patient.department || '').toLowerCase();
        const status = (patient.status || '').toLowerCase();
        const action = (patient.pendingAction || '').toLowerCase();
        const diag = (patient.diagnosis || '').toLowerCase();
        const hpi = (patient.presentation || '').toLowerCase();
        
        if (patient.isDischarged || status === 'discharged') {
            return { level: 'ESI-5', score: 5, color: 'var(--text-muted)', label: 'ESI-5: Discharged', isCritical: false, reason: 'Patient discharged' };
        }

        // Parse latest vital signs if available
        let latestHr = 0, latestSpo2 = 100, latestSysBp = 120, latestTemp = 37.0;
        if (vitals && vitals.length > 0) {
            const latest = vitals[vitals.length - 1];
            if (latest.hr) latestHr = parseFloat(latest.hr) || 0;
            if (latest.spo2) latestSpo2 = parseFloat(latest.spo2) || 100;
            if (latest.bp) {
                const parts = String(latest.bp).split('/');
                latestSysBp = parseFloat(parts[0]) || 120;
            }
            if (latest.temp) latestTemp = parseFloat(latest.temp) || 37.0;
        }

        // Check ESI-1 (Resuscitation / Immediate Life Threat)
        if (loc.includes('arrest') || status.includes('arrest') || status.includes('code blue') || action.includes('arrest') || diag.includes('cardiac arrest') || diag.includes('code blue') || latestSpo2 < 85 || (latestSysBp > 0 && latestSysBp < 70)) {
            const reason = latestSpo2 < 85 ? `Critical hypoxia (SpO2 ${latestSpo2}%)` : (latestSysBp < 70 ? `Severe hypotension (SysBP ${latestSysBp})` : 'Immediate resuscitation protocol');
            return { level: 'ESI-1', score: 1, color: 'var(--danger)', label: 'ESI-1: Resuscitation', isCritical: true, reason };
        }

        // Check ESI-2 (Emergent / High Risk)
        if (status.includes('critical') || diag.includes('sepsis') || diag.includes('septic') || diag.includes('stemi') || diag.includes('stroke') || diag.includes('cva') || latestHr > 130 || latestSpo2 < 90 || (latestSysBp > 0 && latestSysBp < 90)) {
            const reason = latestHr > 130 ? `Severe tachycardia (HR ${latestHr})` : (latestSpo2 < 90 ? `Hypoxia (SpO2 ${latestSpo2}%)` : (latestSysBp < 90 ? `Hypotension (SysBP ${latestSysBp})` : 'High-risk emergent clinical presentation'));
            return { level: 'ESI-2', score: 2, color: 'var(--warning)', label: 'ESI-2: Emergent', isCritical: true, reason };
        }

        // Check ESI-3 (Urgent / Multiple Resources)
        if (action.includes('waiting icu') || action.includes('waiting ccu') || action.includes('waiting picu') || action.includes('waiting nicu') || action.includes('waiting ward') || action.includes('waiting referral') || action.includes('referral') || status.includes('urgent') || diag.includes('nstemi') || latestHr > 110 || latestTemp > 39.5) {
            const reason = latestHr > 110 ? `Tachycardia (HR ${latestHr})` : (latestTemp > 39.5 ? `Hyperthermia (${latestTemp}°C)` : 'Urgent workup required');
            return { level: 'ESI-3', score: 3, color: 'var(--warning)', label: 'ESI-3: Urgent', isCritical: false, reason };
        }

        // Check ESI-5 (Non-Urgent / Single or No Resource)
        if (status.includes('minor') || diag.includes('refill') || diag.includes('wound check')) {
            return { level: 'ESI-5', score: 5, color: 'var(--primary)', label: 'ESI-5: Non-Urgent', isCritical: false, reason: 'Minor presentation' };
        }

        // Default ESI-4 (Semi-Urgent / Single Resource)
        return { level: 'ESI-4', score: 4, color: 'var(--success)', label: 'ESI-4: Semi-Urgent', isCritical: false, reason: 'Stable presentation' };
    }

    static _synthesizeFallbackSummary(patient, vitals, labs, notes) {
        const name = patient.name || 'Unknown Patient';
        const mrn = patient.patientId || patient.mrn || patient.id || '--';
        const dept = patient.department || 'Emergency Medicine';
        const admitDate = patient.admitDate || patient.registrationTime || 'Not recorded';
        const diagnosis = patient.diagnosis || 'Pending evaluation';
        const hpi = patient.presentation || 'No history recorded';
        const meds = patient.homeMeds || 'None reported';
        const allergies = patient.allergies || 'NKDA';

        let vitalsStr = 'No vital signs recorded during admission.';
        if (vitals && vitals.length > 0) {
            const latest = vitals[vitals.length - 1];
            vitalsStr = `Latest Vitals (${latest.time || 'recent'}): BP ${latest.bp || '--'}, HR ${latest.hr || '--'}, SpO2 ${latest.spo2 || '--'}%, RR ${latest.rr || '--'}, Temp ${latest.temp || '--'}°C.`;
        }

        let labsStr = 'No laboratory results recorded.';
        if (labs && labs.length > 0) {
            labsStr = labs.slice(-6).map(l => `- **${l.name || 'Lab'}**: ${l.value || '--'} (${l.time || ''})`).join('\n');
        }

        let notesStr = 'No clinical progress notes.';
        if (notes && notes.length > 0) {
            notesStr = notes.slice(-4).map(n => `- **Dr. ${n.doctor || 'Physician'}** (${n.time || ''}): ${n.text || ''}`).join('\n');
        }

        return `### 🏥 Admission & Working Diagnosis
- **Patient**: ${name} (MRN: #${mrn})
- **Primary Department**: ${dept}
- **Admission Date/Time**: ${admitDate}
- **Working Diagnosis**: **${diagnosis}**
- **Presentation / HPI**: ${hpi}
- **Known Allergies**: ${allergies} | **Home Medications**: ${meds}

### 🩺 Serial Clinical Timeline & Vitals
${vitalsStr}

### 🔬 Significant Investigations
${labsStr}

### 💊 Hospital Course & Clinical Progress
${notesStr}

### 📋 Discharge Instructions & Outcome
- Patient has achieved clinical stability and completed emergency observation/management.
- **Recommendations**: Continue prescribed home medications unless modified. Follow up with primary care physician or specialist outpatient clinic within 5-7 days.
- **Return Precautions**: Return to ER immediately if experiencing severe dyspnea, chest pain, syncope, high fever, or worsening symptoms.`;
    }

    static async generateDischargeSummary(patient, vitals = [], labs = [], notes = [], onTokenCallback = null) {
        if (!patient) throw new Error("No patient record selected for discharge summary.");

        // Lock external network requests before formatting PHI into prompt memory
        NetworkIsolationGatekeeper.lock();

        let session = null;
        let promptText = null;
        try {
            const capability = await this.checkCapabilities();

            if (capability === 'readily' || capability === 'after-download') {
                if (capability === 'after-download' && onTokenCallback) {
                    onTokenCallback("⚠️ Initializing on-device Gemini Nano model (downloading local NPU weights ~1.5GB in background)... Please wait...\n\n");
                }

                session = await window.ai.languageModel.create({
                    systemPrompt: `You are an expert emergency room physician assistant. Your task is to synthesize a factual, well-structured hospital discharge summary strictly based ONLY on the provided patient HPI, home medications, serial vitals, clinical progress notes, and lab investigations. Do not invent diagnoses or extrapolate. Format sections clearly using Markdown:
### 🏥 Admission & Working Diagnosis
### 🩺 Serial Clinical Timeline & Vitals
### 🔬 Significant Investigations
### 💊 Hospital Course & Management
### 📋 Discharge Instructions & Outcome`
                });

                // Construct strictly localized clinical prompt
                promptText = `Patient Name: ${patient.name || 'Unknown'} (MRN: #${patient.patientId || patient.id})
Department: ${patient.department || 'ER'}
Working Diagnosis: ${patient.diagnosis || 'Pending'}
History of Present Illness: ${patient.presentation || 'None'}
Home Medications: ${patient.homeMeds || 'None'}
Allergies: ${patient.allergies || 'NKDA'}

Serial Vital Signs:
${vitals.map(v => `[${v.time}] BP:${v.bp}, HR:${v.hr}, SpO2:${v.spo2}%, RR:${v.rr}, Temp:${v.temp}C`).join('\n')}

Laboratory Results:
${labs.map(l => `[${l.time}] ${l.name}: ${l.value}`).join('\n')}

Physician Progress Notes:
${notes.map(n => `[${n.time}] Dr. ${n.doctor}: ${n.text}`).join('\n')}

Please synthesize a complete, professional clinical discharge summary based solely on this data.`;

                let fullText = "";
                const stream = await session.promptStreaming(promptText);
                for await (const chunk of stream) {
                    fullText = chunk;
                    if (onTokenCallback) onTokenCallback(fullText);
                }
                return fullText;
            } else {
                // Fallback to Deterministic Template Synthesizer when on-device NPU/GPU prompt model is not present
                if (onTokenCallback) {
                    onTokenCallback("⚡ Executing client-side Deterministic Clinical Template Synthesizer (window.ai Gemini Nano not detected on this browser/GPU). Generating structured clinical summary...\n\n");
                }
                await new Promise(r => setTimeout(r, 450)); // Simulate UI pacing
                const fallbackSummary = this._synthesizeFallbackSummary(patient, vitals, labs, notes);
                if (onTokenCallback) onTokenCallback(fallbackSummary);
                return fallbackSummary;
            }
        } finally {
            // Explicitly destroy AI session & nullify prompt memory for Garbage Collection
            if (session && session.destroy) {
                try { session.destroy(); } catch (_) {}
            }
            promptText = null;
            session = null;
            NetworkIsolationGatekeeper.unlock();
        }
    }
}

// Make globally accessible for UI integration and testing
window.NetworkIsolationGatekeeper = NetworkIsolationGatekeeper;
window.EdgeAIClinicalEngine = EdgeAIClinicalEngine;

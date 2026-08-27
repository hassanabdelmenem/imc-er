import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import '../../public/js/edge-ai-service.js';

describe('EdgeAIClinicalEngine — Discharge Summary Synthesis & 5-Level ESI Triage', () => {
  let Engine;
  let Gatekeeper;

  beforeEach(() => {
    Engine = window.EdgeAIClinicalEngine;
    Gatekeeper = window.NetworkIsolationGatekeeper;
    Gatekeeper.unlock();
  });

  afterEach(() => {
    Gatekeeper.unlock();
    delete window.ai;
    vi.restoreAllMocks();
  });

  describe('Capabilities Detection', () => {
    it('detects window.ai readiness and returns capability status', async () => {
      window.ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' })
        }
      };

      const status = await Engine.checkCapabilities();
      expect(status).toBe('readily');
    });

    it('returns "no" when window.ai is missing or capabilities throws', async () => {
      delete window.ai;
      expect(await Engine.checkCapabilities()).toBe('no');

      window.ai = {
        languageModel: {
          capabilities: vi.fn().mockRejectedValue(new Error('NPU query failed'))
        }
      };
      expect(await Engine.checkCapabilities()).toBe('no');
    });
  });

  describe('5-Level Emergency Severity Index (ESI) Triage Engine', () => {
    it('assigns ESI-1 (Resuscitation) for immediate life threats or critical vital collapses', () => {
      // Cardiac arrest keyword
      const arrestPatient = { name: 'Patient 1', diagnosis: 'Cardiac Arrest - Resuscitation in progress' };
      const res1 = Engine.calculateESI(arrestPatient, []);
      expect(res1.level).toBe('ESI-1');
      expect(res1.score).toBe(1);
      expect(res1.isCritical).toBe(true);

      // Critical hypoxia (SpO2 < 85%)
      const hypoxiaPatient = { name: 'Patient 2', diagnosis: 'Pneumonia' };
      const vitalsHypoxia = [{ spo2: 82, hr: 95, bp: '110/70', temp: 37.2 }];
      const res2 = Engine.calculateESI(hypoxiaPatient, vitalsHypoxia);
      expect(res2.level).toBe('ESI-1');
      expect(res2.reason).toContain('Critical hypoxia');

      // Severe hypotension (SysBP < 70)
      const vitalsHypotension = [{ spo2: 96, hr: 110, bp: '65/40', temp: 36.8 }];
      const res3 = Engine.calculateESI(hypoxiaPatient, vitalsHypotension);
      expect(res3.level).toBe('ESI-1');
      expect(res3.reason).toContain('Severe hypotension');
    });

    it('assigns ESI-2 (Emergent) for STEMI, Sepsis, Stroke, or high-risk vitals', () => {
      // STEMI presentation
      const stemiPatient = { name: 'Patient 3', diagnosis: 'Acute Anterior STEMI' };
      const res1 = Engine.calculateESI(stemiPatient, []);
      expect(res1.level).toBe('ESI-2');
      expect(res1.score).toBe(2);
      expect(res1.isCritical).toBe(true);

      // Sepsis diagnosis
      const sepsisPatient = { name: 'Patient 4', diagnosis: 'Urosepsis with altered mental status' };
      const res2 = Engine.calculateESI(sepsisPatient, []);
      expect(res2.level).toBe('ESI-2');

      // Stroke / CVA diagnosis
      const strokePatient = { name: 'Patient 5', diagnosis: 'Acute Ischemic Stroke' };
      const res3 = Engine.calculateESI(strokePatient, []);
      expect(res3.level).toBe('ESI-2');

      // Severe tachycardia (HR > 130)
      const tachyPatient = { name: 'Patient 6', diagnosis: 'Palpitations' };
      const res4 = Engine.calculateESI(tachyPatient, [{ hr: 145, spo2: 98, bp: '130/80' }]);
      expect(res4.level).toBe('ESI-2');
      expect(res4.reason).toContain('Severe tachycardia');
    });

    it('assigns ESI-3 (Urgent) for high fever, moderate tachycardia, or ICU/CCU/Ward bed waiting', () => {
      // Action waiting ICU
      const waitIcuPatient = { name: 'Patient 7', pendingAction: 'Waiting ICU', diagnosis: 'Asthma exacerbation' };
      const res1 = Engine.calculateESI(waitIcuPatient, []);
      expect(res1.level).toBe('ESI-3');
      expect(res1.score).toBe(3);
      expect(res1.isCritical).toBe(false);

      // High fever (> 39.5 C)
      const feverPatient = { name: 'Patient 8', diagnosis: 'Viral illness' };
      const res2 = Engine.calculateESI(feverPatient, [{ temp: 39.8, hr: 90, spo2: 98, bp: '120/80' }]);
      expect(res2.level).toBe('ESI-3');
      expect(res2.reason).toContain('Hyperthermia');

      // Moderate tachycardia (HR > 110)
      const res3 = Engine.calculateESI(feverPatient, [{ temp: 37.0, hr: 118, spo2: 98, bp: '120/80' }]);
      expect(res3.level).toBe('ESI-3');
      expect(res3.reason).toContain('Tachycardia');
    });

    it('assigns ESI-4 (Semi-Urgent) for stable standard presentations', () => {
      const stablePatient = { name: 'Patient 9', diagnosis: 'Minor ankle sprain', pendingAction: 'Under assessment' };
      const res = Engine.calculateESI(stablePatient, [{ hr: 75, spo2: 99, bp: '120/80', temp: 36.8 }]);
      expect(res.level).toBe('ESI-4');
      expect(res.score).toBe(4);
      expect(res.isCritical).toBe(false);
    });

    it('assigns ESI-5 (Discharged / Non-Urgent) for discharged patients or minor prescriptions', () => {
      const dischargedPatient = { name: 'Patient 10', isDischarged: true, diagnosis: 'Resolved URI' };
      const res1 = Engine.calculateESI(dischargedPatient, []);
      expect(res1.level).toBe('ESI-5');
      expect(res1.score).toBe(5);

      const refillPatient = { name: 'Patient 11', diagnosis: 'Medication refill' };
      const res2 = Engine.calculateESI(refillPatient, []);
      expect(res2.level).toBe('ESI-5');
    });

    it('handles null patient gracefully with default ESI-4', () => {
      const res = Engine.calculateESI(null);
      expect(res.level).toBe('ESI-4');
      expect(res.score).toBe(4);
    });
  });

  describe('Deterministic Clinical Template Synthesizer (Fallback)', () => {
    const fullPatient = {
      id: 'p-det-01',
      name: 'Youssef Mansour',
      patientId: 'H987654321',
      department: 'Cardiology',
      admitDate: '2026-08-02 08:30',
      diagnosis: 'Unstable Angina',
      presentation: 'Sudden onset retrosternal chest tightness radiating to left shoulder',
      homeMeds: 'Aspirin 81mg daily, Atorvastatin 40mg',
      allergies: 'Penicillin (Anaphylaxis)'
    };

    const vitals = [
      { time: '08:35', bp: '150/95', hr: 98, spo2: 97, rr: 18, temp: 37.1 },
      { time: '11:45', bp: '125/80', hr: 74, spo2: 99, rr: 14, temp: 36.9 }
    ];

    const labs = [
      { time: '09:00', name: 'Troponin I (High-Sensitivity)', value: '< 14 ng/L (Negative)' },
      { time: '09:15', name: 'Serum Creatinine', value: '1.0 mg/dL' }
    ];

    const notes = [
      { time: '09:30', doctor: 'Sameh', text: 'Serial ECG showed no ST elevation. Administered sublingual NTG with complete relief.' },
      { time: '12:00', doctor: 'Khaled', text: 'Repeat troponin negative. Hemodynamically stable for outpatient stress testing.' }
    ];

    it('generates structured 4-part Markdown clinical discharge summary with all clinical sections', () => {
      const summary = Engine._synthesizeFallbackSummary(fullPatient, vitals, labs, notes);

      // Section 1
      expect(summary).toContain('### 🏥 Admission & Working Diagnosis');
      expect(summary).toContain('Youssef Mansour');
      expect(summary).toContain('#H987654321');
      expect(summary).toContain('Unstable Angina');
      expect(summary).toContain('Penicillin (Anaphylaxis)');
      expect(summary).toContain('Aspirin 81mg daily, Atorvastatin 40mg');

      // Section 2
      expect(summary).toContain('### 🩺 Serial Clinical Timeline & Vitals');
      expect(summary).toContain('BP 125/80');
      expect(summary).toContain('HR 74');
      expect(summary).toContain('SpO2 99%');

      // Section 3
      expect(summary).toContain('### 🔬 Significant Investigations');
      expect(summary).toContain('Troponin I (High-Sensitivity)');

      // Section 4
      expect(summary).toContain('### 💊 Hospital Course & Clinical Progress');
      expect(summary).toContain('Dr. Sameh');
      expect(summary).toContain('Dr. Khaled');

      // Section 5: Discharge Instructions
      expect(summary).toContain('### 📋 Discharge Instructions & Outcome');
      expect(summary).toContain('5-7 days');
      expect(summary).toContain('Return to ER immediately');
    });

    it('handles empty vitals, labs, notes, and missing demographic fields gracefully', () => {
      const sparsePatient = { id: 'p-sparse' };
      const summary = Engine._synthesizeFallbackSummary(sparsePatient, [], [], []);

      expect(summary).toContain('Unknown Patient');
      expect(summary).toContain('Pending evaluation');
      expect(summary).toContain('No vital signs recorded');
      expect(summary).toContain('No laboratory results recorded');
      expect(summary).toContain('No clinical progress notes');
    });
  });

  describe('Hardware-Accelerated Gemini Nano Streaming & Lifecycle', () => {
    it('executes window.ai Gemini Nano session, streams tokens, and destroys session', async () => {
      const mockTokens = [
        '### 🏥 Admission & Working Diagnosis\n',
        'Patient: Leila Hassan\n',
        'Diagnosis: Acute Bronchitis\n',
        '### 📋 Discharge Instructions\nDischarged in stable condition.'
      ];

      let streamIndex = 0;
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          for (const token of mockTokens) {
            yield token;
          }
        }
      };

      const mockDestroy = vi.fn();
      const mockPromptStreaming = vi.fn().mockResolvedValue(mockStream);
      const mockCreate = vi.fn().mockResolvedValue({
        promptStreaming: mockPromptStreaming,
        destroy: mockDestroy
      });

      window.ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: mockCreate
        }
      };

      const patient = { id: 'p-nano', name: 'Leila Hassan', diagnosis: 'Acute Bronchitis' };
      const streamedChunks = [];
      const onToken = vi.fn((chunk) => streamedChunks.push(chunk));

      const result = await Engine.generateDischargeSummary(patient, [], [], [], onToken);

      expect(mockCreate).toHaveBeenCalled();
      expect(mockPromptStreaming).toHaveBeenCalled();
      expect(onToken).toHaveBeenCalled();
      expect(mockDestroy).toHaveBeenCalled();
      expect(result).toContain('Discharged in stable condition');

      // Network must be unlocked after completion
      expect(Gatekeeper.isLocked).toBe(false);
    });

    it('throws descriptive error if patient record is null or missing', async () => {
      await expect(Engine.generateDischargeSummary(null)).rejects.toThrow(
        'No patient record selected for discharge summary.'
      );
      expect(Gatekeeper.isLocked).toBe(false);
    });
  });
});

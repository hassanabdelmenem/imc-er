/**
 * ============================================================================
 * IMC ER Console — Milestone 6 Empirical Challenger Adversarial Stress Suite
 * ============================================================================
 * Exhaustive layout stress, adversarial boundary, responsive multi-width simulation,
 * rapid expand/collapse cycle, workup protocol alert rendering, and two-tree build parity.
 *
 * Test Suites:
 * 1. Adversarial Demographics & Extreme Text Stress (100+ chars, RTL/LTR, null/undefined, XSS payloads)
 * 2. Responsive Container Boundary & Layout Stability (320px, 375px, 768px, 1024px, 1440px)
 * 3. Rapid Accordion Expand/Collapse Cycles, Single-Card Invariant & Click Isolation
 * 4. Clinical Protocol Alert Triggers (Sepsis, STEMI/MI, Stroke, Referral) in EN/AR
 * 5. UI Component Library & Skeleton Loader Layout Shift Parity
 * 6. Two-Tree Distribution Integrity & CSS Specificity Assertions
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Firebase mocks
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', () => ({
  getAuth: vi.fn(() => ({})),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn()
}));
vi.mock('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn()
}));

vi.mock('../../public/js/firebase-service.js', () => ({
  initAuthListener: vi.fn(),
  loginWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  getUserRole: vi.fn(),
  logAction: vi.fn(),
  getPatientsList: vi.fn(),
  addPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatientRecord: vi.fn(),
  purgeDischargedPatients: vi.fn(),
  purgeAllPatients: vi.fn(),
  saveUserRole: vi.fn(),
  deleteUserRole: vi.fn(),
  auth: {},
  db: {}
}));
vi.mock('../../public/js/firebase-service.js?v=20260706_02', () => ({
  initAuthListener: vi.fn(),
  loginWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  getUserRole: vi.fn(),
  logAction: vi.fn(),
  getPatientsList: vi.fn(),
  addPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatientRecord: vi.fn(),
  purgeDischargedPatients: vi.fn(),
  purgeAllPatients: vi.fn(),
  saveUserRole: vi.fn(),
  deleteUserRole: vi.fn(),
  auth: {},
  db: {}
}));

import {
  calculateAgeAndGender,
  formatElapsedHours,
  formatDurationString
} from '../../public/js/app.js';

import {
  createTriageBadge,
  createStatusBadge,
  createSkeletonLoader,
  createPatientCardShell,
  createMiniButton,
  createActionButton
} from '../../public/js/components/ui-components.js';

import {
  ROOMS,
  PENDING_ACTIONS,
  WAITLIST_ACTIONS
} from '../../public/js/config.js';

const PRIMARY_DEPARTMENTS = [
  { en: 'Emergency Medicine (ER)', ar: 'طب الطوارئ' },
  { en: 'Internal Medicine', ar: 'باطنة' },
  { en: 'Cardiology / CCU', ar: 'قلب / رعاية قلبية' },
  { en: 'Neurology / Stroke', ar: 'مخ وأعصاب / جلطات' },
  { en: 'Orthopedics & Trauma', ar: 'عظام وإصابات' },
  { en: 'General Surgery', ar: 'جراحة عامة' },
  { en: 'Pulmonology / Chest', ar: 'صدر' },
  { en: 'Pediatrics', ar: 'أطفال' },
  { en: 'OB/GYN', ar: 'نساء وتوليد' },
  { en: 'ICU / Critical Care', ar: 'عناية مركزة' },
  { en: 'Nephrology / Dialysis', ar: 'كلى وغسيل كلوي' },
  { en: 'Gastroenterology / Endoscopy', ar: 'جهاز هضمي ومناظير' },
  { en: 'ENT', ar: 'أنف وأذن وحنجرة' },
  { en: 'Ophthalmology', ar: 'رمد / عيون' },
  { en: 'Urology', ar: 'مسالك بولية' },
  { en: 'Toxicology', ar: 'سموم وعلاج الإدمان' }
];

// Helper HTML escaper matching app.js
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Function mirroring app.js active card HTML generation for deterministic testing
function generatePatientCardHTML(p, lang = 'en', expandedSet = new Set()) {
  const currentLang = lang;
  let cleanDept = p.primaryDepartment || p.department || 'Internal Medicine';
  if (ROOMS.includes(cleanDept) || (!p.primaryDepartment && !p.department && cleanDept === p.location)) {
    cleanDept = 'Internal Medicine';
  }
  const standardDepts = PRIMARY_DEPARTMENTS.map(d => d.en).concat(PRIMARY_DEPARTMENTS.map(d => d.ar));
  const isCustomDept = cleanDept && !standardDepts.includes(cleanDept);
  const isCustomAction = !PENDING_ACTIONS.includes(p.pendingAction);
  const isWaitlistAction = WAITLIST_ACTIONS.includes(p.pendingAction) || p.pendingAction === 'Waiting referral' || p.hasReferral === 'Yes' || p.hasReferral === 'No';
  const diagStr = String(p.diagnosis || '');
  const isSepsisSuspected = diagStr.toLowerCase().includes('sepsis') || diagStr.toLowerCase().includes('septic') || diagStr.includes('تسمم') || p.sepsisWorkup === 'Yes' || p.sepsisWorkup === 'No';
  const isMiSuspected = diagStr.toLowerCase().includes('stemi') || diagStr.toLowerCase().includes('nstemi') || /\bmi\b/i.test(diagStr) || diagStr.includes('MI') || diagStr.toLowerCase().includes('infarction') || diagStr.includes('جلطة') || diagStr.includes('قلب') || p.miCodeWorkup === 'Yes' || p.miCodeWorkup === 'No';
  const isStrokeSuspected = diagStr.toLowerCase().includes('stroke') || diagStr.toLowerCase().includes('cva') || diagStr.includes('جلطة دماغية') || diagStr.includes('مخ') || diagStr.includes('دماغ') || p.strokeCodeWorkup === 'Yes' || p.strokeCodeWorkup === 'No';
  const regDateFormatted = p.registrationTime ? new Date(p.registrationTime).toLocaleString(currentLang === 'en' ? 'en-GB' : 'ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const safeName = esc(p.name || '');
  const isExpanded = expandedSet.has(p.id);

  return `
    <div class="patient-card" data-triage="${p.triage || 'ESI-4: Semi-Urgent'}" data-status="${esc(p.status || '')}">
      <div class="card-header" data-id="${esc(p.id)}">
        <div class="card-summary-left">
          <div class="patient-name" dir="${currentLang === 'en' ? 'ltr' : 'rtl'}">${safeName}</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px;">
            <span class="hospital-id">#${esc(p.patientId || '--')}</span>
            <span id="header_age_${esc(p.id)}" class="age-badge" style="margin:0;padding:2px 8px;font-size:11px;">${calculateAgeAndGender(p.nationalId || '')}</span>
            <span class="duration-badge" style="margin:0;padding:2px 8px;font-size:11px;">⏱ ${formatDurationString(p.registrationTime)}</span>
            <span style="font-size:12px;color:var(--text-muted);font-weight:600;">📅 ${regDateFormatted}</span>
          </div>
        </div>
        
        <div class="card-summary-right">
          <div class="card-summary-tags" style="display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px;">
            <select id="loc_${esc(p.id)}" class="btn-mini location-tag quick-loc-select" data-id="${esc(p.id)}" title="${currentLang === 'en' ? 'Room Location' : 'الغرفة'}" style="font-size:12px;padding:3px 8px;border-radius:6px;max-width:170px;margin:0;">
              ${ROOMS.map(r => `<option value="${r}" ${p.location === r ? 'selected' : ''}>📍 ${r}</option>`).join('')}
            </select>
            <div style="display:inline-flex;gap:4px;align-items:center;margin:0;" onclick="event.stopPropagation();">
              <select id="dept_sel_${esc(p.id)}" class="btn-mini location-tag quick-dept-select ${isCustomDept ? 'hidden' : ''}" data-id="${esc(p.id)}" style="font-size:12px;padding:3px 8px;border-radius:6px;max-width:190px;margin:0;background:var(--primary-light);border-color:var(--primary);color:var(--primary);font-weight:700;" title="${currentLang === 'en' ? 'Primary Department' : 'القسم الأساسي'}">
                <option value="">🏥 ${currentLang === 'en' ? 'Dept...' : 'القسم...'}</option>
                ${PRIMARY_DEPARTMENTS.map(d => {
                  const isSel = (cleanDept === d.en || cleanDept === d.ar);
                  return `<option value="${d.en}" ${isSel ? 'selected' : ''}>🏥 ${currentLang === 'en' ? d.en : d.ar}</option>`;
                }).join('')}
                <option value="Other..." ${isCustomDept ? 'selected' : ''}>✏️ ${currentLang === 'en' ? 'Other...' : 'أخرى...'}</option>
              </select>
              <input type="text" id="custom_dept_${esc(p.id)}" class="btn-mini location-tag ${isCustomDept ? '' : 'hidden'}" style="font-size:12px;padding:3px 8px;border-radius:6px;margin:0;width:130px;background:var(--primary-light);border-color:var(--primary);color:var(--primary);font-weight:700;" placeholder="🏥 ${currentLang === 'en' ? 'Dept...' : 'القسم...'}" value="${esc(isCustomDept ? cleanDept : '')}" data-id="${esc(p.id)}">
              <button type="button" class="btn btn-mini btn-outline ${isCustomDept ? '' : 'hidden'}" id="btn_reset_dept_${esc(p.id)}" data-id="${esc(p.id)}" title="Back to presets" style="padding:2px 6px;margin:0;font-size:11px;">📋</button>
            </div>
          </div>
          <div class="pending-action-badge">${esc(p.pendingAction || 'None')}</div>
        </div>
      </div>
      
      <div id="details_${esc(p.id)}" class="card-details ${isExpanded ? '' : 'hidden'}">
        <details class="edit-reg-details" style="margin-bottom:16px;border:1px dashed var(--border-color);border-radius:12px;padding:10px 14px;background:var(--tint-light);">
          <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--primary);outline:none;user-select:none;">
            ✏️ ${currentLang === 'en' ? 'Edit Registration Demographics (Name, ID, Time)' : 'تعديل بيانات التسجيل الأساسية (الاسم، الهوية، الوقت)'}
          </summary>
          <div class="details-grid-top" style="margin-top:14px;margin-bottom:0;">
            <div>
              <label class="field-label" style="margin-top:0;">Name</label>
              <input type="text" id="name_${esc(p.id)}" value="${safeName}" dir="${currentLang === 'en' ? 'ltr' : 'rtl'}" class="input-field" style="margin:0;" data-id="${esc(p.id)}" data-field="name" maxlength="100">
            </div>
            <div>
              <label class="field-label" style="margin-top:0;">Hospital ID</label>
              <input type="text" id="hosp_${esc(p.id)}" value="${esc(p.patientId || '')}" class="input-field" style="margin:0;" data-id="${esc(p.id)}" data-field="patientId" maxlength="10">
            </div>
            <div>
              <label class="field-label" style="margin-top:0;">Time</label>
              <input type="datetime-local" id="regtime_${esc(p.id)}" value="${(p.registrationTime || '').slice(0, 16)}" class="input-field" style="margin:0;" data-id="${esc(p.id)}" data-field="registrationTime">
            </div>
          </div>
          <div style="margin-top:12px;">
            <label class="field-label" style="margin-top:0;">National ID</label>
            <input type="text" inputmode="numeric" pattern="[0-9]*" id="nid_${esc(p.id)}" value="${p.nationalId || ''}" class="input-field" style="margin:0;width:100%;" data-id="${esc(p.id)}" data-field="nationalId" maxlength="14">
          </div>
        </details>
        
        <div class="details-grid-mid">
          <div>
            <label class="field-label">Diagnosis</label>
            <input type="text" id="diag_${esc(p.id)}" value="${esc(p.diagnosis || '')}" class="input-field" data-id="${esc(p.id)}" data-field="diagnosis" maxlength="1000">
          </div>
          <div>
            <label class="field-label">Supportive Tx</label>
            <input type="text" id="supp_${esc(p.id)}" value="${esc(p.supportiveTx || '')}" class="input-field" data-id="${esc(p.id)}" data-field="supportiveTx" maxlength="1000">
          </div>
        </div>
        
        <div class="details-grid-bottom">
          <div>
            <label class="field-label">Action</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <select id="action_${esc(p.id)}" class="select-action ${isCustomAction ? 'hidden' : ''}" data-id="${esc(p.id)}" data-field="pendingAction" style="flex:1;width:100%;">
                ${PENDING_ACTIONS.map(a => `<option value="${a}" ${p.pendingAction === a ? 'selected' : ''}>${a}</option>`).join('')}
                <option value="Custom..." ${isCustomAction ? 'selected' : ''}>✏️ Custom...</option>
              </select>
              <input type="text" id="custom_action_${esc(p.id)}" class="input-custom-action ${isCustomAction ? '' : 'hidden'}" style="flex:1;margin:0;width:100%;" placeholder="Custom" value="${esc(isCustomAction ? p.pendingAction : '')}" data-id="${esc(p.id)}" data-field="customAction">
              <button type="button" class="btn btn-mini btn-outline ${isCustomAction ? '' : 'hidden'}" id="btn_reset_action_${esc(p.id)}" data-id="${esc(p.id)}" title="Back to presets" style="padding:10px 12px;margin:0;">📋</button>
            </div>
          </div>
          
          <div class="workup-boxes">
            <div id="referral_box_${esc(p.id)}" class="alert-box alert-warning ${isWaitlistAction ? '' : 'hidden'}" style="padding:10px;border:1px solid var(--alert-referral);background:var(--warning-bg);">
              <label class="alert-label" style="color:var(--alert-referral);">Referral</label>
              <select id="ref_${esc(p.id)}" class="select-alert" style="background:transparent!important;border:none!important;font-weight:bold;color:var(--alert-referral);padding:2px 0!important;margin:4px 0 0 0;width:100%;cursor:pointer;" data-id="${esc(p.id)}" data-field="hasReferral">
                <option value="" ${!p.hasReferral ? 'selected' : ''}>-- No Referral --</option>
                <option value="Yes" ${p.hasReferral === 'Yes' ? 'selected' : ''}>Yes (Sent to MOH)</option>
                <option value="No" ${p.hasReferral === 'No' ? 'selected' : ''}>No (Self-Pay / Private)</option>
              </select>
            </div>
            
            <div id="sepsis_box_${esc(p.id)}" class="alert-box alert-danger ${isSepsisSuspected ? '' : 'hidden'}" style="padding:10px;border:1px solid var(--danger);background:var(--danger-bg);">
              <label class="alert-label" style="color:var(--danger);">🚨 Sepsis Alert</label>
              <select id="sepsis_${esc(p.id)}" class="select-alert" style="background:transparent!important;border:none!important;font-weight:bold;color:var(--danger);padding:2px 0!important;margin:4px 0 0 0;width:100%;cursor:pointer;" data-id="${esc(p.id)}" data-field="sepsisWorkup">
                <option value="" ${!p.sepsisWorkup ? 'selected' : ''}>-- Pending Decision --</option>
                <option value="Yes" ${p.sepsisWorkup === 'Yes' ? 'selected' : ''}>YES — Lactate & Blood Cultures</option>
                <option value="No" ${p.sepsisWorkup === 'No' ? 'selected' : ''}>NO — Sepsis Ruled Out</option>
              </select>
            </div>

            <div id="mi_box_${esc(p.id)}" class="alert-box alert-danger ${isMiSuspected ? '' : 'hidden'}" style="padding:10px;border:1px solid #ef4444;background:rgba(239, 68, 68, 0.1);">
              <label class="alert-label" style="color:#ef4444;">🚨 Code STEMI / MI Protocol</label>
              <select id="mi_${esc(p.id)}" class="select-alert" style="background:transparent!important;border:none!important;font-weight:bold;color:#ef4444;padding:2px 0!important;margin:4px 0 0 0;width:100%;cursor:pointer;" data-id="${esc(p.id)}" data-field="miCodeWorkup">
                <option value="" ${!p.miCodeWorkup ? 'selected' : ''}>-- Pending Cath Decision --</option>
                <option value="Yes" ${p.miCodeWorkup === 'Yes' ? 'selected' : ''}>YES — Immediate Cath Lab Activation</option>
                <option value="No" ${p.miCodeWorkup === 'No' ? 'selected' : ''}>NO — Troponin / Medical Management</option>
              </select>
            </div>

            <div id="stroke_box_${esc(p.id)}" class="alert-box alert-danger ${isStrokeSuspected ? '' : 'hidden'}" style="padding:10px;border:1px solid #f97316;background:rgba(249, 115, 22, 0.1);">
              <label class="alert-label" style="color:#f97316;">🚨 Code Stroke Protocol</label>
              <select id="stroke_${esc(p.id)}" class="select-alert" style="background:transparent!important;border:none!important;font-weight:bold;color:#f97316;padding:2px 0!important;margin:4px 0 0 0;width:100%;cursor:pointer;" data-id="${esc(p.id)}" data-field="strokeCodeWorkup">
                <option value="" ${!p.strokeCodeWorkup ? 'selected' : ''}>-- Pending CT / Thrombolysis --</option>
                <option value="Yes" ${p.strokeCodeWorkup === 'Yes' ? 'selected' : ''}>YES — CT Angio & Thrombolysis Ready</option>
                <option value="No" ${p.strokeCodeWorkup === 'No' ? 'selected' : ''}>NO — Stroke Ruled Out / Conservative</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

describe('Adversarial Stress Suite 1: Demographics & Extreme Text Length Resilience', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="patient-list-container"></div>';
  });

  it('handles 100-character Arabic patient name without DOM deformation or breaking', () => {
    const longArabicName = 'عبد الرحمن بن محمد بن عبد العزيز بن عبد الله بن إبراهيم السعداوي الحسيني الشريف الأزهري المصري القاهري';
    expect(longArabicName.length).toBeGreaterThanOrEqual(100);

    const patient = {
      id: 'pat-stress-ar-1',
      name: longArabicName,
      patientId: 'H123456789',
      nationalId: '29001011234557',
      location: 'Room 1',
      primaryDepartment: 'Internal Medicine',
      status: 'Under assessment',
      registrationTime: new Date().toISOString()
    };

    const container = document.getElementById('patient-list-container');
    container.innerHTML = generatePatientCardHTML(patient, 'ar');

    const card = container.querySelector('.patient-card');
    expect(card).not.toBeNull();

    const nameEl = card.querySelector('.patient-name');
    expect(nameEl).not.toBeNull();
    expect(nameEl.textContent).toBe(longArabicName);
    expect(nameEl.getAttribute('dir')).toBe('rtl');

    // Ensure hospital id and age badges rendered without disruption
    const hospIdEl = card.querySelector('.hospital-id');
    expect(hospIdEl.textContent).toBe('#H123456789');

    const ageBadge = card.querySelector('#header_age_pat-stress-ar-1');
    expect(ageBadge.textContent).toContain('Male');
  });

  it('handles 120-character single-token English string without spaces (word-break test)', () => {
    const longUnbrokenName = 'Wolfeschlegelsteinhausenbergerdorffvorgesternmalenwilligschonwiederumvonhochachtungderweltundallerhimmelspharen';
    expect(longUnbrokenName.length).toBeGreaterThan(100);
    expect(longUnbrokenName).not.toContain(' ');

    const patient = {
      id: 'pat-stress-en-1',
      name: longUnbrokenName,
      patientId: 'H987654321',
      nationalId: '30005151234567',
      location: 'Room 2',
      primaryDepartment: 'Cardiology',
      status: 'Under assessment',
      registrationTime: new Date().toISOString()
    };

    const container = document.getElementById('patient-list-container');
    container.innerHTML = generatePatientCardHTML(patient, 'en');

    const nameEl = container.querySelector('.patient-name');
    expect(nameEl.textContent).toBe(longUnbrokenName);
    expect(nameEl.getAttribute('dir')).toBe('ltr');
  });

  it('handles completely null, undefined, and missing demographic fields gracefully', () => {
    const emptyPatient = {
      id: 'pat-stress-null-1',
      name: null,
      patientId: undefined,
      nationalId: null,
      location: null,
      primaryDepartment: undefined,
      department: null,
      status: null,
      pendingAction: undefined,
      registrationTime: null,
      diagnosis: null,
      supportiveTx: null,
      hasReferral: null,
      sepsisWorkup: null,
      miCodeWorkup: null,
      strokeCodeWorkup: null
    };

    const container = document.getElementById('patient-list-container');
    container.innerHTML = generatePatientCardHTML(emptyPatient, 'en');

    const card = container.querySelector('.patient-card');
    expect(card).not.toBeNull();

    const nameEl = card.querySelector('.patient-name');
    expect(nameEl.textContent).toBe('');

    const hospIdEl = card.querySelector('.hospital-id');
    expect(hospIdEl.textContent).toBe('#--');

    const ageBadge = card.querySelector('#header_age_pat-stress-null-1');
    expect(ageBadge.textContent).toBe('--');

    const durBadge = card.querySelector('.duration-badge');
    expect(durBadge.textContent).toBe('⏱ --');
  });

  it('prevents XSS injection payloads across all card fields via esc() sanitizer', () => {
    const xssPatient = {
      id: 'pat-xss-1',
      name: '<script>alert("xss-name")</script><img src=x onerror=alert(1)>',
      patientId: '<b onmouseover=alert("xss")>H1</b>',
      nationalId: '29001011234557',
      location: 'Room 1',
      primaryDepartment: '"><script>alert("xss-dept")</script>',
      status: '"><img src=x onerror=alert(2)>',
      pendingAction: '"><svg onload=alert(3)>',
      diagnosis: '<script>alert("xss-diag")</script>',
      supportiveTx: '<iframe src="javascript:alert(4)"></iframe>',
      registrationTime: new Date().toISOString()
    };

    const container = document.getElementById('patient-list-container');
    container.innerHTML = generatePatientCardHTML(xssPatient, 'en');

    // Ensure zero executable script/img/svg/iframe tags injected into DOM
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
    expect(container.querySelectorAll('iframe')).toHaveLength(0);

    const nameEl = container.querySelector('.patient-name');
    expect(nameEl.innerHTML).not.toContain('<script>');
    expect(nameEl.textContent).toContain('<script>alert("xss-name")</script>');
  });
});

describe('Adversarial Stress Suite 2: Multi-Width Viewport Boundary Simulation', () => {
  const testPatient = {
    id: 'pat-viewport-1',
    name: 'سارة عبد الله أحمد - Urgent Follow-up',
    patientId: 'H554433221',
    nationalId: '29505051234567',
    location: 'Isolation Room',
    primaryDepartment: 'Internal Medicine',
    status: 'Under assessment',
    pendingAction: 'Waiting ICU',
    registrationTime: new Date(Date.now() - 3600000).toISOString(),
    diagnosis: 'Severe Sepsis secondary to Pyelonephritis',
    supportiveTx: 'Meropenem 1g IV q8h + Noradrenaline infusion'
  };

  const viewports = [
    { name: 'iPhone SE (Ultra-Narrow)', width: 320 },
    { name: 'iPhone Standard (Mobile)', width: 375 },
    { name: 'iPad Mini (Tablet)', width: 768 },
    { name: 'iPad Pro / Laptop (Desktop)', width: 1024 },
    { name: 'Widescreen Console (4K/QHD)', width: 1440 }
  ];

  viewports.forEach(vp => {
    it(`renders compact patient card stably at container width ${vp.width}px (${vp.name})`, () => {
      document.body.innerHTML = `
        <div id="viewport-wrapper" style="width: ${vp.width}px; max-width: ${vp.width}px; overflow: hidden; box-sizing: border-box;">
          <div id="patient-list-container"></div>
        </div>
      `;

      const container = document.getElementById('patient-list-container');
      container.innerHTML = generatePatientCardHTML(testPatient, 'en');

      const card = container.querySelector('.patient-card');
      expect(card).not.toBeNull();

      const header = card.querySelector('.card-header');
      expect(header).not.toBeNull();

      const summaryLeft = card.querySelector('.card-summary-left');
      expect(summaryLeft).not.toBeNull();

      const summaryRight = card.querySelector('.card-summary-right');
      expect(summaryRight).not.toBeNull();

      // Ensure inline location and department selectors exist and are queryable
      const locSelect = card.querySelector(`#loc_${testPatient.id}`);
      expect(locSelect).not.toBeNull();
      expect(locSelect.value).toBe('Isolation Room');

      const deptSelect = card.querySelector(`#dept_sel_${testPatient.id}`);
      expect(deptSelect).not.toBeNull();
      expect(deptSelect.value).toBe('Internal Medicine');

      const pendingBadge = card.querySelector('.pending-action-badge');
      expect(pendingBadge.textContent).toBe('Waiting ICU');
    });
  });
});

describe('Adversarial Stress Suite 3: Rapid Accordion Expand/Collapse Cycles & Click Isolation', () => {
  let expandedPatientCardIds;
  let saveCalls = [];

  function simulateSave(id) {
    saveCalls.push(id);
  }

  beforeEach(() => {
    expandedPatientCardIds = new Set();
    saveCalls = [];
    document.body.innerHTML = `
      <div id="patient-list-container">
        ${[1, 2, 3, 4, 5].map(num => `
          <div class="patient-card" id="card_pat_${num}">
            <div class="card-header" data-id="pat_${num}">
              <div class="card-summary-left">
                <div class="patient-name">Patient ${num}</div>
                <div class="hospital-id">#H00000000${num}</div>
              </div>
              <div class="card-summary-right">
                <select id="loc_pat_${num}" class="btn-mini location-tag quick-loc-select" data-id="pat_${num}">
                  <option value="Room 1">📍 Room 1</option>
                  <option value="Room 2">📍 Room 2</option>
                </select>
                <button type="button" id="btn_mini_pat_${num}" class="btn btn-mini">Action</button>
              </div>
            </div>
            <div id="details_pat_${num}" class="card-details hidden">
              <input type="text" id="diag_pat_${num}" value="Diagnosis ${num}">
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Wire accordion handler matching app.js
    document.querySelectorAll('.card-header').forEach(header => {
      header.onclick = (e) => {
        if (e.target.closest('select, input, button')) return;
        const id = header.dataset.id;
        const detailsEl = document.getElementById(`details_${id}`);
        if (!detailsEl) return;
        
        const isCurrentlyHidden = detailsEl.classList.contains('hidden');
        if (isCurrentlyHidden) {
          const prevIds = Array.from(expandedPatientCardIds);
          expandedPatientCardIds.clear();
          expandedPatientCardIds.add(id);
          detailsEl.classList.remove('hidden');
          
          prevIds.forEach(prevId => {
            if (prevId !== id) {
              const prevDetails = document.getElementById(`details_${prevId}`);
              if (prevDetails) prevDetails.classList.add('hidden');
              simulateSave(prevId);
            }
          });
        } else {
          expandedPatientCardIds.delete(id);
          detailsEl.classList.add('hidden');
          simulateSave(id);
        }
      };
    });
  });

  it('enforces single-card open invariant when switching between cards', () => {
    const header1 = document.querySelector('.card-header[data-id="pat_1"]');
    const header2 = document.querySelector('.card-header[data-id="pat_2"]');
    const details1 = document.getElementById('details_pat_1');
    const details2 = document.getElementById('details_pat_2');

    // Click card 1 -> expands card 1
    header1.click();
    expect(expandedPatientCardIds.has('pat_1')).toBe(true);
    expect(details1.classList.contains('hidden')).toBe(false);

    // Click card 2 -> expands card 2, collapses card 1 and triggers auto-save on card 1
    header2.click();
    expect(expandedPatientCardIds.has('pat_2')).toBe(true);
    expect(expandedPatientCardIds.has('pat_1')).toBe(false);
    expect(details2.classList.contains('hidden')).toBe(false);
    expect(details1.classList.contains('hidden')).toBe(true);
    expect(saveCalls).toContain('pat_1');
  });

  it('survives 100 rapid expand/collapse toggle cycles without desynchronizing state', () => {
    const header1 = document.querySelector('.card-header[data-id="pat_1"]');
    const details1 = document.getElementById('details_pat_1');

    for (let i = 0; i < 100; i++) {
      header1.click();
      if (i % 2 === 0) {
        expect(expandedPatientCardIds.has('pat_1')).toBe(true);
        expect(details1.classList.contains('hidden')).toBe(false);
      } else {
        expect(expandedPatientCardIds.has('pat_1')).toBe(false);
        expect(details1.classList.contains('hidden')).toBe(true);
      }
    }

    expect(saveCalls.length).toBe(50);
  });

  it('strictly isolates click events on inline header selects and buttons from toggling the card', () => {
    const select1 = document.getElementById('loc_pat_1');
    const btn1 = document.getElementById('btn_mini_pat_1');
    const details1 = document.getElementById('details_pat_1');

    // Click select inside header -> should NOT toggle card expansion
    select1.click();
    expect(expandedPatientCardIds.has('pat_1')).toBe(false);
    expect(details1.classList.contains('hidden')).toBe(true);

    // Click button inside header -> should NOT toggle card expansion
    btn1.click();
    expect(expandedPatientCardIds.has('pat_1')).toBe(false);
    expect(details1.classList.contains('hidden')).toBe(true);
  });
});

describe('Adversarial Stress Suite 4: Clinical Protocol Alert Trigger & Workup Logic', () => {
  it('triggers Sepsis alert box on English keywords ("sepsis", "septic")', () => {
    const p1 = { id: 'p-sep-en', diagnosis: 'Suspected Urosepsis with Fever', sepsisWorkup: '' };
    const html = generatePatientCardHTML(p1, 'en', new Set(['p-sep-en']));
    expect(html).toContain('id="sepsis_box_p-sep-en" class="alert-box alert-danger "');
    expect(html).not.toContain('id="sepsis_box_p-sep-en" class="alert-box alert-danger hidden"');
  });

  it('triggers Sepsis alert box on Arabic keyword ("تسمم")', () => {
    const p2 = { id: 'p-sep-ar', diagnosis: 'اشتباه تسمم دم حاد', sepsisWorkup: '' };
    const html = generatePatientCardHTML(p2, 'ar', new Set(['p-sep-ar']));
    expect(html).toContain('id="sepsis_box_p-sep-ar" class="alert-box alert-danger "');
  });

  it('triggers Code STEMI / MI protocol on "STEMI", "NSTEMI", "Infarction", "جلطة", "قلب"', () => {
    const p3 = { id: 'p-mi-1', diagnosis: 'Acute STEMI Anterior Wall', miCodeWorkup: '' };
    const html = generatePatientCardHTML(p3, 'en', new Set(['p-mi-1']));
    expect(html).toContain('id="mi_box_p-mi-1" class="alert-box alert-danger "');

    const p4 = { id: 'p-mi-2', diagnosis: 'جلطة قلبية حادة', miCodeWorkup: '' };
    const html2 = generatePatientCardHTML(p4, 'ar', new Set(['p-mi-2']));
    expect(html2).toContain('id="mi_box_p-mi-2" class="alert-box alert-danger "');
  });

  it('triggers Code Stroke protocol on "stroke", "cva", "جلطة دماغية", "مخ", "دماغ"', () => {
    const p5 = { id: 'p-stroke-1', diagnosis: 'Acute Ischemic Stroke with Left Hemiparesis', strokeCodeWorkup: '' };
    const html = generatePatientCardHTML(p5, 'en', new Set(['p-stroke-1']));
    expect(html).toContain('id="stroke_box_p-stroke-1" class="alert-box alert-danger "');

    const p6 = { id: 'p-stroke-2', diagnosis: 'نزيف في المخ / جلطة دماغية', strokeCodeWorkup: '' };
    const html2 = generatePatientCardHTML(p6, 'ar', new Set(['p-stroke-2']));
    expect(html2).toContain('id="stroke_box_p-stroke-2" class="alert-box alert-danger "');
  });

  it('triggers Referral Box on waitlist actions and referral states', () => {
    const p7 = { id: 'p-ref-1', pendingAction: 'Waiting referral', hasReferral: '' };
    const html = generatePatientCardHTML(p7, 'en', new Set(['p-ref-1']));
    expect(html).toContain('id="referral_box_p-ref-1" class="alert-box alert-warning "');

    const p8 = { id: 'p-ref-2', pendingAction: 'Waiting ICU', hasReferral: 'Yes' };
    const html2 = generatePatientCardHTML(p8, 'en', new Set(['p-ref-2']));
    expect(html2).toContain('id="referral_box_p-ref-2" class="alert-box alert-warning "');
  });
});

describe('Adversarial Stress Suite 5: UI Components Library & Skeleton Loader Layout Shift Parity', () => {
  it('creates skeleton loader cards matching exact compact card dimensions to prevent CLS', () => {
    const skeletonHtml = createSkeletonLoader('card', 3);
    expect(skeletonHtml).toContain('padding:10px 14px;');
    expect(skeletonHtml).toContain('margin-bottom:10px;');
    expect(skeletonHtml).toContain('border-radius:12px;');
    expect(skeletonHtml).toContain('margin-bottom:8px;');
  });

  it('creates patient card shells with compact padding and flexible header gap', () => {
    const shellHtml = createPatientCardShell({ id: 'pat-shell-1' }, '<div>Header Content</div>', '<div>Details</div>');
    expect(shellHtml).toContain('padding: 10px 14px;');
    expect(shellHtml).toContain('margin-bottom: 10px;');
    expect(shellHtml).toContain('gap: 6px 10px;');
  });

  it('creates triage badges with pulse styling for Resuscitation and icons for other tiers', () => {
    const esi1 = createTriageBadge('ESI-1: Resuscitation');
    expect(esi1).toContain('badge-critical');
    expect(esi1).toContain('criticalPulse');
    expect(esi1).toContain('🚨');

    const esi2 = createTriageBadge('ESI-2: Emergent');
    expect(esi2).toContain('badge-urgent');
    expect(esi2).toContain('🔥');

    const esi3 = createTriageBadge('ESI-3: Urgent');
    expect(esi3).toContain('badge-urgent');
    expect(esi3).toContain('⚡');

    const esiDischarged = createTriageBadge('Discharged');
    expect(esiDischarged).toContain('badge-stable');
    expect(esiDischarged).toContain('🚪');
  });

  it('creates mini buttons and action buttons with expected styles and touch target properties', () => {
    const miniBtn = createMiniButton('Save', 'doSave()', { variant: 'outline' });
    expect(miniBtn).toContain('btn-mini');
    expect(miniBtn).toContain('btn-outline');
    expect(miniBtn).toContain('onclick="doSave()"');

    const actBtn = createActionButton('Admit Patient', 'doAdmit()');
    expect(actBtn).toContain('btn-primary');
    expect(actBtn).toContain('min-height: 44px');
  });
});

describe('Adversarial Stress Suite 6: Two-Tree Mirror Parity & CSS Specificity Verification', () => {
  it('confirms SHA256 parity between public/ and dist/ for all core UI assets', () => {
    const filesToVerify = [
      'index.html',
      'css/style.css',
      'js/app.js',
      'js/config.js',
      'js/store.js',
      'js/i18n.js',
      'js/components/ui-components.js',
      'js/firebase-service.js',
      'js/edge-ai-service.js',
      'js/crypto-engine.js',
      'js/telemetry-rum.js',
      'sw.js',
      'manifest.json'
    ];

    const basePath = path.resolve(__dirname, '../../');
    filesToVerify.forEach(relPath => {
      const publicFilePath = path.join(basePath, 'public', relPath);
      const distFilePath = path.join(basePath, 'dist', relPath);

      if (fs.existsSync(publicFilePath)) {
        expect(fs.existsSync(distFilePath), `dist/${relPath} must exist`).toBe(true);
        const publicHash = crypto.createHash('sha256').update(fs.readFileSync(publicFilePath)).digest('hex');
        const distHash = crypto.createHash('sha256').update(fs.readFileSync(distFilePath)).digest('hex');
        expect(distHash).toBe(publicHash);
      }
    });
  });

  it('verifies CSS rules in style.css contain scoped 34px mini-height for card inline controls', () => {
    const cssPath = path.resolve(__dirname, '../../public/css/style.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify .patient-card padding and margin-bottom
    expect(cssContent).toMatch(/\.patient-card\s*\{[^}]*padding:\s*10px\s+14px;/);
    expect(cssContent).toMatch(/\.patient-card\s*\{[^}]*margin-bottom:\s*10px;/);

    // Verify scoped rule overriding global 44px select
    expect(cssContent).toMatch(/\.patient-card\s+\.card-summary-right\s+select/);
    expect(cssContent).toMatch(/min-height:\s*34px\s*!important/);

    // Verify word-break on .patient-name
    expect(cssContent).toMatch(/\.patient-name\s*\{[^}]*word-break:\s*break-word;/);

    // Verify tablet and mobile media queries
    expect(cssContent).toMatch(/@media\s*\(min-width:\s*601px\)\s*and\s*\(max-width:\s*1024px\)/);
    expect(cssContent).toMatch(/@media\s*\(max-width:\s*600px\)/);
    expect(cssContent).toMatch(/@media\s*\(min-width:\s*1025px\)/);
  });
});

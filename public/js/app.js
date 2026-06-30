/**
 * =============================================================================
 * PROPRIETARY AND CONFIDENTIAL — IMC ER MANAGEMENT SYSTEM
 * Copyright (c) 2026 IMC ER Management System. All Rights Reserved.
 * 
 * LEGAL NOTICE: This software is the exclusive legal property of the IMC ER Management System owner.
 * Unauthorized access, copying, cloning, reverse-engineering, scraping, or hosting outside of
 * authorized domains is strictly prohibited and subject to civil and criminal penalties.
 * =============================================================================
 */

// Runtime Legal Ownership & Security Guard
(function verifyLegalOwnershipAndIntegrity() {
  const AUTHORIZED_DOMAINS = [
    'imc-er-manager.web.app',
    'imc-er-manager.firebaseapp.com',
    'localhost',
    '127.0.0.1'
  ];
  const currentHost = window.location.hostname;
  
  console.log(
    '%cSTOP! PROPRIETARY PROPERTY',
    'color: #ef4444; font-size: 26px; font-weight: 800; -webkit-text-stroke: 1px black;'
  );
  console.log(
    '%cThis application and its underlying source code are proprietary legal property of IMC ER Management System.\nUnauthorized cloning, scraping, inspection, or tampering is monitored and prohibited by copyright law.',
    'color: #0d9488; font-size: 13px; font-weight: 600;'
  );

  if (!AUTHORIZED_DOMAINS.includes(currentHost) && !currentHost.endsWith('.web.app')) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:#f87171;font-family:sans-serif;padding:32px;text-align:center;">
        <div style="font-size:64px;margin-bottom:16px;">🛑</div>
        <h1 style="font-size:24px;font-weight:800;margin-bottom:12px;color:#fff;">SECURITY VIOLATION: UNAUTHORIZED HOST DETECTED</h1>
        <p style="max-width:550px;color:#cbd5e1;line-height:1.6;margin-bottom:24px;">
          This web application is protected by international copyright law and trade secret protection.
          Execution on domain <strong>${currentHost}</strong> has been halted due to lack of authorization.
        </p>
        <div style="padding:12px 24px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;font-size:12px;color:#fca5a5;">
          © 2026 IMC ER Management System — All Rights Reserved
        </div>
      </div>
    `;
    throw new Error("Security Violation: Unauthorized execution domain.");
  }
})();

import { OWNER_EMAIL, MANAGER_EMAILS, ROOMS, PENDING_ACTIONS, WAITLIST_ACTIONS } from "./config.js";
import { 
  currentLang, 
  toggleLanguage as toggleLangState, 
  tr, 
  translatePendingAction, 
  translateDischargeOutcome 
} from "./i18n.js";
import { 
  initAuthListener, 
  loginWithEmail, 
  signUpWithEmail, 
  loginWithGoogle, 
  logout, 
  getUserRole, 
  createUserRecord, 
  updateUserRole, 
  subscribeToUsers, 
  subscribeToPatients, 
  registerPatient, 
  updatePatientRecord, 
  dischargePatientRecord, 
  deletePatientRecord 
} from "./firebase-service.js";

// State variables
let patientsList = [];
let usersList = [];
let activeFilter = { type: 'all', value: '' };
let isManager = false;
let isOwner = false;
let usersUnsubscribe = null;
let expandedPatientCardIds = new Set();

// Utility DOM selector helper
const $ = (id) => document.getElementById(id);
const getVal = (id) => $(id) ? $(id).value.trim() : '';

// Theme Controller
let currentTheme = localStorage.getItem('imc_theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const themeBtn = $('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.innerText = currentTheme === 'light' ? '🌙' : '☀️';
  }
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('imc_theme', currentTheme);
  initTheme();
}

/**
 * Initialize Application Lifecycle
 */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  populateRoomSelects();
  updateTranslations();
  
  // Start Auth Listener
  initAuthListener(async (user) => {
    if (user) {
      $('loading-overlay').classList.remove('hidden');
      isOwner = (user.email === OWNER_EMAIL);
      
      let role = 'pending';
      if (isOwner) {
        role = 'owner';
      } else {
        const existingRole = await getUserRole(user.uid);
        if (existingRole) {
          role = existingRole;
        } else {
          await createUserRecord(user.uid, user.email, 'pending');
        }
      }
      
      if (role === 'pending' || role === 'blocked') {
        $('loading-overlay').classList.add('hidden');
        $('auth-section').classList.add('hidden');
        $('app-section').classList.add('hidden');
        $('access-gate').classList.remove('hidden');
        $('gate-message').innerText = tr(role === 'pending' ? 'pnd' : 'blk');
        return;
      }
      
      $('access-gate').classList.add('hidden');
      $('auth-section').classList.add('hidden');
      $('app-section').classList.remove('hidden');
      
      isManager = (role === 'manager' || isOwner || MANAGER_EMAILS.includes(user.email));
      
      $('tab-manager').classList.toggle('hidden', !isManager);
      $('tab-owner').classList.toggle('hidden', !isOwner);
      
      const prefix = isOwner ? (currentLang === 'en' ? 'Own: ' : 'مالك: ') :
                     isManager ? (currentLang === 'en' ? 'Mgr: ' : 'مدير: ') :
                     (currentLang === 'en' ? 'Usr: ' : 'مستخدم: ');
      $('user-info').innerText = prefix + user.email;
      
      // Subscribe to real-time patient updates
      subscribeToPatients((patients) => {
        patientsList = patients;
        updateDashboardCounters();
        renderActivePatientList();
        if (isManager) renderShiftAnalytics();
        $('loading-overlay').classList.add('hidden');
      });
      
      // Subscribe to users if owner
      if (isOwner) {
        if (usersUnsubscribe) usersUnsubscribe();
        usersUnsubscribe = subscribeToUsers((users) => {
          usersList = users;
          const pendingCount = users.filter(u => u.role === 'pending').length;
          const badge = $('badge-pending-users');
          badge.innerText = pendingCount ? `(${pendingCount})` : '';
          badge.style.display = pendingCount ? 'inline' : 'none';
          renderAccountManagement();
        });
      }
    } else {
      $('loading-overlay').classList.add('hidden');
      $('auth-section').classList.remove('hidden');
      $('app-section').classList.add('hidden');
      $('access-gate').classList.add('hidden');
      switchTab('live-board');
      if (usersUnsubscribe) {
        usersUnsubscribe();
        usersUnsubscribe = null;
      }
    }
  });
});

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Auth actions
  $('btn-login').onclick = () => {
    loginWithEmail(getVal('auth-email'), getVal('auth-password'))
      .catch(err => showAuthError(err.message));
  };
  $('btn-signup').onclick = () => {
    signUpWithEmail(getVal('auth-email'), getVal('auth-password'))
      .catch(err => showAuthError(err.message));
  };
  $('btn-google').onclick = () => {
    loginWithGoogle().catch(err => showAuthError(err.message));
  };
  $('btn-app-logout').onclick = () => logout();
  $('btn-gate-logout').onclick = () => logout();
  
  // Navigation & Theme & Language
  const themeBtn = $('btn-theme-toggle');
  if (themeBtn) themeBtn.onclick = toggleTheme;

  $('btn-lang-toggle').onclick = () => {
    toggleLangState();
    updateTranslations();
  };
  
  $('tab-live-board').onclick = () => switchTab('live-board');
  $('tab-manager').onclick = () => switchTab('manager');
  $('tab-owner').onclick = () => switchTab('owner');
  
  // Registration Modal
  $('btn-open-register').onclick = () => {
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    $('reg-time').value = localIso;
    $('reg-age-display').innerText = '';
    $('modal-register').classList.remove('hidden');
  };
  
  $('reg-national-id').oninput = () => {
    $('reg-age-display').innerText = calculateAgeAndGender(getVal('reg-national-id'));
  };
  
  $('btn-submit-register').onclick = async () => {
    const name = getVal('reg-name');
    const hospitalId = getVal('reg-hospital-id').toUpperCase();
    const nationalId = getVal('reg-national-id');
    const location = getVal('reg-room');
    const time = getVal('reg-time');
    
    if (!/^[\u0600-\u06FF\s]+$/.test(name)) {
      return alert(currentLang === 'en' ? 'Arabic Name Only.' : 'الاسم عربي فقط.');
    }
    if (!/^[A-Z]\d{9}$/.test(hospitalId)) {
      return alert(currentLang === 'en' ? 'ID: 1 Letter + 9 Nums.' : 'حرف + 9 أرقام.');
    }
    if (nationalId && !/^\d{14}$/.test(nationalId)) {
      return alert(currentLang === 'en' ? 'NID: 14 Digits.' : 'القومي: 14 رقم.');
    }
    
    try {
      await registerPatient({
        name,
        nationalId,
        patientId: hospitalId,
        location,
        registrationTime: time
      });
      $('reg-name').value = '';
      $('reg-hospital-id').value = '';
      $('reg-national-id').value = '';
      $('modal-register').classList.add('hidden');
    } catch (err) {
      alert(err.message);
    }
  };
  
  // Discharge Modal
  $('btn-submit-discharge').onclick = async () => {
    const outcome = getVal('discharge-outcome-select');
    const patientId = getVal('discharge-patient-id');
    if (!outcome || !patientId) return;
    try {
      await dischargePatientRecord(patientId, outcome);
      $('modal-discharge').classList.add('hidden');
    } catch (err) {
      alert(err.message);
    }
  };
  
  // Data Control Buttons in Manager Tab
  $('btn-delete-discharged').onclick = () => confirmAndDeletePatients(false);
  $('btn-delete-all').onclick = () => confirmAndDeletePatients(true);
  
  // Modal background click close
  window.onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.add('hidden');
    }
  };
  
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.modal-overlay').classList.add('hidden');
    };
  });

  // Analytics admissions dropdown toggle
  $('analytics-admissions-header').onclick = () => {
    $('analytics-admissions-body').classList.toggle('hidden');
  };

  // Setup time filters
  [4, 6, 12, 24, 48, 72].forEach(hours => {
    const el = $(`filter-time-${hours}`);
    if (el) el.onclick = () => applyFilter('time', hours);
  });

  // Setup waitlist filters
  [
    { id: 'filter-wait-icu', val: 'Waiting ICU' },
    { id: 'filter-wait-ccu', val: 'Waiting CCU' },
    { id: 'filter-wait-picu', val: 'Waiting PICU' },
    { id: 'filter-wait-ward', val: 'Waiting ward' }
  ].forEach(item => {
    const el = $(item.id);
    if (el) el.onclick = () => applyFilter('action', item.val);
  });
}

/**
 * UI Helper Functions
 */
function showAuthError(msg) {
  const el = $('auth-error');
  el.innerText = msg;
  el.style.display = 'block';
}

function switchTab(tabName) {
  if ((tabName === 'manager' && !isManager) || (tabName === 'owner' && !isOwner)) return;
  
  ['live-board', 'manager', 'owner'].forEach(t => {
    const tabBtn = $(`tab-${t}`);
    const viewEl = $(`view-${t}`);
    if (tabBtn && viewEl) {
      tabBtn.classList.toggle('active', t === tabName);
      viewEl.classList.toggle('hidden', t !== tabName);
    }
  });
  if (tabName === 'manager' && isManager) renderShiftAnalytics();
  if (tabName === 'owner' && isOwner) renderAccountManagement();
}

function populateRoomSelects() {
  const regSelect = $('reg-room');
  if (regSelect) {
    regSelect.innerHTML = ROOMS.map(r => `<option value="${r}">${r}</option>`).join('');
  }
}

function updateTranslations() {
  document.documentElement.dir = currentLang === 'en' ? 'ltr' : 'rtl';
  $('btn-lang-toggle').innerText = currentLang === 'en' ? 'عربي' : 'English';
  
  document.querySelectorAll('[data-i]').forEach(el => {
    el.innerText = tr(el.dataset.i);
  });
  document.querySelectorAll('[data-p]').forEach(el => {
    el.placeholder = tr(el.dataset.p);
  });
  
  // Re-render lists to update language
  updateDashboardCounters();
  renderActivePatientList();
  if (isManager) renderShiftAnalytics();
  if (isOwner) renderAccountManagement();
}

function calculateAgeAndGender(nid) {
  if (!/^\d{14}$/.test(nid)) return '--';
  const century = nid[0] === '2' ? 1900 : (nid[0] === '3' ? 2000 : 0);
  if (!century) return '--';
  const year = century + parseInt(nid.substr(1, 2), 10);
  const birthDate = new Date(year, parseInt(nid.substr(3, 2), 10) - 1, parseInt(nid.substr(5, 2), 10));
  const age = ~~((new Date() - birthDate) / 315576e5);
  const isMale = parseInt(nid[12], 10) % 2 !== 0;
  return `${isMale ? tr('ml') : tr('fm')} | ${age} ${tr('yr')}`;
}

function formatElapsedHours(timeStr) {
  return timeStr ? (Date.now() - new Date(timeStr).getTime()) / 36e5 : 0;
}

function formatDurationString(startTime, endTime) {
  if (!startTime) return '--';
  const diff = (endTime ? new Date(endTime).getTime() : Date.now()) - new Date(startTime).getTime();
  const hours = ~~(diff / 36e5);
  const mins = ~~((diff % 36e5) / 6e4);
  return currentLang === 'en' ? `${hours}h ${mins}m` : `${hours}س ${mins}د`;
}

/**
 * Filter Management
 */
function applyFilter(type, value) {
  if (activeFilter.type === type && activeFilter.value === value) {
    activeFilter = { type: 'all', value: '' };
  } else {
    activeFilter = { type, value };
  }
  
  document.querySelectorAll('.metric-card').forEach(el => el.classList.remove('active'));
  
  let activeId = '';
  if (activeFilter.type === 'time') activeId = `filter-time-${activeFilter.value}`;
  if (activeFilter.type === 'action') {
    if (activeFilter.value.includes('ICU')) activeId = 'filter-wait-icu';
    else if (activeFilter.value.includes('CCU')) activeId = 'filter-wait-ccu';
    else if (activeFilter.value.includes('PICU')) activeId = 'filter-wait-picu';
    else activeId = 'filter-wait-ward';
  }
  if (activeFilter.type === 'room') {
    // Handled dynamically in renderRoomsGrid
  }
  
  if (activeId && $(activeId)) $(activeId).classList.add('active');
  
  updateDashboardCounters();
  renderActivePatientList();
}

/**
 * Render Counters & Rooms Grid
 */
function updateDashboardCounters() {
  const activePatients = patientsList.filter(p => !p.isDischarged);
  
  const timeCounts = { 4: 0, 6: 0, 12: 0, 24: 0, 48: 0, 72: 0 };
  const waitCounts = { icu: 0, ccu: 0, picu: 0, ward: 0 };
  const roomCounts = {};
  ROOMS.forEach(r => roomCounts[r] = 0);
  
  activePatients.forEach(p => {
    if (p.pendingAction === 'Waiting ICU') waitCounts.icu++;
    if (p.pendingAction === 'Waiting CCU') waitCounts.ccu++;
    if (p.pendingAction === 'Waiting PICU') waitCounts.picu++;
    if (p.pendingAction === 'Waiting ward') waitCounts.ward++;
    
    if (roomCounts[p.location] !== undefined) roomCounts[p.location]++;
    
    const elapsed = formatElapsedHours(p.registrationTime);
    for (const h of [72, 48, 24, 12, 6, 4]) {
      if (elapsed >= h) {
        timeCounts[h]++;
        break;
      }
    }
  });
  
  $('count-wait-icu').innerText = waitCounts.icu;
  $('count-wait-ccu').innerText = waitCounts.ccu;
  $('count-wait-picu').innerText = waitCounts.picu;
  $('count-wait-ward').innerText = waitCounts.ward;
  
  [4, 6, 12, 24, 48, 72].forEach(h => {
    const el = $(`count-time-${h}`);
    if (el) el.innerText = timeCounts[h];
  });
  
  // Render rooms grid
  const roomsGrid = $('rooms-grid');
  if (roomsGrid) {
    roomsGrid.innerHTML = ROOMS.map(roomName => {
      const isSelected = activeFilter.type === 'room' && activeFilter.value === roomName;
      return `
        <div class="metric-card card-room ${isSelected ? 'active' : ''}" data-room="${roomName}">
          <h3>📍 ${roomName}</h3>
          <div class="count">${roomCounts[roomName]}</div>
        </div>
      `;
    }).join('');
    
    roomsGrid.querySelectorAll('.card-room').forEach(card => {
      card.onclick = () => applyFilter('room', card.dataset.room);
    });
  }
}

/**
 * Render Active Patient List
 */
function renderActivePatientList() {
  const container = $('patient-list-container');
  if (!container) return;
  
  const activePatients = patientsList.filter(p => !p.isDischarged);
  let filtered = [];
  let titleText = "";
  
  if (activeFilter.type === 'room') {
    filtered = activePatients.filter(p => p.location === activeFilter.value);
    titleText = "📍 " + activeFilter.value;
  } else if (activeFilter.type === 'action') {
    filtered = activePatients.filter(p => p.pendingAction === activeFilter.value);
    titleText = "📋 " + translatePendingAction(activeFilter.value);
  } else if (activeFilter.type === 'time') {
    const hours = activeFilter.value;
    const maxHours = hours === 72 ? 9999 : hours === 48 ? 72 : hours === 24 ? 48 : hours === 12 ? 24 : hours === 6 ? 12 : 6;
    titleText = `⏱ > ${hours} ${currentLang === 'en' ? 'Hrs' : 'س'}`;
    filtered = activePatients.filter(p => {
      const h = formatElapsedHours(p.registrationTime);
      return h >= hours && h < maxHours;
    });
  } else {
    filtered = activePatients;
    titleText = tr('allP');
  }
  
  $('list-header-title').innerText = titleText;
  $('list-header-count').innerText = filtered.length;
  
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-list">${tr('nD')}</div>`;
    return;
  }
  
  sortedPatients = filtered.sort((a, b) => new Date(a.registrationTime || 0) - new Date(b.registrationTime || 0));
  
  const PRIMARY_DEPARTMENTS = [
    { en: 'Internal Medicine', ar: 'باطنة' },
    { en: 'General Surgery', ar: 'جراحة عامة' },
    { en: 'Cardiology', ar: 'قلب' },
    { en: 'Neurology', ar: 'مخ وأعصاب' },
    { en: 'Pediatrics', ar: 'أطفال' },
    { en: 'Orthopedics', ar: 'عظام' },
    { en: 'Neurosurgery', ar: 'جراحة مخ وأعصاب' },
    { en: 'Obstetrics & Gynecology', ar: 'نساء وتوليد' }
  ];
  const standardDepts = PRIMARY_DEPARTMENTS.map(d => d.en).concat(PRIMARY_DEPARTMENTS.map(d => d.ar));
  
  container.innerHTML = sortedPatients.map(p => {
    const isCustomDept = p.primaryDepartment && !standardDepts.includes(p.primaryDepartment);
    const isCustomAction = !PENDING_ACTIONS.includes(p.pendingAction);
    const isWaitlistAction = WAITLIST_ACTIONS.includes(p.pendingAction);
    const diagStr = String(p.diagnosis || '');
    const isSepsisSuspected = diagStr.toLowerCase().includes('sepsis') || diagStr.includes('تسمم');
    const isMiSuspected = diagStr.toLowerCase().includes('stemi') || /\bmi\b/i.test(diagStr) || diagStr.includes('MI') || diagStr.toLowerCase() === 'mi';
    const isStrokeSuspected = diagStr.toLowerCase().includes('stroke');
    const regDateFormatted = p.registrationTime ? new Date(p.registrationTime).toLocaleString(currentLang === 'en' ? 'en-GB' : 'ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const safeName = String(p.name || '').replace(/['"]/g, "&quot;");
    const matchDept = PRIMARY_DEPARTMENTS.find(d => d.en === p.primaryDepartment || d.ar === p.primaryDepartment);
    const displayDept = matchDept ? (currentLang === 'en' ? matchDept.en : matchDept.ar) : (p.primaryDepartment || '');
    const isExpanded = expandedPatientCardIds.has(p.id);
    
    return `
      <div class="patient-card">
        <div class="card-header" data-id="${p.id}">
          <div class="card-summary-left">
            <div class="patient-name" dir="${currentLang === 'en' ? 'ltr' : 'rtl'}">${safeName}</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px;">
              <span class="hospital-id">#${p.patientId || '--'}</span>
              <span id="header_age_${p.id}" class="age-badge" style="margin:0;padding:2px 8px;font-size:11px;">${calculateAgeAndGender(p.nationalId || '')}</span>
              <span class="duration-badge" style="margin:0;padding:2px 8px;font-size:11px;">⏱ ${formatDurationString(p.registrationTime)}</span>
              <span style="font-size:12px;color:var(--text-muted);font-weight:600;">📅 ${regDateFormatted}</span>
            </div>
          </div>
          
          <div class="card-summary-right">
            <div class="card-summary-tags" style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:6px;">
              <select id="loc_${p.id}" class="btn-mini location-tag quick-loc-select" data-id="${p.id}" title="${currentLang === 'en' ? 'Room Location' : 'الغرفة'}" style="font-size:11px;padding:3px 6px;border-radius:6px;max-width:105px;margin:0;">
                ${ROOMS.map(r => `<option value="${r}" ${p.location === r ? 'selected' : ''}>📍 ${r}</option>`).join('')}
              </select>
              <div style="display:inline-flex;gap:4px;align-items:center;margin:0;" onclick="event.stopPropagation();">
                <select id="dept_sel_${p.id}" class="btn-mini location-tag quick-dept-select ${isCustomDept ? 'hidden' : ''}" data-id="${p.id}" style="font-size:11px;padding:3px 6px;border-radius:6px;max-width:130px;margin:0;background:rgba(13,148,136,0.25);border-color:var(--primary);color:var(--primary);font-weight:700;" title="${currentLang === 'en' ? 'Primary Department' : 'القسم الأساسي'}">
                  <option value="">🏥 ${currentLang === 'en' ? 'Dept...' : 'القسم...'}</option>
                  ${PRIMARY_DEPARTMENTS.map(d => {
                    const isSel = (p.primaryDepartment === d.en || p.primaryDepartment === d.ar);
                    return `<option value="${d.en}" ${isSel ? 'selected' : ''}>🏥 ${currentLang === 'en' ? d.en : d.ar}</option>`;
                  }).join('')}
                  <option value="Other..." ${isCustomDept ? 'selected' : ''}>✏️ ${currentLang === 'en' ? 'Other...' : 'أخرى...'}</option>
                </select>
                <input type="text" id="custom_dept_${p.id}" class="btn-mini location-tag ${isCustomDept ? '' : 'hidden'}" style="font-size:11px;padding:3px 6px;border-radius:6px;margin:0;width:95px;background:rgba(13,148,136,0.25);border-color:var(--primary);color:var(--primary);font-weight:700;" placeholder="🏥 ${currentLang === 'en' ? 'Dept...' : 'القسم...'}" value="${isCustomDept ? (p.primaryDepartment || '') : ''}" data-id="${p.id}">
                <button type="button" class="btn btn-mini btn-outline ${isCustomDept ? '' : 'hidden'}" id="btn_reset_dept_${p.id}" data-id="${p.id}" title="Back to presets" style="padding:2px 6px;margin:0;font-size:11px;">📋</button>
              </div>
            </div>
            <div class="pending-action-badge">${translatePendingAction(p.pendingAction)}</div>
          </div>
        </div>
        
        <div id="details_${p.id}" class="card-details ${isExpanded ? '' : 'hidden'}">
          <details class="edit-reg-details" style="margin-bottom:16px;border:1px dashed var(--border-color);border-radius:12px;padding:10px 14px;background:rgba(15,23,42,0.3);">
            <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--primary);outline:none;user-select:none;">
              ✏️ ${currentLang === 'en' ? 'Edit Registration Demographics (Name, ID, Time)' : 'تعديل بيانات التسجيل الأساسية (الاسم، الهوية، الوقت)'}
            </summary>
            <div class="details-grid-top" style="margin-top:14px;margin-bottom:0;">
              <div>
                <label class="field-label" style="margin-top:0;">${tr('lN') || 'Name'}</label>
                <input type="text" id="name_${p.id}" value="${safeName}" dir="${currentLang === 'en' ? 'ltr' : 'rtl'}" class="input-field" style="margin:0;" data-id="${p.id}" data-field="name" placeholder="${tr('nm') || 'Name'}">
              </div>
              <div>
                <label class="field-label" style="margin-top:0;">${tr('lH') || 'Hospital ID'}</label>
                <input type="text" id="hosp_${p.id}" value="${p.patientId || ''}" class="input-field" style="margin:0;" placeholder="${tr('hS')}" data-id="${p.id}" data-field="patientId">
              </div>
              <div>
                <label class="field-label" style="margin-top:0;">${tr('lT') || 'Time'}</label>
                <input type="datetime-local" id="regtime_${p.id}" value="${(p.registrationTime || '').slice(0, 16)}" class="input-field" style="margin:0;" data-id="${p.id}" data-field="registrationTime">
              </div>
            </div>
            <div style="margin-top:12px;">
              <label class="field-label" style="margin-top:0;">${tr('lI') || 'National ID'}</label>
              <input type="text" inputmode="numeric" pattern="[0-9]*" id="nid_${p.id}" value="${p.nationalId || ''}" class="input-field" style="margin:0;width:100%;" placeholder="${tr('nS')}" data-id="${p.id}" data-field="nationalId">
            </div>
          </details>
          
          <div class="details-grid-mid">
            <div>
              <label class="field-label">${tr('dg')}</label>
              <input type="text" id="diag_${p.id}" value="${String(p.diagnosis || '').replace(/['"]/g, "&quot;")}" class="input-field" data-id="${p.id}" data-field="diagnosis">
            </div>
            <div>
              <label class="field-label">${tr('sX')}</label>
              <input type="text" id="supp_${p.id}" value="${String(p.supportiveTx || '').replace(/['"]/g, "&quot;")}" class="input-field" data-id="${p.id}" data-field="supportiveTx">
            </div>
          </div>
          
          <div class="details-grid-bottom">
            <div>
              <label class="field-label">${tr('aC')}</label>
              <div style="display:flex;gap:6px;align-items:center;">
                <select id="action_${p.id}" class="select-action ${isCustomAction ? 'hidden' : ''}" data-id="${p.id}" data-field="pendingAction" style="flex:1;width:100%;">
                  ${PENDING_ACTIONS.map(a => `<option value="${a}" ${p.pendingAction === a ? 'selected' : ''}>${translatePendingAction(a)}</option>`).join('')}
                  <option value="Custom..." ${isCustomAction ? 'selected' : ''}>✏️ ${tr('pS')}...</option>
                </select>
                <input type="text" id="custom_action_${p.id}" class="input-custom-action ${isCustomAction ? '' : 'hidden'}" style="flex:1;margin:0;width:100%;" placeholder="${tr('pS')}" value="${isCustomAction ? p.pendingAction : ''}" data-id="${p.id}" data-field="customAction">
                <button type="button" class="btn btn-mini btn-outline ${isCustomAction ? '' : 'hidden'}" id="btn_reset_action_${p.id}" data-id="${p.id}" title="Back to presets" style="padding:10px 12px;margin:0;">📋</button>
              </div>
            </div>
            
            <div class="workup-boxes">
              <div id="referral_box_${p.id}" class="alert-box alert-warning ${isWaitlistAction ? '' : 'hidden'}">
                <label class="alert-label">${tr('rL')}</label>
                <select id="ref_${p.id}" class="select-alert select-warning" data-id="${p.id}" data-field="hasReferral">
                  <option value="" ${!p.hasReferral ? 'selected' : ''}>--</option>
                  <option value="Yes" ${p.hasReferral === 'Yes' ? 'selected' : ''}>${tr('y')}</option>
                  <option value="No" ${p.hasReferral === 'No' ? 'selected' : ''}>${tr('n')}</option>
                </select>
              </div>
              
              <div id="sepsis_box_${p.id}" class="alert-box alert-danger ${isSepsisSuspected ? '' : 'hidden'}">
                <label class="alert-label">${tr('sW')}</label>
                <select id="sepsis_${p.id}" class="select-alert select-danger" data-id="${p.id}" data-field="sepsisWorkup">
                  <option value="" ${!p.sepsisWorkup ? 'selected' : ''}>--</option>
                  <option value="Yes" ${p.sepsisWorkup === 'Yes' ? 'selected' : ''}>${tr('y')}</option>
                  <option value="No" ${p.sepsisWorkup === 'No' ? 'selected' : ''}>${tr('n')}</option>
                </select>
              </div>

              <div id="mi_box_${p.id}" class="alert-box alert-danger ${isMiSuspected ? '' : 'hidden'}" style="border-color:#e11d48;background:rgba(225,29,72,0.15);">
                <label class="alert-label" style="color:#f43f5e;">🫀 ${currentLang === 'en' ? 'MI Code' : 'كود جلطة القلب'}</label>
                <select id="mi_${p.id}" class="select-alert select-danger" data-id="${p.id}" data-field="miCodeWorkup">
                  <option value="" ${!p.miCodeWorkup ? 'selected' : ''}>--</option>
                  <option value="Yes" ${p.miCodeWorkup === 'Yes' ? 'selected' : ''}>${tr('y')}</option>
                  <option value="No" ${p.miCodeWorkup === 'No' ? 'selected' : ''}>${tr('n')}</option>
                </select>
              </div>

              <div id="stroke_box_${p.id}" class="alert-box alert-warning ${isStrokeSuspected ? '' : 'hidden'}" style="border-color:#f97316;background:rgba(249,115,22,0.15);">
                <label class="alert-label" style="color:#fb923c;">🧠 ${currentLang === 'en' ? 'Stroke Code' : 'كود جلطة المخ'}</label>
                <select id="stroke_${p.id}" class="select-alert select-warning" data-id="${p.id}" data-field="strokeCodeWorkup">
                  <option value="" ${!p.strokeCodeWorkup ? 'selected' : ''}>--</option>
                  <option value="Yes" ${p.strokeCodeWorkup === 'Yes' ? 'selected' : ''}>${tr('y')}</option>
                  <option value="No" ${p.strokeCodeWorkup === 'No' ? 'selected' : ''}>${tr('n')}</option>
                </select>
              </div>
            </div>
          </div>
          
          <button class="btn btn-danger btn-discharge-trigger" data-id="${p.id}" data-name="${safeName}">${tr('dB')}</button>
        </div>
      </div>
    `;
  }).join('');
  
  attachPatientListHandlers();
}

let sortedPatients = [];

async function savePatientCardFields(cardId) {
  if (!cardId || !$(`details_${cardId}`)) return;
  const actionSelect = $(`action_${cardId}`);
  const isCustomHidden = actionSelect ? actionSelect.classList.contains('hidden') : false;
  const actionSelectVal = getVal(`action_${cardId}`);
  const finalAction = (isCustomHidden || actionSelectVal === 'Custom...') ? (getVal(`custom_action_${cardId}`) || 'Other') : actionSelectVal;
  
  const deptSelect = $(`dept_sel_${cardId}`);
  const isCustomDeptHidden = deptSelect ? deptSelect.classList.contains('hidden') : false;
  const deptSelectVal = getVal(`dept_sel_${cardId}`);
  const finalDept = (isCustomDeptHidden || deptSelectVal === 'Other...') ? (getVal(`custom_dept_${cardId}`) || '') : deptSelectVal;
  
  const regTimeVal = getVal(`regtime_${cardId}`);
  const updateData = {
    name: getVal(`name_${cardId}`),
    patientId: getVal(`hosp_${cardId}`).toUpperCase(),
    nationalId: getVal(`nid_${cardId}`),
    location: getVal(`loc_${cardId}`),
    diagnosis: getVal(`diag_${cardId}`),
    supportiveTx: getVal(`supp_${cardId}`),
    primaryDepartment: finalDept,
    pendingAction: finalAction,
    hasReferral: (!$(`referral_box_${cardId}`).classList.contains('hidden')) ? getVal(`ref_${cardId}`) : '',
    sepsisWorkup: (!$(`sepsis_box_${cardId}`).classList.contains('hidden')) ? getVal(`sepsis_${cardId}`) : '',
    miCodeWorkup: (!$(`mi_box_${cardId}`).classList.contains('hidden')) ? getVal(`mi_${cardId}`) : '',
    strokeCodeWorkup: (!$(`stroke_box_${cardId}`).classList.contains('hidden')) ? getVal(`stroke_${cardId}`) : ''
  };
  if (regTimeVal) {
    updateData.registrationTime = regTimeVal;
  }
  try {
    await updatePatientRecord(cardId, updateData);
  } catch (err) {
    console.error("Failed to auto-save collapsed card:", err);
  }
}

function attachPatientListHandlers() {
  // Accordion toggle with automatic save & single-card open mode
  document.querySelectorAll('.card-header').forEach(header => {
    header.onclick = async () => {
      const id = header.dataset.id;
      const detailsEl = $(`details_${id}`);
      if (!detailsEl) return;
      
      const isCurrentlyHidden = detailsEl.classList.contains('hidden');
      if (isCurrentlyHidden) {
        // Auto save and collapse all other currently open cards
        expandedPatientCardIds.forEach(prevId => {
          if (prevId !== id) {
            savePatientCardFields(prevId);
            const prevDetails = $(`details_${prevId}`);
            if (prevDetails) prevDetails.classList.add('hidden');
            expandedPatientCardIds.delete(prevId);
          }
        });
        detailsEl.classList.remove('hidden');
        expandedPatientCardIds.add(id);
      } else {
        // Collapse and auto save this card
        savePatientCardFields(id);
        detailsEl.classList.add('hidden');
        expandedPatientCardIds.delete(id);
      }
    };
  });
  
  // NID age calculation live update
  document.querySelectorAll('[id^="nid_"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      const headerAgeEl = $(`header_age_${id}`);
      const text = calculateAgeAndGender(e.target.value);
      if (headerAgeEl) headerAgeEl.innerText = text;
    });
  });
  
  // Sepsis / MI / Stroke detection live toggle
  document.querySelectorAll('[id^="diag_"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      const sepsisBox = $(`sepsis_box_${id}`);
      const miBox = $(`mi_box_${id}`);
      const strokeBox = $(`stroke_box_${id}`);
      const valLower = e.target.value.toLowerCase();
      if (sepsisBox) {
        sepsisBox.classList.toggle('hidden', !(valLower.includes('sepsis') || valLower.includes('تسمم')));
      }
      if (miBox) {
        const val = e.target.value;
        const isMi = val.toLowerCase().includes('stemi') || /\bmi\b/i.test(val) || val.includes('MI') || val.toLowerCase() === 'mi';
        miBox.classList.toggle('hidden', !isMi);
      }
      if (strokeBox) {
        strokeBox.classList.toggle('hidden', !valLower.includes('stroke'));
      }
    });
  });
  
  // Quick location dropdown in small card
  document.querySelectorAll('.quick-loc-select').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      if (!id) return;
      try {
        await updatePatientRecord(id, { location: e.target.value });
        triggerFlashAnimation(e.target);
      } catch (err) {
        console.error("Failed to update location:", err);
      }
    });
  });

  // Action dropdown toggle custom input & referral box
  document.querySelectorAll('[id^="action_"]').forEach(select => {
    select.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const customInput = $(`custom_action_${id}`);
      const resetBtn = $(`btn_reset_action_${id}`);
      const referralBox = $(`referral_box_${id}`);
      if (customInput && resetBtn) {
        const isCustom = e.target.value === 'Custom...';
        select.classList.toggle('hidden', isCustom);
        customInput.classList.toggle('hidden', !isCustom);
        resetBtn.classList.toggle('hidden', !isCustom);
        if (isCustom) customInput.focus();
      }
      if (referralBox) {
        referralBox.classList.toggle('hidden', !WAITLIST_ACTIONS.includes(e.target.value));
      }
    });
  });

  // Quick department dropdown in header
  document.querySelectorAll('.quick-dept-select').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      if (!id || e.target.value === 'Other...') return;
      try {
        await updatePatientRecord(id, { primaryDepartment: e.target.value });
        triggerFlashAnimation(e.target);
      } catch (err) {
        console.error("Failed to update department:", err);
      }
    });
  });

  // Department dropdown toggle custom input
  document.querySelectorAll('[id^="dept_sel_"]').forEach(select => {
    select.addEventListener('click', (e) => e.stopPropagation());
    select.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      const customInput = $(`custom_dept_${id}`);
      const resetBtn = $(`btn_reset_dept_${id}`);
      if (customInput && resetBtn) {
        const isCustom = e.target.value === 'Other...';
        select.classList.toggle('hidden', isCustom);
        customInput.classList.toggle('hidden', !isCustom);
        resetBtn.classList.toggle('hidden', !isCustom);
        if (isCustom) customInput.focus();
      }
    });
  });

  document.querySelectorAll('[id^="custom_dept_"]').forEach(inp => {
    inp.addEventListener('click', (e) => e.stopPropagation());
  });

  // Reset action back to presets
  document.querySelectorAll('[id^="btn_reset_action_"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const select = $(`action_${id}`);
      const customInput = $(`custom_action_${id}`);
      if (select && customInput) {
        select.value = PENDING_ACTIONS[0];
        select.classList.remove('hidden');
        customInput.classList.add('hidden');
        btn.classList.add('hidden');
        select.dispatchEvent(new Event('change'));
      }
    });
  });

  // Reset department back to presets
  document.querySelectorAll('[id^="btn_reset_dept_"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const select = $(`dept_sel_${id}`);
      const customInput = $(`custom_dept_${id}`);
      if (select && customInput) {
        select.value = 'Internal Medicine';
        customInput.value = '';
        select.classList.remove('hidden');
        customInput.classList.add('hidden');
        btn.classList.add('hidden');
        select.dispatchEvent(new Event('change'));
      }
    });
  });

  // Save changes on change
  document.querySelectorAll('.card-details input, .card-details select, [id^="custom_dept_"]').forEach(el => {
    el.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      if (!id) return;
      if ((e.target.id.startsWith('action_') && e.target.value === 'Custom...') ||
          (e.target.id.startsWith('dept_sel_') && e.target.value === 'Other...')) {
        return; // Don't trigger auto-save or re-render when revealing the custom input!
      }
      
      const actionSelect = $(`action_${id}`);
      const isCustomHidden = actionSelect ? actionSelect.classList.contains('hidden') : false;
      const actionSelectVal = getVal(`action_${id}`);
      const finalAction = (isCustomHidden || actionSelectVal === 'Custom...') ? (getVal(`custom_action_${id}`) || 'Other') : actionSelectVal;
      
      const deptSelect = $(`dept_sel_${id}`);
      const isCustomDeptHidden = deptSelect ? deptSelect.classList.contains('hidden') : false;
      const deptSelectVal = getVal(`dept_sel_${id}`);
      const finalDept = (isCustomDeptHidden || deptSelectVal === 'Other...') ? (getVal(`custom_dept_${id}`) || '') : deptSelectVal;
      
      const regTimeVal = getVal(`regtime_${id}`);
      const updateData = {
        name: getVal(`name_${id}`),
        patientId: getVal(`hosp_${id}`).toUpperCase(),
        nationalId: getVal(`nid_${id}`),
        location: getVal(`loc_${id}`),
        diagnosis: getVal(`diag_${id}`),
        supportiveTx: getVal(`supp_${id}`),
        primaryDepartment: finalDept,
        pendingAction: finalAction,
        hasReferral: (!$(`referral_box_${id}`).classList.contains('hidden')) ? getVal(`ref_${id}`) : '',
        sepsisWorkup: (!$(`sepsis_box_${id}`).classList.contains('hidden')) ? getVal(`sepsis_${id}`) : '',
        miCodeWorkup: (!$(`mi_box_${id}`).classList.contains('hidden')) ? getVal(`mi_${id}`) : '',
        strokeCodeWorkup: (!$(`stroke_box_${id}`).classList.contains('hidden')) ? getVal(`stroke_${id}`) : ''
      };
      if (regTimeVal) {
        updateData.registrationTime = regTimeVal;
      }
      
      try {
        await updatePatientRecord(id, updateData);
        triggerFlashAnimation(e.target);
      } catch (err) {
        console.error("Failed to update record:", err);
      }
    });
  });

  // Discharge trigger buttons
  document.querySelectorAll('.btn-discharge-trigger').forEach(btn => {
    btn.onclick = () => {
      $('discharge-patient-name').innerText = btn.dataset.name || '--';
      $('discharge-patient-id').value = btn.dataset.id;
      $('discharge-outcome-select').value = "";
      $('modal-discharge').classList.remove('hidden');
    };
  });
}

function triggerFlashAnimation(element) {
  if (element.tagName === 'SELECT') return;
  element.classList.remove('flash-anim');
  void element.offsetWidth; // trigger reflow
  element.classList.add('flash-anim');
}

/**
 * Render Shift Analytics (Manager View)
 */
function renderShiftAnalytics() {
  const now = new Date();
  const shiftStart = new Date(now);
  shiftStart.setHours(8, 0, 0, 0);
  if (now.getHours() < 8) {
    shiftStart.setDate(shiftStart.getDate() - 1);
  }
  
  let totalVisits = 0;
  let totalAdmissions = 0;
  let admWard = 0, admIcu = 0, admCcu = 0, admPicu = 0;
  let improved = 0, mortality = 0, dama = 0;
  
  const dischargedPatients = patientsList.filter(p => p.isDischarged);
  
  // Total visits: Anyone registered during shift OR currently active OR discharged during shift
  patientsList.forEach(p => {
    const regTime = new Date(p.registrationTime || 0).getTime();
    const disTime = p.dischargeTime ? new Date(p.dischargeTime).getTime() : regTime;
    const isShiftActivity = regTime >= shiftStart.getTime() || disTime >= shiftStart.getTime() || !p.isDischarged;
    
    if (isShiftActivity) {
      totalVisits++;
    }
    
    // Shift Outcomes: Count if discharged during this shift
    if (p.isDischarged && disTime >= shiftStart.getTime()) {
      const outcome = p.dischargeOutcome;
      if (outcome) {
        if (outcome.includes('Admission')) {
          totalAdmissions++;
          if (outcome.includes('Ward')) admWard++;
          else if (outcome.includes('PICU')) admPicu++;
          else if (outcome.includes('ICU')) admIcu++;
          else if (outcome.includes('CCU')) admCcu++;
        } else if (outcome === 'Death') {
          mortality++;
        } else if (outcome === 'DAMA') {
          dama++;
        } else {
          improved++;
        }
      }
    }
  });
  
  $('stat-total-visits').innerText = totalVisits;
  $('stat-admissions').innerText = totalAdmissions;
  $('stat-adm-ward').innerText = admWard;
  $('stat-adm-icu').innerText = admIcu;
  $('stat-adm-ccu').innerText = admCcu;
  $('stat-adm-picu').innerText = admPicu;
  $('stat-improved').innerText = improved;
  $('stat-mortality').innerText = mortality;
  $('stat-dama').innerText = dama;
  
  const container = $('discharged-list-container');
  if (container) {
    if (dischargedPatients.length === 0) {
      container.innerHTML = `<div class="empty-list">${tr('nD')}</div>`;
    } else {
      const sortedDischarged = dischargedPatients.sort((a, b) => 
        new Date(b.dischargeTime || b.registrationTime || 0) - new Date(a.dischargeTime || a.registrationTime || 0)
      );
      
      container.innerHTML = sortedDischarged.map(p => `
        <div class="patient-card" style="cursor:default;">
          <div class="card-header" style="cursor:default;">
            <div class="card-summary-left">
              <div class="patient-name" dir="${currentLang === 'en' ? 'ltr' : 'rtl'}">${String(p.name || '--').replace(/['"]/g, "&quot;")}</div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px;">
                <span class="hospital-id">#${p.patientId || '--'}</span>
              </div>
            </div>
            <div class="card-summary-right">
              <div class="card-summary-tags">
                <span class="badge" style="margin:0;padding:4px 10px;font-size:12px;background:var(--primary);color:#fff;border-radius:8px;font-weight:700;">
                  ${translateDischargeOutcome(p.dischargeOutcome || '--')}
                </span>
                <span class="time-badge" style="background:var(--card-bg);border:1px solid var(--border-color);color:var(--text-main);">
                  ⏱ ${formatDurationString(p.registrationTime, p.dischargeTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
}

async function confirmAndDeletePatients(deleteAll) {
  const msg = currentLang === 'en' 
    ? (deleteAll ? "Are you sure you want to delete ALL patient records?" : "Are you sure you want to delete all discharged patient records?")
    : (deleteAll ? "هل أنت متأكد من حذف جميع سجلات المرضى؟" : "هل أنت متأكد من حذف جميع سجلات المرضى المغادرين؟");
  if (!confirm(msg)) return;
  const targets = deleteAll ? patientsList : patientsList.filter(p => p.isDischarged);
  for (const p of targets) {
    try {
      await deletePatientRecord(p.id);
    } catch (err) {
      console.error(err);
    }
  }
  updateDashboardCounters();
  renderActivePatientList();
  renderShiftAnalytics();
}

/**
 * Render Account Management (Owner View)
 */
function renderAccountManagement() {
  const container = $('users-list-container');
  if (!container) return;
  
  const filteredUsers = usersList.filter(u => u.email !== OWNER_EMAIL);
  container.innerHTML = filteredUsers.map(u => {
    const roleColor = u.role === 'pending' ? 'var(--warning)' : u.role === 'blocked' ? 'var(--danger)' : 'var(--primary)';
    return `
      <div class="user-card">
        <div class="user-card-header">
          <span>${u.email}</span>
          <span style="color: ${roleColor}; font-weight: 800;">${u.role.toUpperCase()}</span>
        </div>
        <select class="select-role" data-id="${u.id}">
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>${tr('uU')}</option>
          <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>${tr('uM')}</option>
          <option value="pending" ${u.role === 'pending' ? 'selected' : ''}>${tr('uP')}</option>
          <option value="blocked" ${u.role === 'blocked' ? 'selected' : ''}>${tr('uB')}</option>
        </select>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.select-role').forEach(select => {
    select.onchange = async (e) => {
      await updateUserRole(e.target.dataset.id, e.target.value);
    };
  });
}

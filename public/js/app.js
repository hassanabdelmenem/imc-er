/**
 * Main Application Controller & UI Logic
 */

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

/**
 * Initialize Application Lifecycle
 */
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  populateRoomSelects();
  
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
  
  // Navigation & Language
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
  
  container.innerHTML = sortedPatients.map(p => {
    const isCustomAction = !PENDING_ACTIONS.includes(p.pendingAction);
    const isWaitlistAction = WAITLIST_ACTIONS.includes(p.pendingAction);
    const isSepsisSuspected = (p.diagnosis || '').toLowerCase().includes('sepsis') || (p.diagnosis || '').includes('تسمم');
    const regDateFormatted = p.registrationTime ? new Date(p.registrationTime).toLocaleString(currentLang === 'en' ? 'en-GB' : 'ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const safeName = (p.name || '').replace(/['"]/g, "&quot;");
    const isExpanded = expandedPatientCardIds.has(p.id);
    
    return `
      <div class="patient-card">
        <div class="card-header" data-id="${p.id}">
          <div class="header-top">
            <div class="patient-name" dir="rtl">${safeName}</div>
            <div class="duration-badge">⏱ ${formatDurationString(p.registrationTime)}</div>
          </div>
          <div class="header-bottom">
            <div class="hospital-id">${p.patientId || '--'}</div>
            <div class="location-tag">📍 ${p.location || '--'}</div>
            <div class="pending-action">${translatePendingAction(p.pendingAction)}</div>
          </div>
        </div>
        
        <div id="details_${p.id}" class="card-details ${isExpanded ? '' : 'hidden'}">
          <div class="details-grid-top">
            <input type="text" id="name_${p.id}" value="${safeName}" dir="rtl" class="input-name" data-id="${p.id}" data-field="name">
            <div id="age_${p.id}" class="age-display">${calculateAgeAndGender(p.nationalId || '')}</div>
            <div class="reg-time-static">⏱ ${formatDurationString(p.registrationTime)}</div>
            
            <input type="text" id="hosp_${p.id}" value="${p.patientId || ''}" class="input-field" placeholder="${tr('hS')}" data-id="${p.id}" data-field="patientId">
            <div class="reg-date-static">📅 ${regDateFormatted}</div>
            <input type="text" inputmode="numeric" pattern="[0-9]*" id="nid_${p.id}" value="${p.nationalId || ''}" class="input-field" placeholder="${tr('nS')}" data-id="${p.id}" data-field="nationalId">
          </div>
          
          <select id="loc_${p.id}" class="select-room btn-primary" data-id="${p.id}" data-field="location">
            ${ROOMS.map(r => `<option value="${r}" ${p.location === r ? 'selected' : ''}>${tr('rS')}: ${r}</option>`).join('')}
          </select>
          
          <div class="details-grid-mid">
            <div>
              <label class="field-label">${tr('dg')}</label>
              <input type="text" id="diag_${p.id}" value="${(p.diagnosis || '').replace(/['"]/g, "&quot;")}" class="input-field" data-id="${p.id}" data-field="diagnosis">
            </div>
            <div>
              <label class="field-label">${tr('sX')}</label>
              <input type="text" id="supp_${p.id}" value="${(p.supportiveTx || '').replace(/['"]/g, "&quot;")}" class="input-field" data-id="${p.id}" data-field="supportiveTx">
            </div>
          </div>
          
          <div class="details-grid-bottom">
            <div>
              <label class="field-label">${tr('aC')}</label>
              <select id="action_${p.id}" class="select-action" data-id="${p.id}" data-field="pendingAction">
                ${PENDING_ACTIONS.map(a => `<option value="${a}" ${p.pendingAction === a ? 'selected' : ''}>${translatePendingAction(a)}</option>`).join('')}
                <option value="Custom..." ${isCustomAction ? 'selected' : ''}>${tr('pS')}</option>
              </select>
              <input type="text" id="custom_action_${p.id}" class="input-custom-action ${isCustomAction ? '' : 'hidden'}" placeholder="${tr('pS')}" value="${isCustomAction ? p.pendingAction : ''}" data-id="${p.id}" data-field="customAction">
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

function attachPatientListHandlers() {
  // Accordion toggle
  document.querySelectorAll('.card-header').forEach(header => {
    header.onclick = () => {
      const id = header.dataset.id;
      const detailsEl = $(`details_${id}`);
      if (detailsEl) {
        detailsEl.classList.toggle('hidden');
        if (!detailsEl.classList.contains('hidden')) {
          expandedPatientCardIds.add(id);
        } else {
          expandedPatientCardIds.delete(id);
        }
      }
    };
  });
  
  // NID age calculation live update
  document.querySelectorAll('[id^="nid_"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      const ageEl = $(`age_${id}`);
      if (ageEl) ageEl.innerText = calculateAgeAndGender(e.target.value);
    });
  });
  
  // Sepsis detection live toggle
  document.querySelectorAll('[id^="diag_"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      const sepsisBox = $(`sepsis_box_${id}`);
      const valLower = e.target.value.toLowerCase();
      if (sepsisBox) {
        sepsisBox.classList.toggle('hidden', !(valLower.includes('sepsis') || valLower.includes('تسمم')));
      }
    });
  });
  
  // Action dropdown toggle custom input & referral box
  document.querySelectorAll('[id^="action_"]').forEach(select => {
    select.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const customInput = $(`custom_action_${id}`);
      const referralBox = $(`referral_box_${id}`);
      if (customInput) {
        customInput.classList.toggle('hidden', e.target.value !== 'Custom...');
      }
      if (referralBox) {
        referralBox.classList.toggle('hidden', !WAITLIST_ACTIONS.includes(e.target.value));
      }
    });
  });

  // Save changes on change
  document.querySelectorAll('.card-details input, .card-details select').forEach(el => {
    el.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      if (!id) return;
      
      const actionSelectVal = getVal(`action_${id}`);
      const finalAction = actionSelectVal === 'Custom...' ? (getVal(`custom_action_${id}`) || 'Other') : actionSelectVal;
      
      const updateData = {
        name: getVal(`name_${id}`),
        patientId: getVal(`hosp_${id}`).toUpperCase(),
        nationalId: getVal(`nid_${id}`),
        location: getVal(`loc_${id}`),
        diagnosis: getVal(`diag_${id}`),
        supportiveTx: getVal(`supp_${id}`),
        pendingAction: finalAction,
        hasReferral: (!$(`referral_box_${id}`).classList.contains('hidden')) ? getVal(`ref_${id}`) : '',
        sepsisWorkup: (!$(`sepsis_box_${id}`).classList.contains('hidden')) ? getVal(`sepsis_${id}`) : ''
      };
      
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
  
  patientsList.filter(p => new Date(p.registrationTime).getTime() >= shiftStart.getTime()).forEach(p => {
    totalVisits++;
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
    const sortedDischarged = dischargedPatients.sort((a, b) => 
      new Date(b.dischargeTime || b.registrationTime || 0) - new Date(a.dischargeTime || a.registrationTime || 0)
    );
    
    container.innerHTML = sortedDischarged.map(p => `
      <div class="patient-card card-discharged">
        <div class="discharged-header">
          <div class="patient-name" dir="rtl">${p.name || '--'}</div>
          <div class="duration-badge badge-danger">⏱ ${formatDurationString(p.registrationTime, p.dischargeTime)}</div>
        </div>
        <div class="discharged-body">
          <div class="hospital-id">${p.patientId || '--'}</div>
          <div class="outcome-text">${translateDischargeOutcome(p.dischargeOutcome || '--')}</div>
        </div>
      </div>
    `).join('');
  }
}

async function confirmAndDeletePatients(deleteAll) {
  if (!confirm("DELETE?")) return;
  const targets = deleteAll ? patientsList : patientsList.filter(p => p.isDischarged);
  for (const p of targets) {
    try {
      await deletePatientRecord(p.id);
    } catch (err) {
      console.error(err);
    }
  }
  if (deleteAll) {
    activeFilter = { type: 'all', value: '' };
    updateDashboardCounters();
    renderActivePatientList();
  }
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

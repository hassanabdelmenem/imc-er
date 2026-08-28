/**
 * =============================================================================
 * PROPRIETARY AND CONFIDENTIAL — IMC ER MANAGEMENT SYSTEM
 * Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * 
 * LEGAL NOTICE: This software is the exclusive legal property of SEVENSN.
 * Unauthorized access, copying, cloning, reverse-engineering, scraping, or hosting outside of
 * authorized domains is strictly prohibited and subject to civil and criminal penalties.
 * =============================================================================
 */

// Runtime Legal Ownership & Security Guard
(function verifyLegalOwnershipAndIntegrity() {
  // NOTE: the lockout screen below uses literal brand hex values rather than CSS
  // custom properties on purpose — it must render correctly even if the
  // stylesheets failed to load, which is exactly the state this guard defends.
  const AUTHORIZED_DOMAINS = [
    'imc-er-manager.web.app',
    'imc-er-manager.firebaseapp.com',
    'localhost',
    '127.0.0.1'
  ];
  const currentHost = window.location.hostname;
  
  console.log(
    '%cSTOP! PROPRIETARY PROPERTY',
    'color: #e5675a; font-size: 26px; font-weight: 800; -webkit-text-stroke: 1px black;'
  );
  console.log(
    '%cThis application and its underlying source code are proprietary legal property of SEVENSN.\nUnauthorized cloning, scraping, inspection, or tampering is monitored and prohibited by copyright law.',
    'color: #6fa8dc; font-size: 13px; font-weight: 600;'
  );

  if (!AUTHORIZED_DOMAINS.includes(currentHost) && !currentHost.endsWith('.web.app')) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#10161d;color:#e5675a;font-family:sans-serif;padding:32px;text-align:center;">
        <div style="font-size:64px;margin-bottom:16px;">🛑</div>
        <h1 style="font-size:24px;font-weight:800;margin-bottom:12px;color:#f2f6fa;">SECURITY VIOLATION: UNAUTHORIZED HOST DETECTED</h1>
        <p style="max-width:550px;color:#a9b9c9;line-height:1.6;margin-bottom:24px;">
          This web application is protected by international copyright law and trade secret protection.
          Execution on domain <strong>${currentHost}</strong> has been halted due to lack of authorization.
        </p>
        <div style="padding:12px 24px;background:rgba(229,103,90,0.15);border:1px solid rgba(229,103,90,0.4);border-radius:8px;font-size:12px;color:#e5675a;">
          © 2026 SEVENSN — All Rights Reserved
        </div>
      </div>
    `;
    throw new Error("Security Violation: Unauthorized execution domain.");
  }
})();

import "./store.js?v=20260802";
import {
  OWNER_EMAILS,
  ROLE_OWNER,
  CLINICAL_ROLES,
  ASSIGNABLE_ROLES,
  MANAGER_TIER_ROLES,
  LEGACY_ROLES,
  ROOMS,
  PENDING_ACTIONS,
  WAITLIST_ACTIONS
} from "./config.js?v=20260802";
import {
  currentLang,
  toggleLanguage as toggleLangState,
  tr,
  translateRole,
  translatePendingAction,
  translateDischargeOutcome
} from "./i18n.js?v=20260802";
import {
  auth,
  initAuthListener,
  loginWithEmail,
  signUpWithEmail,
  loginWithGoogle,
  logout,
  getUserRole,
  ensureUserRecord,
  recordDeadLetter,
  recordTelemetryAlert,
  subscribeToRemoteConfig,
  completeRedirectSignIn,
  isRedirectSignInPending,
  updateUserRole,
  deleteUserRecord, 
  subscribeToUsers, 
  subscribeToPatients, 
  registerPatient, 
  updatePatientRecord, 
  dischargePatientRecord, 
  deletePatientRecord,
  batchDeletePatientRecords
} from "./firebase-service.js?v=20260706_02";

// State variables
let patientsList = [];
let usersList = [];
let activeFilter = { type: 'all', value: '' };
let isManager = false;
let isOwner = false;
let usersUnsubscribe = null;
let patientsUnsubscribe = null;
let expandedPatientCardIds = new Set();

// Remote Config & Kill-Switch state (Phase 9)
window.AppRemoteConfig = {
    enable_edge_ai_synthesis: true,
    enable_batch_purge: true
};
let unsubscribeRemoteConfig = null;

/**
 * Show or hide the purge controls for the current role and kill-switch state.
 *
 * Toggles the `hidden` class rather than assigning style.display. The design
 * system sets `display: inline-flex !important` on `.btn`, which beats any
 * inline display an element carries — so `style.display = 'none'` left these
 * buttons on screen and clickable no matter what the kill-switch said. `.hidden`
 * is also `!important`, at equal specificity, and style.css loads after the
 * design system, so it wins on source order.
 */
function applyRemoteConfigUI() {
    const purgeEnabled = window.AppRemoteConfig?.enable_batch_purge !== false;

    const btnDisch = $('btn-delete-discharged');
    if (btnDisch) {
        btnDisch.classList.toggle('hidden', !(purgeEnabled && (isManager || isOwner)));
    }
    const btnAll = $('btn-delete-all');
    if (btnAll) {
        btnAll.classList.toggle('hidden', !(purgeEnabled && isOwner));
    }
}

/**
 * Subscribe to the live kill-switches.
 *
 * Both branches of the previous implementation were gated on
 * `typeof firebase !== 'undefined'` — the compat global. This app imports the
 * modular SDK only, so that global never exists and neither branch ever ran:
 * window.AppRemoteConfig stayed on its hardcoded defaults for the life of the
 * page, and flipping a switch to shut off purging during an incident did
 * nothing whatsoever.
 *
 * The source is the Firestore document /settings/remote_config, which the rules
 * already expose to clinical staff for reading and to the owner for writing. It
 * needs no extra SDK and no project configuration this repo does not have; see
 * DEPLOYMENT_MANIFEST for why Firebase Remote Config proper is not the source.
 */
function startRemoteConfigSync() {
    if (unsubscribeRemoteConfig) { unsubscribeRemoteConfig(); unsubscribeRemoteConfig = null; }

    unsubscribeRemoteConfig = subscribeToRemoteConfig((data) => {
        if (typeof data.enable_edge_ai_synthesis === 'boolean') {
            window.AppRemoteConfig.enable_edge_ai_synthesis = data.enable_edge_ai_synthesis;
        }
        if (typeof data.enable_batch_purge === 'boolean') {
            window.AppRemoteConfig.enable_batch_purge = data.enable_batch_purge;
        }
        applyRemoteConfigUI();
    });
}

// Utility DOM selector helper
const $ = (id) => document.getElementById(id);
const getVal = (id) => $(id) ? $(id).value.trim() : '';
const esc = (str) => { if (str === null || str === undefined) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };
const secLog = (msg, err) => { if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') { console.error(msg, err); } else { console.error(msg, err ? (err.code || err.message || "Security Sanitized Error") : ''); } };

/**
 * Accessible modal dialog helpers (WAI-ARIA APG "Dialog (Modal)" pattern).
 *
 * Every modal-overlay in index.html carries role="dialog" + aria-modal="true"
 * statically, but that markup alone does nothing for keyboard/screen-reader
 * users unless focus actually moves into the dialog, stays trapped there
 * while it's open, and returns to whatever triggered it on close. Previously
 * every open/close call site here was a bare `.classList.add/remove('hidden')`
 * — visually correct, but focus stayed wherever it was (often back on body),
 * so keyboard users could tab straight through to page content sitting
 * underneath the modal. These two functions are the single choke point for
 * every modal open/close in the app so that behaviour is fixed everywhere at
 * once instead of per-modal.
 */
const modalDialogState = new WeakMap();

function getFocusableEls(container) {
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null);
}

function openModalDialog(overlay) {
  if (!overlay) return;
  const dialog = overlay.querySelector('.modal-content') || overlay;
  const trigger = document.activeElement;
  overlay.classList.remove('hidden');

  // Move focus into the dialog — the first *meaningful* focusable field if
  // there is one, otherwise the dialog shell itself (it carries
  // tabindex="-1" for this). The "×" close control is always the first
  // element in DOM order but is skipped here on purpose: landing a keyboard
  // user on "close this form" the instant they open a registration form is
  // more likely to be an accidental dismissal than a useful starting point.
  // It's still the first stop going backwards (Shift+Tab) and still part of
  // the trap either way.
  const focusable = getFocusableEls(dialog).filter(el => !el.classList.contains('close-modal'));
  (focusable[0] || dialog).focus({ preventScroll: true });

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModalDialog(overlay);
      return;
    }
    if (e.key !== 'Tab') return;
    const items = getFocusableEls(dialog);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    // Wrap Tab/Shift+Tab at the dialog's edges so focus can never leak onto
    // the page content behind the modal overlay.
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  overlay.addEventListener('keydown', onKeydown);
  modalDialogState.set(overlay, { trigger, onKeydown });
}

function closeModalDialog(overlay) {
  if (!overlay || overlay.classList.contains('hidden')) return;
  overlay.classList.add('hidden');
  const state = modalDialogState.get(overlay);
  if (state) {
    overlay.removeEventListener('keydown', state.onKeydown);
    // Return focus to whatever opened this dialog (e.g. "Register Patient"),
    // not just to <body> — otherwise a keyboard user's next Tab press starts
    // back at the top of the page instead of where they left off.
    if (state.trigger && typeof state.trigger.focus === 'function') {
      state.trigger.focus({ preventScroll: true });
    }
    modalDialogState.delete(overlay);
  }
}

/**
 * Owner check, matching firestore.rules exactly.
 *
 * This used to strip every dot from both addresses before comparing, which
 * collapsed far more than the intended Gmail spellings: `owner@imc.com`,
 * `own.er@imc.com` and `owner@imcc.om` all normalised to the same string — and
 * that last one is a different registrable domain. Anyone able to receive mail
 * there was treated as the owner by the client.
 *
 * The rules never agreed: isOwner() there tests `token.email in ownerEmails()`,
 * an exact match, so an impostor got the Owner tab and account-management UI
 * while every read and write was denied — a broken shell rather than a breach,
 * and only by the rules' good judgement. The client now applies the same test.
 * Both Gmail spellings the owner actually uses are already enumerated in
 * OWNER_EMAILS, so normalisation bought nothing that the list does not.
 */
const normalizeEmail = (e) => e ? String(e).trim().toLowerCase() : '';
const checkIfOwner = (email) => {
  const target = normalizeEmail(email);
  return target !== '' && OWNER_EMAILS.some(o => normalizeEmail(o) === target);
};

/**
 * Manager tier = owner + the three leadership roles. Unlike the previous
 * implementation this is driven purely by the assigned role (plus the hardcoded
 * owner allowlist) — there is no longer an email allowlist that silently grants
 * elevated access to addresses the owner never approved in the UI.
 */
const checkIfManager = (email, role) => checkIfOwner(email) || MANAGER_TIER_ROLES.includes(role);

/**
 * Classify patient triage urgency for CSS data-triage attribute.
 * Maps location/status/pendingAction to: Red, Yellow, Green, Discharged.
 */
function getTriageCategory(patient) {
    if (!patient) return 'Green';
    const loc = (patient.location || patient.department || '').toLowerCase();
    const status = (patient.status || '').toLowerCase();
    const action = (patient.pendingAction || '').toLowerCase();
    const diag = (patient.diagnosis || '').toLowerCase();

    if (patient.isDischarged || status === 'discharged') return 'Discharged';
    if (patient._esi && patient._esi.label) return patient._esi.label;
    if (loc.includes('arrest') || status.includes('arrest') || status.includes('critical') ||
        status.includes('code blue') || action.includes('arrest') ||
        diag.includes('sepsis') || diag.includes('septic') || diag.includes('stemi') ||
        diag.includes('cardiac arrest') || diag.includes('code blue')) {
        return 'Red';
    }
    if (action.includes('waiting icu') || action.includes('waiting ccu') ||
        action.includes('waiting picu') || action.includes('waiting nicu') ||
        action.includes('waiting ward') || action.includes('waiting referral') ||
        action.includes('referral') || status.includes('urgent') ||
        diag.includes('nstemi') || diag.includes('stroke') || diag.includes('cva')) {
        return 'Yellow';
    }
    return 'Green';
}

// Primary Clinical Departments (Responsible Specialty / Service in ER)
const PRIMARY_DEPARTMENTS = [
  { en: 'Emergency Medicine (ER)', ar: 'طب الطوارئ' },
  { en: 'Internal Medicine', ar: 'باطنة' },
  { en: 'Cardiology / CCU', ar: 'قلب / رعاية قلبية' },
  { en: 'Neurology / Stroke', ar: 'مخ وأعصاب / جلطات' },
  { en: 'Orthopedics & Trauma', ar: 'عظام وإصابات' },
  { en: 'General Surgery', ar: 'جراحة عامة' },
  { en: 'Pulmonology / Chest', ar: 'صدر' },
  { en: 'Pediatrics', ar: 'أطفال' },
  { en: 'Obstetrics & Gynecology', ar: 'نساء وتوليد' },
  { en: 'Oncology', ar: 'أورام' },
  { en: 'Nephrology', ar: 'كلى' },
  { en: 'Gastroenterology', ar: 'جهاز هضمي وكبد' },
  { en: 'Rheumatology', ar: 'روماتيزم' },
  { en: 'Hematology', ar: 'أمراض دم' },
  { en: 'Dermatology', ar: 'جلدية' },
  { en: 'Urology', ar: 'مسالك بولية' },
  { en: 'Neurosurgery', ar: 'جراحة مخ وأعصاب' },
  { en: 'Cardiothoracic Surgery', ar: 'جراحة قلب وصدر' },
  { en: 'Vascular Surgery', ar: 'جراحة أوعية دموية' },
  { en: 'Plastic Surgery', ar: 'جراحة تجميل' },
  { en: 'ENT / Otolaryngology', ar: 'أنف وأذن وحنجرة' },
  { en: 'Ophthalmology', ar: 'عيون' },
  { en: 'Maxillofacial Surgery', ar: 'جراحة فكين ووجه' },
  { en: 'Intensive Care (ICU)', ar: 'رعاية مركزة' },
  { en: 'Anesthesiology', ar: 'تخدير' }
];
const standardDepts = PRIMARY_DEPARTMENTS.map(d => d.en).concat(PRIMARY_DEPARTMENTS.map(d => d.ar));

// Theme & Density Controller
let currentTheme = localStorage.getItem('imc_theme') || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const themeBtn = $('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.innerText = currentTheme === 'light' ? '🌙' : '☀️';
    themeBtn.setAttribute('aria-label', currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
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
  window.addEventListener('scroll', () => {
    const headers = document.querySelectorAll('header, .app-header, .nav-bar');
    headers.forEach(h => {
      if (window.scrollY > 10) h.classList.add('scrolled');
      else h.classList.remove('scrolled');
    });
  }, { passive: true });
  
  let authFired = false;
  setTimeout(() => {
    // Never hand the login form to someone who is mid-redirect: they came back
    // from Google seconds ago and the credential is still being processed.
    if (!authFired && !isRedirectSignInPending()) {
      console.warn("Notice: Auth listener timed out. Hiding loading overlay.");
      const overlay = $('loading-overlay');
      if (overlay) overlay.classList.add('hidden');
      if ($('auth-section')) $('auth-section').classList.remove('hidden');
      if ($('app-section')) $('app-section').classList.add('hidden');
    }
  }, 4000);

  // Finish any redirect sign-in before anything concludes the user is signed
  // out. This round trip was never completed or inspected, so a redirect that
  // came back empty just re-rendered the login form — and the user signed in
  // again, and again.
  completeRedirectSignIn().then((res) => {
    // Nothing was in flight, so nothing was held back and the auth listener
    // owns the UI. Taking over here would race it, and now that this resolves
    // immediately on an ordinary load it would flash the login form at a user
    // whose session is still being restored.
    if (!res.attempted) return;

    if (res.error) {
      showAuthError(res.error.message);
    } else if (res.failedSilently) {
      // Offering the Google button again here would repeat the identical
      // failure, which is exactly the loop. Say what happened and point at the
      // path that still works.
      showAuthError(tr('gLoop'));
    }
    if (!res.user && !auth.currentUser) showSignedOut();
  });

  // Start Auth Listener
  initAuthListener(async (user) => {
    authFired = true;
    if (user) {
      $('loading-overlay').classList.remove('hidden');
      isOwner = checkIfOwner(user.email);
      let claimRole = null;
      try {
        const tokenRes = await user.getIdTokenResult(true);
        if (tokenRes && tokenRes.claims && tokenRes.claims.role) {
          claimRole = tokenRes.claims.role;
        }
      } catch (e) {
        console.warn("Notice: Could not refresh token claims:", e);
      }
      
      let role = 'pending';
      if (isOwner || claimRole === ROLE_OWNER) {
        role = ROLE_OWNER;
        isOwner = true;
        const ownerRecord = await ensureUserRecord(user.uid, user.email, ROLE_OWNER);
        if (!ownerRecord.ok) {
          console.warn("Notice: Could not write owner record to Firestore:", ownerRecord.error);
        }
      } else {
        let existingRole = null;
        try {
          existingRole = await getUserRole(user.uid);
        } catch (err) {
          // The lookup itself failed, so we do not know whether this account
          // has ever been registered. Say that, rather than parking the user
          // at a "pending approval" screen for a request nobody can see.
          showAccessGate('unreachable');
          return;
        }

        if (existingRole === 'blocked') {
          // A block must survive re-authentication. The previous build deleted
          // and recreated the record as 'pending' here, which silently undid
          // every block the owner applied.
          role = 'blocked';
        } else if (existingRole && LEGACY_ROLES.includes(existingRole)) {
          // Roles retired in the 2026 restructure: demote to pending so the
          // owner re-assigns deliberately instead of inheriting stale access.
          role = 'pending';
          updateUserRole(user.uid, 'pending').catch(() => {});
        } else if (existingRole && ASSIGNABLE_ROLES.includes(existingRole)) {
          role = existingRole;
        } else {
          // No record, or a record holding a role that grants nothing: this
          // account is an access request. Filing it is what puts the user in
          // front of the owner, so a failure here is reported, not shrugged
          // off — an unwritten request is indistinguishable, to the owner,
          // from a user who never signed up at all.
          role = 'pending';
          const filed = await ensureUserRecord(user.uid, user.email, 'pending');
          if (!filed.ok) {
            showAccessGate('unfiled');
            return;
          }
        }
      }

      // Patient data is PHI — only approved staff reach the board. `pending`
      // accounts wait at the gate until the owner assigns them a role.
      if (role === 'blocked' || role === 'pending') {
        showAccessGate(role);
        return;
      }

      $('access-gate').classList.add('hidden');
      $('auth-section').classList.add('hidden');
      $('loading-overlay').classList.add('hidden');
      $('app-section').classList.remove('hidden');

      isManager = checkIfManager(user.email, role);
      isOwner = role === ROLE_OWNER || checkIfOwner(user.email);

      // Give telemetry a real Firestore writer. Deferred to here on purpose:
      // firestore.rules admits these collections to approved clinical staff
      // only, so installing it earlier would turn every buffered event into a
      // permission-denied. setSink() flushes whatever queued during load.
      if (window.TelemetryRUM && typeof window.TelemetryRUM.setSink === 'function') {
        window.TelemetryRUM.setUser(user.uid);
        window.TelemetryRUM.setSink((collectionName, entry) =>
          collectionName === 'dead_letter_queue'
            ? recordDeadLetter(entry)
            : recordTelemetryAlert(entry));
      }

      if ($('data-control-actions')) {
        $('data-control-actions').style.display = (isManager || isOwner) ? 'flex' : 'none';
        $('data-control-actions').classList.toggle('hidden', !(isManager || isOwner));
      }
      if ($('tab-owner')) $('tab-owner').classList.toggle('hidden', !isOwner);

      if ($('user-info')) $('user-info').innerText = `${translateRole(role)} · ${user.email}`;
      
      // Subscribe to real-time patient updates
      if (patientsUnsubscribe) {
        patientsUnsubscribe();
        patientsUnsubscribe = null;
      }
      patientsUnsubscribe = subscribeToPatients((patients) => {
        patientsList = patients;
        if (window.NanostoreClinicalStore && window.NanostoreClinicalStore.activePatientsStore) {
          window.NanostoreClinicalStore.activePatientsStore.set(patients);
          // patientCountStore is computed — do NOT call .set() on it; it auto-updates
        }
        if (window.EdgeAIClinicalEngine && typeof window.EdgeAIClinicalEngine.calculateESI === 'function') {
          patients.forEach(p => {
            p._esi = window.EdgeAIClinicalEngine.calculateESI(p, p.vitals || []);
          });
          const criticals = patients.filter(p => !p.isDischarged && p._esi && (p._esi.level === 'ESI-1' || p._esi.level === 'ESI-2'));
          if (criticals.length > 0 && window.NanostoreClinicalStore?.activeSentinelAlert) {
            const worst = criticals.reduce((prev, curr) => (curr._esi.score < prev._esi.score) ? curr : prev, criticals[0]);
            window.NanostoreClinicalStore.activeSentinelAlert.set({
              patient: worst,
              level: worst._esi.label,
              reasons: [worst._esi.reason || worst._esi.label]
            });
          } else if (window.NanostoreClinicalStore?.activeSentinelAlert) {
            window.NanostoreClinicalStore.activeSentinelAlert.set(null);
          }
        }
        updateDashboardCounters();
        renderActivePatientList();
        renderShiftAnalytics();
        startRemoteConfigSync();
        $('loading-overlay').classList.add('hidden');
        // Remove any prior error banners on successful data load
        const errBanner = document.getElementById('firestore-error-banner');
        if (errBanner) errBanner.remove();
      }, (err) => {
        secLog("Failed to load patients:", err);
        $('loading-overlay').classList.add('hidden');
        // Show visible error banner so the user knows data failed to load
        if (!document.getElementById('firestore-error-banner')) {
          const banner = document.createElement('div');
          banner.id = 'firestore-error-banner';
          banner.setAttribute('role', 'alert');
          banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--danger);color:var(--on-error);padding:12px 24px;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 8px 25px var(--danger-glow);display:flex;align-items:center;gap:12px;';
          banner.innerHTML = '<span>⚠️ Failed to load patients from Firestore. Check connection &amp; security rules.</span><span class="banner-dismiss" role="button" tabindex="0" aria-label="Dismiss" style="text-decoration:underline;cursor:pointer;white-space:nowrap;">Dismiss</span>';
          const dismiss = () => banner.remove();
          banner.querySelector('.banner-dismiss').onclick = dismiss;
          banner.querySelector('.banner-dismiss').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismiss(); }
          });
          document.body.appendChild(banner);
        }
      });
      
      // Subscribe to users if owner
      if (isOwner) {
        if (usersUnsubscribe) usersUnsubscribe();
        usersUnsubscribe = subscribeToUsers((users) => {
          usersList = users;
          // Badge and queue are derived from the same partition, so the count
          // on the tab can never disagree with what the Owner tab lists.
          const pendingCount = partitionAccounts(users).pending.length;
          const badge = $('badge-pending-users');
          if (badge) {
            badge.innerText = pendingCount ? `(${pendingCount})` : '';
            badge.style.display = pendingCount ? 'inline' : 'none';
          }
          renderAccountManagement();
        });
      } else {
        if (usersUnsubscribe) {
          usersUnsubscribe();
          usersUnsubscribe = null;
        }
        usersList = [];
        const usersContainer = $('users-list-container');
        if (usersContainer) {
          usersContainer.innerHTML = '';
        }
        const badge = $('badge-pending-users');
        if (badge) {
          badge.innerText = '';
          badge.style.display = 'none';
        }
      }
    } else if (isRedirectSignInPending()) {
      // onAuthStateChanged always reports null once before a redirect
      // credential has been processed. Rendering the login form on that first
      // null is what asked returning users to type their password a second
      // time, mid-flight. Hold the overlay; completeRedirectSignIn() decides.
      $('loading-overlay').classList.remove('hidden');
    } else {
      showSignedOut();
    }
  });
});

/** Render the signed-out state. */
function showSignedOut() {
  if (window.TelemetryRUM && typeof window.TelemetryRUM.clearSink === 'function') {
    window.TelemetryRUM.clearSink();
  }
  patientsList = [];
  usersList = [];
  isManager = false;
  isOwner = false;
  if (usersUnsubscribe) {
    usersUnsubscribe();
    usersUnsubscribe = null;
  }
  if (patientsUnsubscribe) {
    patientsUnsubscribe();
    patientsUnsubscribe = null;
  }
  if (unsubscribeRemoteConfig) {
    unsubscribeRemoteConfig();
    unsubscribeRemoteConfig = null;
  }
  if (window.NanostoreClinicalStore && window.NanostoreClinicalStore.activePatientsStore) {
    window.NanostoreClinicalStore.activePatientsStore.set([]);
  }
  if (window.NanostoreClinicalStore && window.NanostoreClinicalStore.activeSentinelAlert) {
    window.NanostoreClinicalStore.activeSentinelAlert.set(null);
  }
  const usersContainer = $('users-list-container');
  if (usersContainer) {
    usersContainer.innerHTML = '';
  }
  const badge = $('badge-pending-users');
  if (badge) {
    badge.innerText = '';
    badge.style.display = 'none';
  }
  if ($('tab-owner')) $('tab-owner').classList.add('hidden');
  if ($('data-control-actions')) {
    $('data-control-actions').style.display = 'none';
    $('data-control-actions').classList.add('hidden');
  }

  updateDashboardCounters();
  renderActivePatientList();
  renderShiftAnalytics();
  $('loading-overlay').classList.add('hidden');
  $('auth-section').classList.remove('hidden');
  $('app-section').classList.add('hidden');
  $('access-gate').classList.add('hidden');
  switchTab('live-board');
}

export function setupEventListeners() {
  // Auth actions
  if ($('btn-login')) $('btn-login').onclick = () => {
    loginWithEmail(getVal('auth-email'), getVal('auth-password'))
      .catch(err => showAuthError(err.message));
  };
  if ($('btn-signup')) $('btn-signup').onclick = () => {
    signUpWithEmail(getVal('auth-email'), getVal('auth-password'))
      .catch(err => showAuthError(err.message));
  };
  if ($('btn-google')) $('btn-google').onclick = () => {
    loginWithGoogle().catch(err => showAuthError(err.message));
  };
  if ($('btn-app-logout')) $('btn-app-logout').onclick = () => logout();
  if ($('btn-gate-logout')) $('btn-gate-logout').onclick = () => logout();
  if ($('btn-gate-retry')) $('btn-gate-retry').onclick = retryAccessRequest;
  
  // Navigation & Theme & Language
  const themeBtn = $('btn-theme-toggle');
  if (themeBtn) themeBtn.onclick = toggleTheme;

  if ($('btn-lang-toggle')) $('btn-lang-toggle').onclick = () => {
    toggleLangState();
    updateTranslations();
  };

  // Keyboard support for filter/metric cards (LOS tiles, waitlist tiles, room
  // cards, admissions dropdown header) -- these are non-button elements with
  // role="button" + tabindex="0"; Enter/Space triggers the same handler a
  // click already runs. Delegated on document so it also covers room cards,
  // which are re-rendered dynamically after every board update.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const target = e.target.closest('[role="button"]');
    if (!target || typeof target.onclick !== 'function') return;
    e.preventDefault();
    target.click();
  });

  const searchInp = $('patient-search-input');
  if (searchInp) {
    searchInp.addEventListener('input', () => {
      renderActivePatientList();
      // Scoped to the search box's own input event on purpose, rather than
      // living inside renderActivePatientList itself — that function also
      // re-runs on every real-time Firestore snapshot, and turning every one
      // of those into a screen-reader announcement would bury the one that
      // actually matters (the result of something the user just typed).
      const announcer = $('search-results-announcer');
      const countEl = $('list-header-count');
      if (announcer && countEl) {
        const n = countEl.innerText;
        announcer.innerText = searchInp.value.trim()
          ? (currentLang === 'en' ? `${n} patients match` : `${n} مريض مطابق`)
          : '';
      }
    });
  }

  if ($('tab-live-board')) $('tab-live-board').onclick = () => switchTab('live-board');
  if ($('tab-owner')) $('tab-owner').onclick = () => switchTab('owner');
  
  // Registration Modal
  if ($('btn-open-register')) $('btn-open-register').onclick = () => {
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    $('reg-time').value = localIso;
    $('reg-age-display').innerText = '';
    populateRoomSelects();
    if (typeof populateDeptSelects === 'function') populateDeptSelects();
    openModalDialog($('modal-register'));
  };

  const btnSelectRoom = $('btn-select-room');
  if (btnSelectRoom) {
    btnSelectRoom.onclick = () => {
      populateRoomSelects();
      openModalDialog($('modal-select-room'));
    };
  }
  const closeSelectRoom = $('close-modal-select-room');
  if (closeSelectRoom) {
    closeSelectRoom.onclick = () => closeModalDialog($('modal-select-room'));
  }

  const btnSelectDept = $('btn-select-dept');
  if (btnSelectDept) {
    btnSelectDept.onclick = () => {
      if (typeof populateDeptSelects === 'function') populateDeptSelects();
      openModalDialog($('modal-select-dept'));
    };
  }
  const closeSelectDept = $('close-modal-select-dept');
  if (closeSelectDept) {
    closeSelectDept.onclick = () => closeModalDialog($('modal-select-dept'));
  }

  if ($('reg-national-id')) $('reg-national-id').oninput = () => {
    $('reg-age-display').innerText = calculateAgeAndGender(getVal('reg-national-id'));
  };
  
  if ($('btn-submit-register')) $('btn-submit-register').onclick = async () => {
    const name = getVal('reg-name');
    const hospitalId = getVal('reg-hospital-id').toUpperCase();
    const nationalId = getVal('reg-national-id');
    const location = getVal('reg-room');
    const primaryDepartment = getVal('reg-dept') || 'Internal Medicine';
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
        primaryDepartment,
        registrationTime: time
      });
      $('reg-name').value = '';
      $('reg-hospital-id').value = '';
      $('reg-national-id').value = '';
      closeModalDialog($('modal-register'));
    } catch (err) {
      alert(err.message);
    }
  };
  
  // Discharge Modal
  const btnSubmitDischarge = $('btn-submit-discharge');
  if (btnSubmitDischarge) btnSubmitDischarge.onclick = async () => {
    const outcome = getVal('discharge-outcome-select');
    const patientId = getVal('discharge-patient-id');
    const summaryEditor = $('ai-summary-editor');
    const attestationCheckbox = $('ai-attestation-checkbox');
    const summaryText = summaryEditor && summaryEditor.value.trim() ? summaryEditor.value.trim() : null;
    if (!outcome || !patientId) return;

    if (summaryText && (!attestationCheckbox || !attestationCheckbox.checked)) {
      alert(currentLang === 'en'
        ? "Clinical Attestation Required: Please verify and check the attestation box before completing discharge with a clinical summary."
        : "إقرار سريري مطلوب: يرجى مراجعة وتحديد مربع التحقق من ملخص الخروج قبل إتمام الخروج.");
      return;
    }

    try {
      await dischargePatientRecord(patientId, outcome, summaryText);
      closeModalDialog($('modal-discharge'));
    } catch (err) {
      alert(err.message);
    }
  };

  const btnGenAI = $('btn-generate-ai-summary');
  if (btnGenAI) btnGenAI.onclick = window.generateAISummaryInModal;
  const btnSaveAI = $('btn-save-ai-summary');
  if (btnSaveAI) btnSaveAI.onclick = window.saveAISummaryInModal;

  const btnSentJump = $('btn-sentinel-jump');
  if (btnSentJump) btnSentJump.onclick = () => {
    const activeSentinel = window.NanostoreClinicalStore?.activeSentinelAlert?.get();
    if (activeSentinel && activeSentinel.patient) {
      const card = document.querySelector(`.card-header[data-id="${activeSentinel.patient.id}"]`)?.closest('.patient-card');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.transition = 'box-shadow 0.3s, transform 0.3s';
        card.style.transform = 'scale(1.02)';
        card.style.boxShadow = '0 0 25px var(--danger-glow)';
        setTimeout(() => { card.style.transform = 'scale(1)'; card.style.boxShadow = ''; }, 2000);
      }
    }
  };

  const btnSentMute = $('btn-sentinel-mute');
  if (btnSentMute) btnSentMute.onclick = () => {
    if (window.NanostoreClinicalStore?.isAudioMuted) {
      window.NanostoreClinicalStore.isAudioMuted.set(true);
      const icon = btnSentMute.querySelector('.sentinel-btn-icon');
      const label = btnSentMute.querySelector('.sentinel-btn-label');
      if (icon) icon.textContent = '🔇';
      if (label) label.innerText = tr('sMuted');
      const mutedLabel = tr('sMuted');
      btnSentMute.setAttribute('aria-label', mutedLabel);
      btnSentMute.setAttribute('title', mutedLabel);
      btnSentMute.style.background = 'var(--tint-light-strong)';
    }
  };

  if (window.NanostoreClinicalStore && window.NanostoreClinicalStore.activeSentinelAlert) {
    window.NanostoreClinicalStore.activeSentinelAlert.subscribe(alertObj => {
      const banner = $('sentinel-banner');
      const title = $('sentinel-title');
      const msg = $('sentinel-message');
      if (alertObj && banner && title && msg) {
        title.innerText = `CRITICAL VITALS ALERT (${alertObj.level || 'ESI-1'})`;
        msg.innerText = `${alertObj.patient.name}: ${alertObj.reasons.join(' | ')}`;
        banner.classList.remove('hidden');
        if (!window.NanostoreClinicalStore.isAudioMuted?.get()) {
          window.NanostoreClinicalStore.playErgonomicChime?.();
        }
      } else if (banner) {
        banner.classList.add('hidden');
      }
    });
  }
  
  // Data Control Buttons in Manager Tab
  const btnDeleteDischarged = $('btn-delete-discharged');
  if (btnDeleteDischarged) btnDeleteDischarged.onclick = () => confirmAndDeletePatients(false);
  const btnDeleteAll = $('btn-delete-all');
  if (btnDeleteAll) btnDeleteAll.onclick = () => confirmAndDeletePatients(true);
  
  // Modal background click close
  window.onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModalDialog(e.target);
    }
  };

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = () => {
      closeModalDialog(btn.closest('.modal-overlay'));
    };
    // These are <span role="button"> (styling reasons — a real <button> here
    // would pick up the global 48px/padding/background button rules and stop
    // looking like the small "×" glyph this is meant to be). Spans don't get
    // Enter/Space activation for free the way a real button does, so wire it
    // by hand or this close control would be a mouse-only trap for anyone
    // navigating by keyboard.
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeModalDialog(btn.closest('.modal-overlay'));
      }
    });
  });

  // Analytics admissions dropdown toggle
  if ($('analytics-admissions-header')) {
    $('analytics-admissions-header').onclick = () => {
      const body = $('analytics-admissions-body');
      if (body) {
        const nowHidden = body.classList.toggle('hidden');
        $('analytics-admissions-header').setAttribute('aria-expanded', String(!nowHidden));
      }
    };
  }

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

/**
 * Render the access gate.
 *
 * `state` decides what the user is told, and the distinction matters: the
 * `pending` message is a promise that an owner can see this account and act on
 * it. It must never be shown for `unfiled` (the request could not be written)
 * or `unreachable` (we could not even read the account), because in both cases
 * the owner's approval queue does not contain this user. Those two states get
 * a retry button instead; the user is the only one who can resolve them.
 *
 * @param {'pending'|'blocked'|'unfiled'|'unreachable'} state
 * @param {string} [overrideMessage] Text to show instead of the state default.
 */
function showAccessGate(state, overrideMessage) {
  patientsList = [];
  usersList = [];
  isManager = false;
  isOwner = false;
  if (usersUnsubscribe) {
    usersUnsubscribe();
    usersUnsubscribe = null;
  }
  if (patientsUnsubscribe) {
    patientsUnsubscribe();
    patientsUnsubscribe = null;
  }
  if (unsubscribeRemoteConfig) {
    unsubscribeRemoteConfig();
    unsubscribeRemoteConfig = null;
  }
  if (window.NanostoreClinicalStore && window.NanostoreClinicalStore.activePatientsStore) {
    window.NanostoreClinicalStore.activePatientsStore.set([]);
  }
  if (window.NanostoreClinicalStore && window.NanostoreClinicalStore.activeSentinelAlert) {
    window.NanostoreClinicalStore.activeSentinelAlert.set(null);
  }
  const usersContainer = $('users-list-container');
  if (usersContainer) {
    usersContainer.innerHTML = '';
  }
  const badge = $('badge-pending-users');
  if (badge) {
    badge.innerText = '';
    badge.style.display = 'none';
  }
  if ($('tab-owner')) $('tab-owner').classList.add('hidden');
  if ($('data-control-actions')) {
    $('data-control-actions').style.display = 'none';
    $('data-control-actions').classList.add('hidden');
  }

  $('loading-overlay').classList.add('hidden');
  $('auth-section').classList.add('hidden');
  $('app-section').classList.add('hidden');
  $('access-gate').classList.remove('hidden');
  updateDashboardCounters();
  renderActivePatientList();
  renderShiftAnalytics();

  const messages = {
    pending: tr('pnd'),
    blocked: tr('blk'),
    unfiled: tr('gErr'),
    unreachable: tr('gNet')
  };
  $('gate-message').innerText = overrideMessage || messages[state] || tr('pnd');

  const retry = $('btn-gate-retry');
  if (retry) {
    retry.classList.toggle('hidden', state !== 'unfiled' && state !== 'unreachable');
    retry.disabled = false;
  }
}

/**
 * Re-attempt the write that files an access request, from the gate itself.
 * Without this the only recovery from a failed first attempt is a full sign-out
 * and sign-in, which the user has no reason to suspect would help.
 */
async function retryAccessRequest() {
  const btn = $('btn-gate-retry');
  const user = auth.currentUser;
  if (!user) {
    logout();
    return;
  }
  if (btn) btn.disabled = true;
  const filed = await ensureUserRecord(user.uid, user.email, 'pending');
  if (filed.ok) {
    showAccessGate('pending', tr('gSent'));
  } else {
    showAccessGate('unfiled');
  }
}

function switchTab(tabName) {
  if (tabName === 'owner' && !isOwner) return;
  
  ['live-board', 'owner'].forEach(t => {
    const tabBtn = $(`tab-${t}`);
    const viewEl = $(`view-${t}`);
    if (tabBtn && viewEl) {
      tabBtn.classList.toggle('active', t === tabName);
      viewEl.classList.toggle('hidden', t !== tabName);
    }
  });
  if (tabName === 'live-board') {
    renderActivePatientList();
    renderShiftAnalytics();
  }
  if (tabName === 'owner' && isOwner) renderAccountManagement();
}

function populateRoomSelects() {
  const defaultRoom = ROOMS[2] || ROOMS[0] || 'Isolation Room';
  const regRoomInput = $('reg-room');
  if (regRoomInput && !regRoomInput.value) {
    regRoomInput.value = defaultRoom;
  }
  const btnText = $('btn-select-room-text');
  if (btnText && regRoomInput) {
    btnText.innerText = `📍 Room: ${regRoomInput.value || defaultRoom}`;
  }
  
  const grid = $('room-selection-grid');
  if (grid) {
    grid.innerHTML = ROOMS.map(r => {
      const isSelected = regRoomInput && regRoomInput.value === r;
      return `
      <button type="button" class="btn btn-outline room-option-btn" data-room="${r}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:10px;font-weight:600;text-align:left;width:100%;background:var(--card-bg);border:1px solid var(--border-color);color:var(--text-main);margin-bottom:6px;">
        <span>📍 ${r}</span>
        <span class="check-mark ${isSelected ? '' : 'hidden'}" style="color:var(--success);font-weight:bold;">✔</span>
      </button>
    `}).join('');
    
    grid.querySelectorAll('.room-option-btn').forEach(btn => {
      btn.onclick = () => {
        const selected = btn.dataset.room;
        if (regRoomInput) regRoomInput.value = selected;
        if (btnText) btnText.innerText = `📍 Room: ${selected}`;
        grid.querySelectorAll('.room-option-btn .check-mark').forEach(cm => cm.classList.add('hidden'));
        const cm = btn.querySelector('.check-mark');
        if (cm) cm.classList.remove('hidden');
        closeModalDialog($('modal-select-room'));
      };
    });
  }
}

/**
 * Render the filtered department list inside the picker modal. Typing in the
 * search box narrows the list live; when nothing matches, an inline "use
 * custom" row lets the typed text itself become the department — no need to
 * scroll to a separate custom-entry field.
 */
function renderDeptPickerList(filterText = '') {
  const grid = $('dept-selection-grid');
  const regDeptInput = $('reg-dept');
  const btnText = $('btn-select-dept-text');
  if (!grid) return;

  const commitDept = (val) => {
    if (!val) return;
    if (regDeptInput) regDeptInput.value = val;
    if (btnText) btnText.innerText = `🏥 ${tr('lDept')}: ${val}`;
    closeModalDialog($('modal-select-dept'));
  };

  const query = filterText.toLowerCase().trim();
  const matches = PRIMARY_DEPARTMENTS.filter(d => {
    if (!query) return true;
    return d.en.toLowerCase().includes(query) || d.ar.includes(filterText.trim());
  });

  let html = matches.map(d => {
    const deptName = currentLang === 'en' ? d.en : d.ar;
    const isSelected = regDeptInput && regDeptInput.value === d.en;
    return `
      <button type="button" class="btn btn-outline dept-option-btn" data-dept="${esc(d.en)}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:10px;font-weight:600;text-align:left;width:100%;background:var(--card-bg);border:1px solid var(--border-color);color:var(--primary);margin-bottom:6px;">
        <span>🏥 ${esc(deptName)}</span>
        <span class="check-mark ${isSelected ? '' : 'hidden'}" style="color:var(--success);font-weight:bold;">✔</span>
      </button>
    `;
  }).join('');

  if (matches.length === 0) {
    html += `<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">${esc(tr('noDeptMatch'))}</div>`;
  }

  if (query) {
    const typed = filterText.trim();
    html += `
      <button type="button" class="btn btn-outline dept-option-btn" id="dept-use-custom-btn" data-dept="${esc(typed)}" style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:10px;font-weight:700;text-align:left;width:100%;background:var(--card-bg);border:1px dashed var(--primary);color:var(--primary);margin-bottom:6px;">
        ➕ ${esc(tr('useCustomDept'))}: "${esc(typed)}"
      </button>
    `;
  } else {
    html += `
      <button type="button" class="btn btn-outline" id="dept-other-custom-toggle" style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:10px;font-weight:700;text-align:left;width:100%;background:var(--card-bg);border:1px dashed var(--primary);color:var(--primary);">
        ✏️ ${esc(tr('otherCustomDept'))}
      </button>
      <div id="dept-other-custom-row" class="hidden" style="display:flex;gap:8px;margin-top:8px;">
        <input type="text" id="dept-other-custom-input" class="input-field" style="margin:0;flex:1;height:44px;" placeholder="${esc(tr('enterCustomDeptPh'))}">
        <button type="button" id="dept-other-custom-confirm" class="btn btn-primary-filled" style="height:44px;padding:0 16px;">${esc(tr('setBtn'))}</button>
      </div>
    `;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.dept-option-btn[data-dept]').forEach(btn => {
    btn.onclick = () => commitDept(btn.dataset.dept);
  });

  const otherToggle = $('dept-other-custom-toggle');
  const otherRow = $('dept-other-custom-row');
  const otherInput = $('dept-other-custom-input');
  const otherConfirm = $('dept-other-custom-confirm');
  if (otherToggle && otherRow && otherInput && otherConfirm) {
    otherToggle.onclick = () => {
      otherRow.classList.remove('hidden');
      otherInput.focus();
    };
    const confirmCustom = () => commitDept(otherInput.value.trim());
    otherConfirm.onclick = confirmCustom;
    otherInput.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirmCustom(); }
    };
  }
}

function populateDeptSelects() {
  const defaultDept = 'Internal Medicine';
  const regDeptInput = $('reg-dept');
  if (regDeptInput && !regDeptInput.value) {
    regDeptInput.value = defaultDept;
  }
  const btnText = $('btn-select-dept-text');
  if (btnText && regDeptInput) {
    btnText.innerText = `🏥 ${tr('lDept')}: ${regDeptInput.value || defaultDept}`;
  }

  const searchInput = $('dept-picker-search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = () => renderDeptPickerList(searchInput.value);
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstBtn = $('dept-selection-grid')?.querySelector('.dept-option-btn[data-dept]');
        if (firstBtn) firstBtn.click();
      }
    };
  }

  renderDeptPickerList('');
}

function updateTranslations() {
  document.documentElement.dir = currentLang === 'en' ? 'ltr' : 'rtl';
  // `dir` alone only fixes layout direction. Without also updating `lang`,
  // a screen reader keeps using its English voice/pronunciation rules on the
  // Arabic text that just replaced the English UI (WCAG 3.1.1/3.1.2).
  document.documentElement.lang = currentLang === 'en' ? 'en' : 'ar';
  $('btn-lang-toggle').innerText = currentLang === 'en' ? 'عربي' : 'English';
  
  document.querySelectorAll('[data-i]').forEach(el => {
    el.innerText = tr(el.dataset.i);
  });
  document.querySelectorAll('[data-p]').forEach(el => {
    el.placeholder = tr(el.dataset.p);
  });
  // Icon-only buttons (e.g. the sentinel jump/mute controls) carry their
  // label as an aria-label/title instead of visible text on small screens.
  document.querySelectorAll('[data-i-aria]').forEach(el => {
    const label = tr(el.dataset.iAria);
    el.setAttribute('aria-label', label);
    el.setAttribute('title', label);
  });

  // Re-render lists to update language
  updateDashboardCounters();
  renderActivePatientList();
  renderShiftAnalytics();
  if (isOwner) renderAccountManagement();
}

export function calculateAgeAndGender(nid) {
  if (!nid) return '--';
  const str = String(nid).trim();
  if (!/^\d{14}$/.test(str)) return '--';
  const century = str[0] === '2' ? 1900 : (str[0] === '3' ? 2000 : 0);
  if (!century) return '--';
  const year = century + parseInt(str.substr(1, 2), 10);
  const month = parseInt(str.substr(3, 2), 10);
  const day = parseInt(str.substr(5, 2), 10);
  if (month < 1 || month > 12) return '--';
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return '--';
  const birthDate = new Date(year, month - 1, day);
  const age = ~~((new Date() - birthDate) / 315576e5);
  if (age < 0 || age > 130) return '--';
  const isMale = parseInt(str[12], 10) % 2 !== 0;
  return `${isMale ? (typeof tr === 'function' ? tr('ml') || 'Male' : 'Male') : (typeof tr === 'function' ? tr('fm') || 'Female' : 'Female')} | ${age} ${typeof tr === 'function' ? tr('yr') || 'yrs' : 'yrs'}`;
}

export function formatElapsedHours(timeStr) {
  return timeStr ? (Date.now() - new Date(timeStr).getTime()) / 36e5 : 0;
}

export function formatDurationString(startTime, endTime) {
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
        <div class="metric-card card-room ${isSelected ? 'active' : ''}" data-room="${roomName}" role="button" tabindex="0">
          <span class="metric-card-label">📍 ${roomName}</span>
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
 * Snapshot whatever the user is currently typing, so a realtime update pushed
 * by another member of staff doesn't yank the caret out of their field or
 * replace half-typed text with the stored value.
 */
export function captureActiveFieldState() {
  const el = document.activeElement;
  if (!el || !el.id) return null;
  const isEditable = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
  if (!isEditable) return null;
  if (!el.closest('#patient-list-container')) return null;
  const state = { id: el.id, value: el.value };
  if (typeof el.selectionStart === 'number') {
    state.selectionStart = el.selectionStart;
    state.selectionEnd = el.selectionEnd;
  }
  return state;
}

export function restoreActiveFieldState(state) {
  if (!state) return;
  const el = $(state.id);
  if (!el) return;
  // Keep the in-progress local value — this user is mid-edit and has not
  // committed yet, so their typing wins over the freshly-rendered stored value.
  if (el.value !== state.value) el.value = state.value;
  el.focus({ preventScroll: true });
  if (typeof state.selectionStart === 'number' && typeof el.setSelectionRange === 'function') {
    try {
      el.setSelectionRange(state.selectionStart, state.selectionEnd);
    } catch {
      // setSelectionRange throws on input types that don't support it (date, etc.)
    }
  }
}

/**
 * Render Active Patient List
 */
function renderActivePatientList() {
  const container = $('patient-list-container');
  if (!container) return;

  const activeField = captureActiveFieldState();

  const activePatients = patientsList.filter(p => !p.isDischarged);
  
  // Prune stale IDs from expandedPatientCardIds to prevent memory leaks
  expandedPatientCardIds.forEach(id => {
    if (!activePatients.some(p => p.id === id)) {
      expandedPatientCardIds.delete(id);
    }
  });

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
  
  const searchQuery = ($('patient-search-input') ? $('patient-search-input').value.toLowerCase().trim() : '');
  if (searchQuery) {
    filtered = filtered.filter(p => 
      (p.name && p.name.toLowerCase().includes(searchQuery)) || 
      (p.patientId && p.patientId.toLowerCase().includes(searchQuery)) ||
      (p.hospitalId && p.hospitalId.toLowerCase().includes(searchQuery)) ||
      (p.id && String(p.id).toLowerCase().includes(searchQuery)) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(searchQuery))
    );
  }

  $('list-header-title').innerText = titleText;
  $('list-header-count').innerText = filtered.length;
  
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-list">${tr('nD')}</div>`;
    restoreActiveFieldState(activeField);
    return;
  }

  sortedPatients = filtered.sort((a, b) => new Date(a.registrationTime || 0) - new Date(b.registrationTime || 0));
  
  container.innerHTML = sortedPatients.map(p => {
    let cleanDept = p.primaryDepartment || p.department || 'Internal Medicine';
    if (ROOMS.includes(cleanDept) || (!p.primaryDepartment && !p.department && cleanDept === p.location)) {
      cleanDept = 'Internal Medicine';
    }
    const isCustomDept = cleanDept && !standardDepts.includes(cleanDept);
    const isCustomAction = !PENDING_ACTIONS.includes(p.pendingAction);
    const isWaitlistAction = WAITLIST_ACTIONS.includes(p.pendingAction) || p.pendingAction === 'Waiting referral' || p.hasReferral === 'Yes' || p.hasReferral === 'No';
    const diagStr = String(p.diagnosis || '');
    const isSepsisSuspected = diagStr.toLowerCase().includes('sepsis') || diagStr.toLowerCase().includes('septic') || diagStr.includes('تسمم') || p.sepsisWorkup === 'Yes' || p.sepsisWorkup === 'No';
    const isMiSuspected = diagStr.toLowerCase().includes('stemi') || diagStr.toLowerCase().includes('nstemi') || /\bmi\b/i.test(diagStr) || diagStr.includes('MI') || diagStr.toLowerCase().includes('infarction') || diagStr.includes('جلطة') || diagStr.includes('قلب') || p.miCodeWorkup === 'Yes' || p.miCodeWorkup === 'No';
    const isStrokeSuspected = diagStr.toLowerCase().includes('stroke') || diagStr.toLowerCase().includes('cva') || diagStr.includes('جلطة دماغية') || diagStr.includes('مخ') || diagStr.includes('دماغ') || p.strokeCodeWorkup === 'Yes' || p.strokeCodeWorkup === 'No';
    const regDateFormatted = p.registrationTime ? new Date(p.registrationTime).toLocaleString(currentLang === 'en' ? 'en-GB' : 'ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const safeName = esc(p.name || '');
    const isExpanded = expandedPatientCardIds.has(p.id);
    
    return `
      <div class="patient-card" data-triage="${getTriageCategory(p)}" data-status="${esc(p.status || '')}">
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
            <div class="pending-action-badge">${esc(translatePendingAction(p.pendingAction))}</div>
          </div>
        </div>
        
        <div id="details_${esc(p.id)}" class="card-details ${isExpanded ? '' : 'hidden'}">
          <details class="edit-reg-details" style="margin-bottom:16px;border:1px dashed var(--border-color);border-radius:12px;padding:10px 14px;background:var(--tint-light);">
            <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--primary);outline:none;user-select:none;">
              ✏️ ${currentLang === 'en' ? 'Edit Registration Demographics (Name, ID, Time)' : 'تعديل بيانات التسجيل الأساسية (الاسم، الهوية، الوقت)'}
            </summary>
            <div class="details-grid-top" style="margin-top:14px;margin-bottom:0;">
              <div>
                <label class="field-label" style="margin-top:0;">${tr('lN') || 'Name'}</label>
                <input type="text" id="name_${esc(p.id)}" value="${safeName}" dir="${currentLang === 'en' ? 'ltr' : 'rtl'}" class="input-field" style="margin:0;" data-id="${esc(p.id)}" data-field="name" placeholder="${tr('nm') || 'e.g. John Doe'}" maxlength="100">
              </div>
              <div>
                <label class="field-label" style="margin-top:0;">${tr('lH') || 'Hospital ID'}</label>
                <input type="text" id="hosp_${esc(p.id)}" value="${esc(p.patientId || '')}" class="input-field" style="margin:0;" placeholder="${tr('hS') || 'e.g. A123456789'}" data-id="${esc(p.id)}" data-field="patientId" maxlength="10">
              </div>
              <div>
                <label class="field-label" style="margin-top:0;">${tr('lT') || 'Time'}</label>
                <input type="datetime-local" id="regtime_${esc(p.id)}" value="${(p.registrationTime || '').slice(0, 16)}" class="input-field" style="margin:0;" data-id="${esc(p.id)}" data-field="registrationTime">
              </div>
            </div>
            <div style="margin-top:12px;">
              <label class="field-label" style="margin-top:0;">${tr('lI') || 'National ID'}</label>
              <input type="text" inputmode="numeric" pattern="[0-9]*" id="nid_${esc(p.id)}" value="${p.nationalId || ''}" class="input-field" style="margin:0;width:100%;" placeholder="${tr('nS') || 'e.g. 29001011234567'}" data-id="${esc(p.id)}" data-field="nationalId" maxlength="14">
            </div>
          </details>
          
          <div class="details-grid-mid">
            <div>
              <label class="field-label">${tr('dg')}</label>
              <input type="text" id="diag_${esc(p.id)}" value="${esc(p.diagnosis || '')}" class="input-field" data-id="${esc(p.id)}" data-field="diagnosis" placeholder="${currentLang === 'en' ? 'e.g. STEMI, Appendicitis...' : 'مثال: جلطة قلبية، التهاب زائدة...'}" maxlength="1000">
            </div>
            <div>
              <label class="field-label">${tr('sX')}</label>
              <input type="text" id="supp_${esc(p.id)}" value="${esc(p.supportiveTx || '')}" class="input-field" data-id="${esc(p.id)}" data-field="supportiveTx" placeholder="${currentLang === 'en' ? 'e.g. Aspirin, Oxygen 2L...' : 'مثال: أسبرين، أكسجين...'}" maxlength="1000">
            </div>
          </div>
          
          <div class="details-grid-bottom">
            <div>
              <label class="field-label">${tr('aC')}</label>
              <div style="display:flex;gap:6px;align-items:center;">
                <select id="action_${esc(p.id)}" class="select-action ${isCustomAction ? 'hidden' : ''}" data-id="${esc(p.id)}" data-field="pendingAction" style="flex:1;width:100%;">
                  ${PENDING_ACTIONS.map(a => `<option value="${a}" ${p.pendingAction === a ? 'selected' : ''}>${translatePendingAction(a)}</option>`).join('')}
                  <option value="Custom..." ${isCustomAction ? 'selected' : ''}>✏️ ${tr('pS')}...</option>
                </select>
                <input type="text" id="custom_action_${esc(p.id)}" class="input-custom-action ${isCustomAction ? '' : 'hidden'}" style="flex:1;margin:0;width:100%;" placeholder="${tr('pS')}" value="${esc(isCustomAction ? p.pendingAction : '')}" data-id="${esc(p.id)}" data-field="customAction">
                <button type="button" class="btn btn-mini btn-outline ${isCustomAction ? '' : 'hidden'}" id="btn_reset_action_${esc(p.id)}" data-id="${esc(p.id)}" title="Back to presets" style="padding:10px 12px;margin:0;">📋</button>
              </div>
            </div>
            
            <div class="workup-boxes">
              <div id="referral_box_${esc(p.id)}" class="alert-box alert-warning alert-box-referral ${isWaitlistAction ? '' : 'hidden'}">
                <label class="alert-label alert-label-referral">${tr('rL')}</label>
                <select id="ref_${esc(p.id)}" class="select-alert select-alert-inline select-alert-referral" data-id="${esc(p.id)}" data-field="hasReferral">
                  <option value="" ${!p.hasReferral ? 'selected' : ''}>${currentLang === 'en' ? '-- No Referral --' : '-- بدون تحويل --'}</option>
                  <option value="Yes" ${p.hasReferral === 'Yes' ? 'selected' : ''}>${currentLang === 'en' ? 'Yes (Referral Sent)' : 'نعم (تم إرسال التحويل)'}</option>
                  <option value="No" ${p.hasReferral === 'No' ? 'selected' : ''}>${currentLang === 'en' ? 'No' : 'لا'}</option>
                </select>
              </div>
              
              <div id="sepsis_box_${esc(p.id)}" class="alert-box alert-danger alert-box-sepsis ${isSepsisSuspected ? '' : 'hidden'}">
                <label class="alert-label alert-label-sepsis">${tr('sepW')}</label>
                <select id="sepsis_${esc(p.id)}" class="select-alert select-alert-inline select-alert-sepsis" data-id="${esc(p.id)}" data-field="sepsisWorkup">
                  <option value="" ${!p.sepsisWorkup ? 'selected' : ''}>${currentLang === 'en' ? '-- Pending Workup --' : '-- في انتظار التحاليل --'}</option>
                  <option value="Yes" ${p.sepsisWorkup === 'Yes' ? 'selected' : ''}>${currentLang === 'en' ? 'Yes (Protocol Initiated)' : 'نعم (تم تفعيل البروتوكول)'}</option>
                  <option value="No" ${p.sepsisWorkup === 'No' ? 'selected' : ''}>${currentLang === 'en' ? 'No' : 'لا'}</option>
                </select>
              </div>

              <div id="mi_box_${esc(p.id)}" class="alert-box alert-danger alert-box-mi ${isMiSuspected ? '' : 'hidden'}">
                <label class="alert-label alert-label-mi">🫀 ${currentLang === 'en' ? 'MI Code Workup' : 'كود جلطة القلب'}</label>
                <select id="mi_${esc(p.id)}" class="select-alert select-alert-inline select-alert-mi" data-id="${esc(p.id)}" data-field="miCodeWorkup">
                  <option value="" ${!p.miCodeWorkup ? 'selected' : ''}>${currentLang === 'en' ? '-- Pending ECG/Trop --' : '-- في انتظار رسم القلب والإنزيمات --'}</option>
                  <option value="Yes" ${p.miCodeWorkup === 'Yes' ? 'selected' : ''}>${currentLang === 'en' ? 'Yes (Cath Alerted)' : 'نعم (تم إبلاغ القسطرة)'}</option>
                  <option value="No" ${p.miCodeWorkup === 'No' ? 'selected' : ''}>${currentLang === 'en' ? 'No' : 'لا'}</option>
                </select>
              </div>

              <div id="stroke_box_${esc(p.id)}" class="alert-box alert-warning alert-box-stroke ${isStrokeSuspected ? '' : 'hidden'}">
                <label class="alert-label alert-label-stroke">🧠 ${currentLang === 'en' ? 'Stroke Code Workup' : 'كود جلطة المخ'}</label>
                <select id="stroke_${esc(p.id)}" class="select-alert select-alert-inline select-alert-stroke" data-id="${esc(p.id)}" data-field="strokeCodeWorkup">
                  <option value="" ${!p.strokeCodeWorkup ? 'selected' : ''}>${currentLang === 'en' ? '-- Pending CT Brain --' : '-- في انتظار الأشعة المقطعية --'}</option>
                  <option value="Yes" ${p.strokeCodeWorkup === 'Yes' ? 'selected' : ''}>${currentLang === 'en' ? 'Yes (Neuro Alerted)' : 'نعم (تم إبلاغ المخ والأعصاب)'}</option>
                  <option value="No" ${p.strokeCodeWorkup === 'No' ? 'selected' : ''}>${currentLang === 'en' ? 'No' : 'لا'}</option>
                </select>
              </div>
            </div>
          </div>
          
          <button class="btn btn-danger btn-discharge-trigger" data-id="${esc(p.id)}" data-name="${safeName}">${tr('dB')}</button>
        </div>
      </div>
    `;
  }).join('');
  
  attachPatientListHandlers();
  restoreActiveFieldState(activeField);
}

let sortedPatients = [];

/**
 * Reduce a set of candidate field values down to only those that differ from
 * the stored record. `undefined` candidates mean "not being edited" and are
 * always skipped.
 */
export function diffPatientFields(patient, candidates) {
  const updateData = {};
  for (const [field, value] of Object.entries(candidates)) {
    if (value === undefined) continue;
    const raw = patient[field];
    const stored = raw === undefined || raw === null ? '' : String(raw);
    // registrationTime round-trips through a datetime-local input, which drops
    // seconds — compare on the same prefix length to avoid a phantom diff.
    const comparable = field === 'registrationTime' ? stored.slice(0, 16) : stored;
    if (value !== comparable) updateData[field] = value;
  }
  return updateData;
}

/**
 * Persist a patient card, writing ONLY the fields this user actually changed.
 *
 * Several staff work the board at once, so a blanket write of every field would
 * clobber a colleague's concurrent edit to a different field on the same
 * patient with whatever stale value happened to be sitting in this browser's
 * DOM. Diffing against the latest snapshot keeps concurrent edits to separate
 * fields merging instead of overwriting each other.
 */
async function savePatientCardFields(cardId, targetElement = null) {
  if (!cardId || !$(`details_${cardId}`)) return;
  const patient = patientsList.find(p => p.id === cardId) || {};

  const actionSelect = $(`action_${cardId}`);
  const isCustomHidden = actionSelect ? actionSelect.classList.contains('hidden') : false;
  const actionSelectVal = getVal(`action_${cardId}`);
  const finalAction = (isCustomHidden || actionSelectVal === 'Custom...') ? (getVal(`custom_action_${cardId}`) || 'Other') : actionSelectVal;

  const deptSelect = $(`dept_sel_${cardId}`);
  const isCustomDeptHidden = deptSelect ? deptSelect.classList.contains('hidden') : false;
  const deptSelectVal = getVal(`dept_sel_${cardId}`);
  const existingDept = patient.primaryDepartment || 'Internal Medicine';
  const finalDept = (isCustomDeptHidden || deptSelectVal === 'Other...') ? (getVal(`custom_dept_${cardId}`) || existingDept) : (deptSelectVal || existingDept);

  // A workup dropdown that is currently hidden is not being edited — leave
  // whatever is stored alone rather than blanking it.
  const visibleBoxValue = (boxId, selectId) => {
    const box = $(boxId);
    return box && !box.classList.contains('hidden') ? getVal(selectId) : undefined;
  };

  const allCandidates = {
    name: getVal(`name_${cardId}`),
    patientId: getVal(`hosp_${cardId}`).toUpperCase(),
    nationalId: getVal(`nid_${cardId}`),
    location: getVal(`loc_${cardId}`),
    diagnosis: getVal(`diag_${cardId}`),
    supportiveTx: getVal(`supp_${cardId}`),
    primaryDepartment: finalDept,
    pendingAction: finalAction,
    hasReferral: visibleBoxValue(`referral_box_${cardId}`, `ref_${cardId}`),
    sepsisWorkup: visibleBoxValue(`sepsis_box_${cardId}`, `sepsis_${cardId}`),
    miCodeWorkup: visibleBoxValue(`mi_box_${cardId}`, `mi_${cardId}`),
    strokeCodeWorkup: visibleBoxValue(`stroke_box_${cardId}`, `stroke_${cardId}`),
    registrationTime: getVal(`regtime_${cardId}`) || undefined
  };

  const targetField = targetElement?.dataset?.field;
  const candidates = (targetField && targetField in allCandidates)
    ? { [targetField]: allCandidates[targetField] }
    : allCandidates;

  const updateData = diffPatientFields(patient, candidates);
  if (Object.keys(updateData).length === 0) return;

  try {
    await updatePatientRecord(cardId, updateData);
    if (targetElement) triggerFlashAnimation(targetElement);
  } catch (err) {
    secLog("Failed to auto-save patient card:", err);
  }
}

function attachPatientListHandlers() {
  // Accordion toggle with automatic save & single-card open mode
  document.querySelectorAll('.card-header').forEach(header => {
    header.onclick = async (e) => {
      if (e.target.closest('select, input, button')) return;
      const id = header.dataset.id;
      const detailsEl = $(`details_${id}`);
      if (!detailsEl) return;
      
      const isCurrentlyHidden = detailsEl.classList.contains('hidden');
      if (isCurrentlyHidden) {
        const prevIds = Array.from(expandedPatientCardIds);
        expandedPatientCardIds.clear();
        expandedPatientCardIds.add(id);
        detailsEl.classList.remove('hidden');
        
        prevIds.forEach(prevId => {
          if (prevId !== id) {
            const prevDetails = $(`details_${prevId}`);
            if (prevDetails) prevDetails.classList.add('hidden');
            savePatientCardFields(prevId);
          }
        });
      } else {
        expandedPatientCardIds.delete(id);
        detailsEl.classList.add('hidden');
        savePatientCardFields(id);
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
        secLog("Failed to update location:", err);
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
        secLog("Failed to update department:", err);
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
    inp.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      if (!id) return;
      const val = e.target.value.trim();
      if (val) {
        try {
          await updatePatientRecord(id, { primaryDepartment: val });
          triggerFlashAnimation(e.target);
        } catch (err) {
          secLog("Failed to update custom department:", err);
        }
      }
    });
    inp.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const id = e.target.dataset.id;
        if (!id) return;
        const val = e.target.value.trim();
        if (val) {
          try {
            await updatePatientRecord(id, { primaryDepartment: val });
            triggerFlashAnimation(e.target);
            e.target.blur();
          } catch (err) {
            secLog("Failed to update custom department on Enter:", err);
          }
        }
      }
    });
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
    btn.addEventListener('click', async (e) => {
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
        try {
          await updatePatientRecord(id, { primaryDepartment: 'Internal Medicine' });
          triggerFlashAnimation(select);
        } catch (err) {
          secLog("Failed to reset department:", err);
        }
      }
    });
  });

  // Save changes on change
  document.querySelectorAll('.card-details input, .card-details select, [id^="custom_dept_"], [id^="dept_sel_"], [id^="loc_"]').forEach(el => {
    el.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      if (!id) return;
      if (e.target.id.startsWith('dept_sel_') || e.target.id.startsWith('custom_dept_')) {
        return; // Handled explicitly by dedicated department change/keydown/click handlers!
      }
      if (e.target.id.startsWith('action_') && e.target.value === 'Custom...') {
        return; // Don't trigger auto-save or re-render when revealing the custom action input!
      }
      
      await savePatientCardFields(id, e.target);
    });
  });

  // Discharge trigger buttons
  document.querySelectorAll('.btn-discharge-trigger').forEach(btn => {
    btn.onclick = () => {
      $('discharge-patient-name').innerText = btn.dataset.name || '--';
      $('discharge-patient-id').value = btn.dataset.id;
      $('discharge-outcome-select').value = "";
      const list = (typeof patientsList !== 'undefined' && patientsList.length > 0) ? patientsList : (window.patientsList || []);
      const patient = list.find(p => p.id === btn.dataset.id);
      const summaryEditor = $('ai-summary-editor');
      const attestationCheckbox = $('ai-attestation-checkbox');
      if (summaryEditor) {
        if (patient && patient.dischargeSummary) {
          summaryEditor.value = patient.dischargeSummary;
        } else {
          summaryEditor.value = "";
        }
      }
      if (attestationCheckbox) {
        attestationCheckbox.checked = Boolean(patient && patient.dischargeSummaryAttested);
      }
      openModalDialog($('modal-discharge'));
    };
  });
}

window.generateAISummaryInModal = async function() {
  const id = $('discharge-patient-id').value;
  const list = (typeof patientsList !== 'undefined' && patientsList.length > 0) ? patientsList : (window.patientsList || []);
  const patient = list.find(p => p.id === id);
  if (!patient) { alert("Patient not found"); return; }
  const editor = $('ai-summary-editor');
  if (!editor) return;
  const attestationCheckbox = $('ai-attestation-checkbox');
  if (attestationCheckbox) attestationCheckbox.checked = false;
  const btn = $('btn-generate-ai-summary');
  if (btn) btn.disabled = true;
  editor.value = "⏳ Initializing AI Clinical Engine (checking on-device window.ai / Firebase AI Logic fallback)...\n\n";
  try {
    if (window.EdgeAIClinicalEngine && typeof window.EdgeAIClinicalEngine.generateDischargeSummary === 'function') {
      await window.EdgeAIClinicalEngine.generateDischargeSummary(
        patient,
        patient.vitals || [],
        patient.labs || [],
        patient.notes || [],
        (tokenOrText) => {
          editor.value = tokenOrText;
        }
      );
    } else {
      editor.value = "❌ AI Clinical Engine not loaded.";
    }
  } catch (err) {
    editor.value = `❌ AI Synthesis Error: ${err.message}`;
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.saveAISummaryInModal = async function() {
  const id = $('discharge-patient-id').value;
  if (!id) return;
  const editor = $('ai-summary-editor');
  if (!editor || !editor.value.trim()) { alert("Summary box is empty"); return; }
  const attestationCheckbox = $('ai-attestation-checkbox');
  if (!attestationCheckbox || !attestationCheckbox.checked) {
    alert(currentLang === 'en'
      ? "Clinical Attestation Required: You must review and check the verification box before saving this summary."
      : "إقرار سريري مطلوب: يجب مراجعة ملخص الخروج وتحديد مربع التحقق قبل الحفظ.");
    return;
  }
  try {
    await updatePatientRecord(id, {
      dischargeSummary: editor.value.trim(),
      dischargeSummaryAttested: true,
      dischargeSummaryAttestedAt: new Date().toISOString(),
      dischargeSummaryAttestedBy: (typeof auth !== 'undefined' && auth?.currentUser?.uid) ? auth.currentUser.uid : 'unknown'
    });
    alert("✅ AI Clinical Summary verified and saved to Firestore patient record!");
  } catch (err) {
    console.error("Error saving AI summary:", err);
    alert(`Failed to save: ${err.message}`);
  }
};

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
              <div class="patient-name" dir="${currentLang === 'en' ? 'ltr' : 'rtl'}">${esc(p.name || '--')}</div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px;">
                <span class="hospital-id">#${esc(p.patientId || '--')}</span>
              </div>
            </div>
            <div class="card-summary-right">
              <div class="card-summary-tags">
                <span class="badge" style="margin:0;padding:4px 10px;font-size:12px;background:var(--primary);color:var(--on-primary);border-radius:8px;font-weight:700;">
                  ${esc(translateDischargeOutcome(p.dischargeOutcome || '--'))}
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
  if (window.AppRemoteConfig?.enable_batch_purge === false) {
    alert("Batch purging is currently disabled by administrator via Remote Config.");
    return;
  }
  if (deleteAll && !isOwner) {
    alert(currentLang === 'en' ? "Only the System Owner can purge all patients." : "فقط المالك يمكنه حذف جميع السجلات.");
    return;
  }
  if (!deleteAll && !isManager && !isOwner) {
    alert(currentLang === 'en' ? "Only Managers and the System Owner can purge discharged patients." : "فقط المدير أو المالك يمكنه حذف سجلات المغادرين.");
    return;
  }

  const msg = currentLang === 'en' 
    ? (deleteAll ? "Are you sure you want to delete ALL patient records?" : "Are you sure you want to delete all discharged patient records?")
    : (deleteAll ? "هل أنت متأكد من حذف جميع سجلات المرضى؟" : "هل أنت متأكد من حذف جميع سجلات المرضى المغادرين؟");
  if (!confirm(msg)) return;
  const targets = deleteAll ? patientsList : patientsList.filter(p => p.isDischarged);
  const targetIds = targets.map(p => p.id);
  try {
    await batchDeletePatientRecords(targetIds);
  } catch (err) {
    secLog("Error in batch delete:", err);
  }
  updateDashboardCounters();
  renderActivePatientList();
  renderShiftAnalytics();
}
window.confirmAndDeletePatients = confirmAndDeletePatients;

/**
 * Split the roster into the three groups the Owner tab treats differently.
 *
 * `pending` is the approval queue — the accounts that are waiting on the owner
 * and can do nothing until the owner acts. Previously every account was
 * rendered into one unsorted grid in Firestore document-id order, so a new
 * sign-up landed at an arbitrary position among the staff cards with nothing
 * to distinguish it, and there was no view that listed access requests at all.
 */
export function partitionAccounts(users) {
  const owners = [];
  const pending = [];
  const staff = [];

  users.forEach(u => {
    if (checkIfOwner(u.email) || u.role === ROLE_OWNER) owners.push(u);
    else if (!u.role || u.role === 'pending') pending.push(u);
    else staff.push(u);
  });

  // Newest request first: the person asking about it is almost always the
  // person who just signed up.
  const requestedAt = (u) => Date.parse(u.createdAt || '') || 0;
  pending.sort((a, b) => (requestedAt(b) - requestedAt(a)) || String(a.email || '').localeCompare(String(b.email || '')));
  staff.sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')) || String(a.email || '').localeCompare(String(b.email || '')));

  return { owners, pending, staff };
}

/** Localised "Requested <date>" line for a queued access request. */
function formatRequestedAt(user) {
  const ts = Date.parse(user.createdAt || '');
  if (!ts) return '';
  const when = new Date(ts).toLocaleString(currentLang === 'en' ? 'en-GB' : 'ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  return `${tr('pqR')}: ${when}`;
}

/**
 * Render Account Management (Owner View)
 */
function renderAccountManagement() {
  const container = $('users-list-container');
  if (!container) return;

  if (usersList.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted); font-weight: 500;">Loading user accounts from Firestore... If this remains empty, check your Firestore permissions.</div>';
    return;
  }

  const { owners, pending, staff } = partitionAccounts(usersList);

  const countByRole = (r) => usersList.filter(u => u.role === r).length;
  const summaryTiles = [
    { label: currentLang === 'en' ? 'PENDING APPROVAL' : 'قيد الموافقة', count: pending.length, token: 'var(--role-pending)' },
    { label: tr('uMD').toUpperCase(), count: countByRole('medical_director'), token: 'var(--role-director)' },
    { label: tr('uEM').toUpperCase(), count: countByRole('emergency_manager'), token: 'var(--role-manager)' },
    { label: tr('uED').toUpperCase(), count: countByRole('emergency_deputy_manager'), token: 'var(--role-deputy)' },
    { label: tr('uCN').toUpperCase(), count: countByRole('chief_nurse'), token: 'var(--role-nurse)' }
  ];

  const summaryBanner = `
    <div class="account-summary-row">
      ${summaryTiles.map(t => `
        <div class="glass-panel account-summary-tile" style="border-bottom: 3px solid ${t.token};">
          <div class="account-summary-label">${esc(t.label)}</div>
          <div class="account-summary-count" style="color: ${t.token};">${t.count}</div>
        </div>
      `).join('')}
    </div>
  `;

  const roleAccent = {
    owner: 'var(--role-owner)',
    medical_director: 'var(--role-director)',
    emergency_manager: 'var(--role-manager)',
    emergency_deputy_manager: 'var(--role-deputy)',
    chief_nurse: 'var(--role-nurse)',
    pending: 'var(--role-pending)',
    blocked: 'var(--role-blocked)'
  };

  // Most accounts carry no `name`, so the header already shows the address —
  // repeating it underneath is noise.
  const emailLine = (u) => {
    if (u.name) return `<div class="user-card-email">${esc(u.email || '')}</div>`;
    if (u.email) return '';
    return `<div class="user-card-email">${currentLang === 'en' ? 'No email on record' : 'لا يوجد بريد مسجل'}</div>`;
  };

  const ownerCard = (u) => `
    <div class="user-card user-card-owner">
      <div class="user-card-header">
        <span class="user-card-name">👑 ${esc(u.name || u.email || 'System Owner')}</span>
        <span class="user-card-role" style="color: var(--role-owner);">${esc(tr('uO'))}</span>
      </div>
      ${emailLine(u)}
      <div class="user-card-note">
        ${currentLang === 'en'
          ? 'Full system administration. Only the owner can assign roles — this account cannot be edited here.'
          : 'إدارة كاملة للنظام. المالك وحده يستطيع تعيين الأدوار — لا يمكن تعديل هذا الحساب من هنا.'}
      </div>
    </div>
  `;

  const staffCard = (u, isRequest) => {
    const role = u.role || 'pending';
    const accent = roleAccent[role] || 'var(--role-pending)';
    const removeText = currentLang === 'en' ? '🗑️ Remove Account Completely' : '🗑️ إزالة الحساب نهائياً';
    // Every role the owner can grant — not just leadership, or a role the
    // rules accept would be unassignable from the only UI that assigns roles.
    const roleOptions = CLINICAL_ROLES
      .map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${esc(translateRole(r))}</option>`)
      .join('');
    const requestedAt = isRequest ? formatRequestedAt(u) : '';
    return `
      <div class="user-card${isRequest ? ' user-card-pending' : ''}">
        <div class="user-card-header">
          <span class="user-card-name">${isRequest ? '🕗 ' : ''}${esc(u.name || u.email || 'Staff Member')}</span>
          <span class="user-card-role" style="color: ${accent};">${esc(translateRole(role))}</span>
        </div>
        ${emailLine(u)}
        ${requestedAt ? `<div class="user-card-meta">${esc(requestedAt)}</div>` : ''}
        <div class="user-card-controls">
          <label class="field-label user-card-control-label">${isRequest
            ? (currentLang === 'en' ? 'Approve As' : 'الموافقة بصفة')
            : (currentLang === 'en' ? 'Role Assignment' : 'تعيين الدور والصلاحيات')}</label>
          <select class="select-role input-field" data-id="${esc(u.id || '')}">
            <option value="pending" ${role === 'pending' ? 'selected' : ''}>${esc(tr('uP'))}</option>
            ${roleOptions}
            <option value="blocked" ${role === 'blocked' ? 'selected' : ''}>${esc(tr('uB'))}</option>
          </select>
          <button type="button" class="btn btn-mini btn-outline btn-remove-user" data-id="${esc(u.id || '')}" data-email="${esc(u.email || '')}">
            ${removeText}
          </button>
        </div>
      </div>
    `;
  };

  // The approval queue comes first and is always rendered, empty or not. An
  // explicit "no requests" line is the difference between an owner knowing a
  // sign-up never arrived and an owner hunting for a card that does not exist.
  const queueSection = `
    <div class="account-section-heading">${esc(tr('pqT'))} (${pending.length})</div>
    ${pending.length
      ? pending.map(u => staffCard(u, true)).join('')
      : `<div class="account-section-empty">${esc(tr('pqE'))}</div>`}
  `;

  const rosterSection = `
    <div class="account-section-heading">${esc(tr('rosT'))} (${owners.length + staff.length})</div>
    ${owners.map(ownerCard).join('')}
    ${staff.map(u => staffCard(u, false)).join('')}
  `;

  container.innerHTML = summaryBanner + queueSection + rosterSection;

  container.querySelectorAll('.select-role').forEach(select => {
    select.onchange = async (e) => {
      const uid = select.dataset.id || e.currentTarget.dataset.id;
      const newRole = e.target.value;
      select.disabled = true;
      try {
        // 'blocked' is a role assignment, NOT a deletion. The previous build
        // called deleteUserRecord() here, so blocking an account actually
        // erased it and the user could simply sign up again.
        await updateUserRole(uid, newRole);
      } catch (err) {
        secLog("Failed to update user role:", err);
        alert("Error updating user privileges: " + err.message);
        // Re-render from the last known-good state so the dropdown snaps back
        // to the role that is actually stored, rather than dropping the user.
        renderAccountManagement();
      } finally {
        select.disabled = false;
      }
    };
  });

  container.querySelectorAll('.btn-remove-user').forEach(btn => {
    btn.onclick = async (e) => {
      const uid = btn.dataset.id || e.currentTarget.dataset.id;
      const email = btn.dataset.email || e.currentTarget.dataset.email;
      if (!confirm(currentLang === 'en' ? `Are you sure you want to remove ${email} completely? They will need to re-verify if they sign up again.` : `هل أنت متأكد من رغبتك في إزالة ${email} نهائياً؟`)) {
        return;
      }
      btn.disabled = true;
      try {
        await deleteUserRecord(uid);
        usersList = usersList.filter(u => u.id !== uid);
        renderAccountManagement();
      } catch (err) {
        secLog("Failed to delete user record:", err);
        alert("Error removing account: " + err.message);
        btn.disabled = false;
      }
    };
  });
}

// Universal Input Masking for Phone Numbers and National IDs
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el || el.tagName !== 'INPUT') return;
  
  // Phone Number Masking (XXX-XXXX-XXXX)
  if (el.type === 'tel' || el.id.includes('phone') || el.id.includes('tel') || el.name?.includes('phone')) {
    let val = el.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    let formatted = val;
    if (val.length > 7) {
      formatted = `${val.slice(0,3)}-${val.slice(3,7)}-${val.slice(7)}`;
    } else if (val.length > 3) {
      formatted = `${val.slice(0,3)}-${val.slice(3)}`;
    }
    el.value = formatted;
  }
  
  // National ID (14 digits max, no hyphens/dashes)
  if (el.id.includes('national') || el.id.includes('nid') || el.name?.includes('national') || el.dataset.field === 'nationalId') {
    let val = el.value.replace(/\D/g, '');
    if (val.length > 14) val = val.slice(0, 14);
    el.value = val;
  }
});

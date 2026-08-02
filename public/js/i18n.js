/**
 * =============================================================================
 * PROPRIETARY AND CONFIDENTIAL — IMC ER MANAGEMENT SYSTEM
 * Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * =============================================================================
 */

export let currentLang = 'en';

export function setLanguage(lang) {
  currentLang = lang;
}

export function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  return currentLang;
}

export const TRANSLATIONS = {
  en: {
    ld: "Loading...",
    t: "IMC ER",
    s: "Console",
    ep: "Email",
    pp: "Password",
    lB: "Log In",
    sB: "Sign Up",
    gB: "Google Login",
    bT: "ER Management",
    aB: "🚑 Register Patient",
    oB: "Logout",
    sT: "Length of Stay",
    sW: "Waiting Admissions",
    sR: "ER Rooms",
    t4: "> 4 Hrs",
    t6: "> 6 Hrs",
    t12: "> 12 Hrs",
    t24: "> 24 Hrs",
    t48: "> 48 Hrs",
    t72: "> 72 Hrs",
    wi: "Wait ICU",
    wc: "Wait CCU",
    wp: "Wait PICU",
    ww: "Wait Ward",
    aT: "Register Patient",
    lT: "Time",
    lN: "Name (Arabic)",
    lI: "Nat ID (Optional)",
    lH: "Hospital ID (1 Letter+9 Nums)",
    lL: "Room",
    lDept: "Primary Department",
    nm: "e.g. John Doe",
    sB2: "Register",
    dT: "Discharge",
    oS: "Select...",
    oI: "Improved",
    oW: "Ward",
    oIC: "ICU",
    oCC: "CCU",
    oPC: "PICU",
    oDM: "DAMA",
    oDT: "Death",
    oRef: "Referral",
    oEsc: "Escaped",
    dB: "Discharge",
    pS: "Custom...",
    tE: "Live Board",
    tM: "Manager",
    tO: "Owner",
    mC: "Data Control",
    mW: "Warning: Deletes DB.",
    p1: "Delete Discharged",
    p2: "Delete ALL",
    nD: "No patients found.",
    hS: "HOSP ID",
    nS: "NAT ID",
    rS: "ROOM",
    mS: "Shift Analytics (From 8 AM)",
    mT: "Total Visits",
    mA: "Admissions ▾",
    mI: "Improved",
    mD: "Mortality",
    mDa: "DAMA",
    ml: "Male",
    fm: "Female",
    yr: "yrs",
    rL: "📋 Referral Status",
    y: "Yes",
    n: "No",
    pnd: "Account pending owner approval.",
    blk: "Access revoked by owner.",
    oM: "Account Management",
    oD: "Assign roles or block access entirely. Auto-saves.",
    uMD: "Medical Director",
    uEM: "Emergency Manager",
    uED: "Emergency Deputy Manager",
    uO: "Owner (System Administrator)",
    uP: "Pending Approval",
    uB: "Blocked (No Access)",
    allP: "All Patients",
    uA: "Under assessment",
    wR: "Wait Referral",
    dPH: "Discharged Patients",
    dg: "Diagnosis",
    sX: "Supportive Tx",
    sepW: "🚨 Sepsis Protocol",
    aC: "Action",
    cStatus: "Emergency Command Console",
    sJump: "Jump to Patient",
    sMute: "Mute Session",
    sMuted: "Muted",
    deptModalTitle: "Select Primary Department",
    deptSearchPh: "🔍 Search departments...",
    noDeptMatch: "No departments match your search.",
    useCustomDept: "Use custom",
    otherCustomDept: "Other / Custom Department...",
    enterCustomDeptPh: "Enter department name...",
    setBtn: "Set"
  },
  ar: {
    ld: "جارٍ التحميل...",
    t: "طوارئ الإسماعيلية",
    s: "التحكم",
    ep: "الإيميل",
    pp: "الرقم السري",
    lB: "دخول",
    sB: "حساب جديد",
    gB: "دخول بجوجل",
    bT: "إدارة الطوارئ",
    aB: "🚑 مريض جديد",
    oB: "خروج",
    sT: "مدة البقاء",
    sW: "قائمة انتظار التنويم",
    sR: "الغرف",
    t4: "> 4 س",
    t6: "> 6 س",
    t12: "> 12 س",
    t24: "> 24 س",
    t48: "> 48 س",
    t72: "> 72 س",
    wi: "رعاية",
    wc: "قلب",
    wp: "أطفال",
    ww: "داخلي",
    aT: "مريض جديد",
    lT: "الوقت",
    lN: "الاسم (عربي)",
    lI: "القومي (اختياري)",
    lH: "رقم المريض (حرف+9 أرقام)",
    lL: "الغرفة",
    lDept: "القسم الأساسي",
    nm: "مثال: محمد أحمد",
    sB2: "تسجيل",
    dT: "خروج",
    oS: "اختر...",
    oI: "تحسن",
    oW: "داخلي",
    oIC: "رعاية مركزة",
    oCC: "رعاية قلب",
    oPC: "رعاية أطفال",
    oDM: "خروج بالطلب",
    oDT: "وفاة",
    oRef: "تحويل لمستشفى آخر",
    oEsc: "هروب المريض",
    dB: "تأكيد",
    pS: "مخصص...",
    tE: "اللوحة الحية",
    tM: "المدير",
    tO: "المالك",
    mC: "التحكم بالبيانات",
    mW: "تحذير: الحذف نهائي.",
    p1: "مسح الخوارج",
    p2: "مسح الكل",
    nD: "لا يوجد مرضى.",
    hS: "رقم المريض",
    nS: "القومي",
    rS: "الغرفة",
    mS: "إحصائيات (من 8 ص)",
    mT: "إجمالي الزيارات",
    mA: "دخول ▾",
    mI: "تحسن",
    mD: "وفيات",
    mDa: "خروج بالطلب",
    ml: "ذكر",
    fm: "أنثى",
    yr: "سنة",
    rL: "📋 حالة التحويل",
    y: "نعم",
    n: "لا",
    pnd: "الحساب قيد مراجعة المالك.",
    blk: "تم حظر الدخول بواسطة المالك.",
    oM: "إدارة الحسابات",
    oD: "تحديد الصلاحيات أو الحظر. الحفظ تلقائي.",
    uMD: "المدير الطبي",
    uEM: "مدير الطوارئ",
    uED: "نائب مدير الطوارئ",
    uO: "المالك (مسؤول النظام)",
    uP: "قيد الموافقة",
    uB: "محظور (ممنوع الدخول)",
    allP: "كل المرضى",
    uA: "تحت التقييم",
    wR: "انتظار تحويل",
    dPH: "المرضى الخوارج",
    dg: "التشخيص",
    sX: "علاج داعم",
    sepW: "🚨 بروتوكول الإنتان (Sepsis)",
    aC: "الإجراء",
    cStatus: "لوحة التحكم والطوارئ المباشرة",
    sJump: "الذهاب للمريض",
    sMute: "كتم التنبيه",
    sMuted: "مكتوم",
    deptModalTitle: "اختر القسم الأساسي",
    deptSearchPh: "🔍 ابحث عن قسم...",
    noDeptMatch: "لا توجد أقسام مطابقة لبحثك.",
    useCustomDept: "استخدام قسم مخصص",
    otherCustomDept: "قسم آخر / مخصص...",
    enterCustomDeptPh: "اكتب اسم القسم...",
    setBtn: "تحديد"
  }
};

/**
 * Get translation for key
 */
export function tr(key) {
  return TRANSLATIONS[currentLang][key] || key;
}

const ROLE_LABEL_KEYS = {
  owner: 'uO',
  medical_director: 'uMD',
  emergency_manager: 'uEM',
  emergency_deputy_manager: 'uED',
  pending: 'uP',
  blocked: 'uB'
};

/** Human-readable label for a stored role id, in the active language. */
export function translateRole(role) {
  const key = ROLE_LABEL_KEYS[role];
  return key ? tr(key) : tr('uP');
}

/**
 * Translate pending action string
 */
export function translatePendingAction(action) {
  if (!action) return '--';
  if (action === 'Under assessment') return tr('uA');
  if (action === 'Waiting referral') return tr('wR');
  if (action.includes('PICU')) return tr('wp');
  if (action.includes('ICU')) return tr('wi');
  if (action.includes('CCU')) return tr('wc');
  if (action.includes('ward')) return tr('ww');
  return action;
}

/**
 * Translate discharge outcome string
 */
export function translateDischargeOutcome(outcome) {
  if (!outcome) return '--';
  if (outcome === 'Improved') return tr('oI');
  if (outcome === 'Ward Admission') return tr('oW');
  if (outcome === 'ICU Admission') return tr('oIC');
  if (outcome === 'CCU Admission') return tr('oCC');
  if (outcome === 'PICU Admission') return tr('oPC');
  if (outcome === 'DAMA') return tr('oDM');
  if (outcome === 'Death') return tr('oDT');
  if (outcome === 'Referral') return tr('oRef');
  if (outcome === 'Escaped') return tr('oEsc');
  return outcome;
}

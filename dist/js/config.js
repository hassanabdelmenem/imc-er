/**
 * Application Configuration & Constants
 * Copyright (c) 2026 SEVENSN. All Rights Reserved.
 */

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBE0tjdrlOSr3gUz2iFWnWc_Epi66jV_6A",
  authDomain: "imc-er-manager.firebaseapp.com",
  projectId: "imc-er-manager"
};

export const OWNER_EMAILS = ['hassan.abdelmenem@gmail.com', 'hassanabdelmenem@gmail.com', 'owner@imc.com'];

/**
 * Staff roles. `owner` is the only tier that can manage accounts and assign
 * roles; the three leadership roles below share an identical permission set
 * (full clinical board access + data controls, no account management).
 *
 * `pending` and `blocked` are lifecycle states, not job titles — a new sign-up
 * lands on `pending` until the owner assigns one of the CLINICAL_ROLES.
 */
export const ROLE_OWNER = 'owner';
export const LEADERSHIP_ROLES = ['medical_director', 'emergency_manager', 'emergency_deputy_manager'];

/**
 * `chief_nurse` works the board exactly like the leadership tier — reads and
 * edits every patient record, registers and discharges — but is deliberately
 * NOT part of it. Purging and deleting records is a retention action, and it
 * stays with leadership; see MANAGER_TIER_ROLES below, which omits this role.
 */
export const ROLE_CHIEF_NURSE = 'chief_nurse';

/** Every role that may reach patient PHI. Mirrored by clinicalRoles() in firestore.rules. */
export const CLINICAL_ROLES = [...LEADERSHIP_ROLES, ROLE_CHIEF_NURSE];

export const ASSIGNABLE_ROLES = [ROLE_OWNER, ...CLINICAL_ROLES];

/**
 * Roles that grant manager-tier privileges (data controls, discharged purge).
 * Intentionally narrower than CLINICAL_ROLES: a chief nurse has the board, not
 * the delete button.
 */
export const MANAGER_TIER_ROLES = [ROLE_OWNER, ...LEADERSHIP_ROLES];

/**
 * Roles retired in the 2026 restructure. Anyone still carrying one of these in
 * Firestore is demoted to `pending` on next sign-in so the owner re-assigns them
 * deliberately rather than silently inheriting elevated access.
 */
export const LEGACY_ROLES = ['doctor', 'user', 'cmo', 'manager'];

export const ROOMS = [
  "Arrest",
  "Cardio Observations",
  "Isolation Room",
  "Room 3",
  "Room 4",
  "Surgery Observation",
  "Pediatric Observation"
];

export const PENDING_ACTIONS = [
  "Under assessment",
  "Waiting ICU",
  "Waiting CCU",
  "Waiting PICU",
  "Waiting ward",
  "Waiting referral"
];

export const WAITLIST_ACTIONS = [
  "Waiting ICU",
  "Waiting CCU",
  "Waiting PICU",
  "Waiting ward"
];

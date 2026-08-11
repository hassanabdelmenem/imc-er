/**
 * Application Configuration & Constants
 * Copyright (c) 2026 SEVENSN. All Rights Reserved.
 */

/**
 * The Firebase Auth handler this app signs in against.
 *
 * A sign-in redirect parks its pending credential in storage belonging to
 * `authDomain`. When that is a different origin from the page — the app is
 * served from `imc-er-manager.web.app`, the handler lived on
 * `imc-er-manager.firebaseapp.com` — the credential is third-party storage on
 * the way back, and browsers now routinely discard it. The redirect returns
 * with nothing, and the user is asked to sign in again.
 *
 * Pointing `authDomain` at the page's own origin removes that boundary, but it
 * is only usable on a host whose handler URL is a registered OAuth redirect URI
 * — see OAUTH_REGISTERED_HOSTS below, which is the gate that decides. Today
 * that is the canonical domain alone, so the cross-origin behaviour above is
 * still in force everywhere else and the mitigation in app.js (naming the
 * failure and offering email/password) is what carries users through it.
 */
const CANONICAL_AUTH_DOMAIN = "imc-er-manager.firebaseapp.com";

/**
 * Hosts whose `/__/auth/handler` is registered as an authorised redirect URI on
 * this project's OAuth client.
 *
 * Serving the app from a host is NOT enough. Firebase derives the OAuth
 * `redirect_uri` from `authDomain`, and Google rejects the sign-in outright
 * with `redirect_uri_mismatch` unless that exact URL is on the client's list.
 * Firebase Hosting serving `/__/auth/*` on a domain, and Firebase Auth listing
 * it under authorizedDomains, are both separate things that do not imply it.
 *
 * An earlier revision assumed any Hosting host would work and pointed
 * `authDomain` at the page origin. `imc-er-manager.web.app` is not registered,
 * so that broke Google sign-in in production; preview channels get a fresh
 * hostname per pull request and can never be pre-registered at all.
 *
 * `imc-er-manager.firebaseapp.com` is registered automatically when Firebase
 * creates the client, which is why it is the only entry here and the fallback
 * for everything else.
 *
 * To add a host — and regain the same-origin sign-in handshake on it:
 *   1. Google Cloud Console → APIs & Services → Credentials
 *   2. Open the Web client (`50161304724-8d03eb66…`)
 *   3. Authorised redirect URIs → add `https://<host>/__/auth/handler`
 *   4. Add `<host>` to this list.
 * Steps 1–3 without step 4 change nothing; step 4 without 1–3 breaks sign-in.
 */
export const OAUTH_REGISTERED_HOSTS = [CANONICAL_AUTH_DOMAIN];

/** The host the live site is served from. Checked by scripts/preflight.js. */
export const PRODUCTION_HOST = 'imc-er-manager.web.app';

export function resolveAuthDomain() {
  if (typeof window === 'undefined' || !window.location) return CANONICAL_AUTH_DOMAIN;
  const host = window.location.hostname;
  return OAUTH_REGISTERED_HOSTS.includes(host) ? host : CANONICAL_AUTH_DOMAIN;
}

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBE0tjdrlOSr3gUz2iFWnWc_Epi66jV_6A",
  authDomain: resolveAuthDomain(),
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

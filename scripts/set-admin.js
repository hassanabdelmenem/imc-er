#!/usr/bin/env node
/**
 * PROPRIETARY AND CONFIDENTIAL — Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * scripts/set-admin.js
 *
 * Assigns a staff role to a user of THIS project — imc-er-manager, and nothing
 * else. The project id is read from .firebaserc so the binding between this
 * repo and its Firebase project lives in exactly one place and cannot be
 * overridden from the command line.
 *
 * Usage:
 *   node scripts/set-admin.js <user-email-or-uid> <role>
 *
 * Roles (must stay in sync with public/js/config.js and firestore.rules):
 *   owner                     — system administrator; may assign roles
 *   medical_director          }
 *   emergency_manager         }  leadership tier: full clinical board access
 *   emergency_deputy_manager  }
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS, or ./serviceAccountKey.json /
 * ./firebase-adminsdk.json at the repo root, or Application Default
 * Credentials. Requires `npm install` (firebase-admin is a devDependency).
 *
 * ---------------------------------------------------------------------------
 * This script previously could not run at all: it used CommonJS `require` in a
 * package marked "type": "module", and firebase-admin was not a dependency. It
 * also defaulted to a Firebase project this repository does not own, and
 * searched ../../serviceAccountKey.json in the parent workspace that once held
 * this repo alongside others. Had the module error been fixed without noticing
 * the rest, the first successful run would have written Auth claims and a
 * /users/{uid} document to the wrong project.
 *
 * It also granted 'manager', which config.js lists in LEGACY_ROLES — the app
 * demotes anyone holding it to `pending` on next sign-in, so the grant would
 * have appeared to succeed and then silently evaporated.
 * ---------------------------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import admin from 'firebase-admin';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Role model mirrored from public/js/config.js. Keep these in step.
const ROLE_OWNER = 'owner';
const LEADERSHIP_ROLES = ['medical_director', 'emergency_manager', 'emergency_deputy_manager'];
const ASSIGNABLE_ROLES = [ROLE_OWNER, ...LEADERSHIP_ROLES];
const LEGACY_ROLES = ['doctor', 'user', 'cmo', 'manager'];

const usage = () => {
  console.error('Usage: node scripts/set-admin.js <user-email-or-uid> <role>');
  console.error(`Roles: ${ASSIGNABLE_ROLES.join(' | ')}`);
};

const targetUser = process.argv[2];
const role = process.argv[3]?.toLowerCase();

if (!targetUser || !role) {
  usage();
  process.exit(1);
}

if (LEGACY_ROLES.includes(role)) {
  console.error(
    `Role '${role}' was retired in the 2026 restructure (config.js LEGACY_ROLES).\n` +
      'Anyone holding it is demoted to `pending` on next sign-in, so assigning it\n' +
      'would have no lasting effect.'
  );
  usage();
  process.exit(1);
}

if (!ASSIGNABLE_ROLES.includes(role)) {
  console.error(`Unknown role: '${role}'`);
  usage();
  process.exit(1);
}

/**
 * The repo's Firebase project, from .firebaserc — the same file the Firebase
 * CLI and every workflow read. Deliberately not overridable: this script only
 * ever touches the project this repo deploys to.
 */
function resolveProjectId() {
  const rcPath = path.join(ROOT, '.firebaserc');
  if (!fs.existsSync(rcPath)) {
    console.error(`.firebaserc not found at ${rcPath} — cannot determine the target project.`);
    process.exit(1);
  }
  const projectId = JSON.parse(fs.readFileSync(rcPath, 'utf8'))?.projects?.default;
  if (!projectId) {
    console.error('.firebaserc has no projects.default — cannot determine the target project.');
    process.exit(1);
  }
  return projectId;
}

const projectId = resolveProjectId();
const appConfig = { projectId };

// Repo-local credentials only. A parent-directory path here would reach into a
// shared workspace and, with it, another project's key.
const saPaths = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.join(ROOT, 'serviceAccountKey.json'),
  path.join(ROOT, 'firebase-adminsdk.json')
].filter(Boolean);

for (const saPath of saPaths) {
  if (!fs.existsSync(saPath)) continue;
  try {
    appConfig.credential = admin.credential.cert(require(saPath));
    console.log(`Using service account credential: ${saPath}`);
    break;
  } catch (e) {
    console.warn(`Could not load service account from ${saPath}: ${e.message}`);
  }
}

if (!appConfig.credential) {
  console.log(`Using Application Default Credentials for project: ${projectId}`);
  appConfig.credential = admin.credential.applicationDefault();
}

admin.initializeApp(appConfig);

const auth = admin.auth();
const db = admin.firestore();

async function setAdminRole() {
  console.log(`Target project: ${projectId}`);

  const userRecord = targetUser.includes('@')
    ? await auth.getUserByEmail(targetUser)
    : await auth.getUser(targetUser);

  const uid = userRecord.uid;
  console.log(`Found user: ${userRecord.displayName || userRecord.email} (${uid})`);

  await auth.setCustomUserClaims(uid, { ...(userRecord.customClaims || {}), role });
  console.log(`Set Auth custom claim { role: '${role}' } on ${uid}`);

  const docData = {
    role,
    email: userRecord.email || targetUser,
    updatedAt: new Date().toISOString(),
    updatedBy: 'scripts/set-admin.js'
  };
  if (userRecord.displayName) docData.name = userRecord.displayName;

  await db.collection('users').doc(uid).set(docData, { merge: true });
  console.log(`Synced role '${role}' to /users/${uid}`);

  console.log(`\n${targetUser} now holds role '${role}' on ${projectId}.`);
}

setAdminRole()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to set role:', error.message || error);
    process.exit(1);
  });

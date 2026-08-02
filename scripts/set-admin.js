#!/usr/bin/env node
/**
 * scripts/set-admin.js
 * 
 * Sets administrative roles ('owner' or 'manager') for users across the shared Firebase/Firestore ecosystem.
 * Enforces the binary administrative role structure.
 * 
 * Usage:
 *   node scripts/set-admin.js <user-email-or-uid> <owner|manager> [project-id]
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const targetUser = process.argv[2];
const role = process.argv[3]?.toLowerCase();
const projectId = process.argv[4] || process.env.FIREBASE_PROJECT_ID || 'hospital-er-unified';

if (!targetUser || !role || !['owner', 'manager'].includes(role)) {
  console.error("❌ Invalid syntax or role specified.");
  console.error("Usage: node scripts/set-admin.js <user-email-or-uid> <owner|manager> [project-id]");
  process.exit(1);
}

let appConfig = { projectId };
const saPaths = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.join(__dirname, '../serviceAccountKey.json'),
  path.join(__dirname, '../../serviceAccountKey.json'),
  path.join(__dirname, '../firebase-adminsdk.json')
].filter(Boolean);

for (const saPath of saPaths) {
  if (fs.existsSync(saPath)) {
    try {
      const sa = require(saPath);
      appConfig.credential = admin.credential.cert(sa);
      console.log(`🔑 Using service account credential: ${saPath}`);
      break;
    } catch (e) {
      console.warn(`⚠️ Could not load service account from ${saPath}: ${e.message}`);
    }
  }
}

if (!appConfig.credential) {
  console.log(`🌐 Using Google Application Default Credentials for project: ${projectId}`);
  appConfig.credential = admin.credential.applicationDefault();
}

try {
  admin.initializeApp(appConfig);
} catch (e) {
  if (!admin.apps.length) throw e;
}

const auth = admin.auth();
const db = admin.firestore();

async function setAdminRole() {
  try {
    let userRecord;
    if (targetUser.includes('@')) {
      console.log(`🔍 Looking up user by email: ${targetUser}...`);
      userRecord = await auth.getUserByEmail(targetUser);
    } else {
      console.log(`🔍 Looking up user by UID: ${targetUser}...`);
      userRecord = await auth.getUser(targetUser);
    }

    const uid = userRecord.uid;
    console.log(`👤 Found user: ${userRecord.displayName || userRecord.email} (${uid})`);

    const currentClaims = userRecord.customClaims || {};
    const updatedClaims = { ...currentClaims, role };
    await auth.setCustomUserClaims(uid, updatedClaims);
    console.log(`✅ Successfully set Auth custom user claim { role: '${role}' } on UID: ${uid}`);

    const userDocRef = db.collection('users').doc(uid);
    const docData = {
      role,
      email: userRecord.email || targetUser,
      updatedAt: new Date().toISOString(),
      updatedBy: 'scripts/set-admin.js'
    };
    if (userRecord.displayName) {
      docData.name = userRecord.displayName;
    }

    await userDocRef.set(docData, { merge: true });
    console.log(`✅ Successfully synced role '${role}' to Firestore document /users/${uid}`);

    console.log(`\n🎉 User ${targetUser} is now recognized globally as administrative role: '${role.toUpperCase()}' across all applications!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to set administrative role:", error.message || error);
    process.exit(1);
  }
}

setAdminRole();

/**
 * Copyright (c) 2026 SEVENSN. All Rights Reserved.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  setDoc, 
  getDoc,
  writeBatch,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { FIREBASE_CONFIG, ROOMS } from "./config.js?v=20260706_02";

// Initialize Firebase SDK
const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

const secLog = (msg, err) => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.error(msg, err);
  } else {
    console.error(msg, err ? (err.code || err.message || "Security Sanitized Error") : '');
  }
};

/**
 * Authentication Service
 */
export function initAuthListener(callback) {
  return onAuthStateChanged(auth, callback);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider).catch(error => {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      return signInWithRedirect(auth, provider);
    }
    throw error;
  });
}

export function logout() {
  return signOut(auth);
}

/**
 * User Roles Management Service
 */
export async function setUserRole(userId, role) {
  const userRef = doc(db, "users", userId);
  return await setDoc(userRef, { role, lastUpdated: new Date().toISOString() }, { merge: true });
}

/**
 * Stored role for a user, or `null` when no record exists yet.
 *
 * A failed read throws rather than returning null. The two outcomes are not
 * interchangeable: `null` means "new sign-up, its access request still has to
 * be filed", while a thrown error means "we know nothing about this account".
 * Collapsing the second into the first is what let a user whose Firestore read
 * was denied or offline be shown "pending owner approval" — a queue they had
 * never been added to.
 */
export async function getUserRole(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().role) {
      return snap.data().role;
    }
    return null;
  } catch (error) {
    secLog("Error fetching user role:", error);
    throw error;
  }
}

/**
 * Make sure /users/{userId} exists and carries the fields the owner's approval
 * queue renders, then report what actually happened.
 *
 * This is the write that turns a sign-in into a visible access request, so its
 * outcome is returned instead of swallowed: if it fails, the caller must not
 * tell the user their request is awaiting approval, because no owner can see
 * a document that was never written.
 *
 * An existing record is repaired rather than skipped. A record whose first
 * write was interrupted — or that predates this write path — can be missing
 * `role` or `email`, and the owner's queue cannot act on a request with no
 * role and no address attached to it.
 *
 * @returns {Promise<{ok: boolean, created: boolean, repaired: boolean, error: Error|null}>}
 */
export async function ensureUserRecord(userId, email, role = 'pending') {
  const now = new Date().toISOString();
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: email || '',
        role: role,
        createdAt: now,
        lastUpdated: now
      }, { merge: true });
      return { ok: true, created: true, repaired: false, error: null };
    }

    const data = userSnap.data() || {};
    const patch = {};
    // Never overwrite a role the owner assigned — only fill one that is absent.
    if (!data.role) patch.role = role;
    if (!data.email && email) patch.email = email;
    if (!data.createdAt) patch.createdAt = now;

    if (Object.keys(patch).length === 0) {
      return { ok: true, created: false, repaired: false, error: null };
    }

    patch.lastUpdated = now;
    await setDoc(userRef, patch, { merge: true });
    return { ok: true, created: false, repaired: true, error: null };
  } catch (error) {
    secLog("Error writing user record:", error);
    return { ok: false, created: false, repaired: false, error };
  }
}

export async function updateUserRole(userId, role) {
  return await setUserRole(userId, role);
}

export async function deleteUserRecord(userId) {
  try {
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);
  } catch (error) {
    secLog("Error deleting user record:", error);
  }
}

export function subscribeToUsers(callback) {
  return onSnapshot(collection(db, "users"), (snapshot) => {
    const users = [];
    snapshot.forEach((docSnap) => {
      users.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(users);
  }, (error) => {
    secLog("Firestore subscribeToUsers Error:", error);
    alert("Notice: Could not load real-time users list from Firestore (" + error.message + "). Please verify Firestore Security Rules.");
  });
}

/**
 * Firestore Patient Management Service
 */
export function subscribeToPatients(callback, onError) {
  // Prevent unbounded collection scans by limiting to the most recent 1000 records.
  // Requires registrationTime index if ordering, but we can just use limit for now or order by default __name__ if no index exists.
  // Using limit(1000) alone is safe and prevents massive read costs.
  const q = query(collection(db, "patients"), limit(1000));
  return onSnapshot(q, (snapshot) => {
    const patients = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const normId = data.patientId || data.mrn || data.hospitalId || docSnap.id.substring(0, 8).toUpperCase();
      const normLoc = data.location || (ROOMS.includes(data.department) ? data.department : (ROOMS.includes(data.primaryDepartment) ? data.primaryDepartment : "Emergency Room (ER)"));
      const normDept = data.primaryDepartment || (!ROOMS.includes(data.department) && data.department ? data.department : "Internal Medicine");
      const normStatus = data.status || (data.isDischarged ? 'Discharged' : (data.pendingAction || normLoc || "Active"));
      const normTime = data.registrationTime || data.arrivalDate || data.admitDate || new Date().toISOString();

      patients.push({
        id: docSnap.id,
        ...data,
        name: data.name || "Unknown Patient",
        patientId: normId,
        mrn: normId,
        hospitalId: normId,
        location: normLoc,
        department: normDept,
        primaryDepartment: normDept,
        status: normStatus,
        pendingAction: data.pendingAction || normStatus || "Under assessment",
        isDischarged: data.isDischarged === true || normStatus === 'Discharged',
        registrationTime: normTime,
        arrivalDate: normTime,
        admitDate: normTime
      });
    });
    callback(patients);
  }, (error) => {
    secLog("Firestore subscribeToPatients Error:", error);
    if (onError) onError(error);
  });
}

export async function registerPatient(data) {
  const patientData = {
    name: data.name,
    nationalId: data.nationalId || "",
    patientId: data.patientId.toUpperCase(),
    mrn: data.patientId.toUpperCase(),
    hospitalId: data.patientId.toUpperCase(),
    location: data.location,
    department: data.primaryDepartment || data.department || "Internal Medicine",
    primaryDepartment: data.primaryDepartment || data.department || "Internal Medicine",
    status: data.location,
    registrationTime: data.registrationTime,
    arrivalDate: data.registrationTime,
    admitDate: data.registrationTime,
    pendingAction: "Under assessment",
    isDischarged: false,
    hasReferral: "",
    diagnosis: "",
    supportiveTx: "",
    sepsisWorkup: "",
    notes: [], plan: [], meds: [], labs: [], scans: [],
    lastModified: new Date().toISOString()
  };
  const batch = writeBatch(db);
  const newRef = doc(collection(db, "patients"));
  batch.set(newRef, patientData);
  try {
    await batch.commit();
  } catch (err) {
    if (window.TelemetryRUM) window.TelemetryRUM.recordFailedBatch(patientData, err, { collection: 'patients', docId: 'new_reg' });
    throw err;
  }
  return newRef;
}

export async function updatePatientRecord(patientId, updateData) {
  const patientRef = doc(db, "patients", patientId);
  const batch = writeBatch(db);
  const payload = { ...updateData, lastModified: new Date().toISOString() };
  batch.update(patientRef, payload);
  try {
    await batch.commit();
  } catch (err) {
    if (window.TelemetryRUM) window.TelemetryRUM.recordFailedBatch(payload, err, { collection: 'patients', docId: patientId });
    throw err;
  }
  return true;
}

export async function dischargePatientRecord(patientId, outcome, summaryText = null) {
  const patientRef = doc(db, "patients", patientId);
  const batch = writeBatch(db);
  const payload = {
    isDischarged: true,
    status: "Discharged",
    pendingAction: "Discharged",
    dischargeOutcome: outcome,
    dischargeTime: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  if (summaryText) {
    payload.dischargeSummary = summaryText;
  }
  batch.update(patientRef, payload);
  try {
    await batch.commit();
  } catch (err) {
    if (window.TelemetryRUM) window.TelemetryRUM.recordFailedBatch(payload, err, { collection: 'patients', docId: patientId });
    throw err;
  }
  return true;
}

export async function deletePatientRecord(patientId) {
  const patientRef = doc(db, "patients", patientId);
  try {
    return await deleteDoc(patientRef);
  } catch (err) {
    if (window.TelemetryRUM && window.TelemetryRUM.recordFailedBatch) {
      window.TelemetryRUM.recordFailedBatch({ action: 'delete_patient' }, err, { collection: 'patients', docId: patientId });
    }
    throw err;
  }
}

export async function batchDeletePatientRecords(patientIds) {
  if (!patientIds || patientIds.length === 0) return true;
  // Firestore writeBatch supports up to 500 operations per batch
  const chunks = [];
  for (let i = 0; i < patientIds.length; i += 450) {
    chunks.push(patientIds.slice(i, i + 450));
  }
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(id => {
      const patientRef = doc(db, "patients", id);
      batch.delete(patientRef);
    });
    try {
      await batch.commit();
    } catch (err) {
      if (window.TelemetryRUM && window.TelemetryRUM.recordFailedBatch) {
        window.TelemetryRUM.recordFailedBatch({ action: 'batch_delete', count: chunk.length }, err, { collection: 'patients', docId: 'batch_delete' });
      }
      throw err;
    }
  }
  return true;
}

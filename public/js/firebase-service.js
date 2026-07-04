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
  signInWithPopup 
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
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./config.js?v=20260630_19";

// Initialize Firebase SDK
const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
  return signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}

/**
 * Firestore User Management Service
 */
export async function getUserRole(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data().role;
  }
  return null;
}

export async function createUserRecord(uid, email, role = 'pending') {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, { email, role }, { merge: true });
}

export async function updateUserRole(uid, role) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { role });
}

export function subscribeToUsers(callback) {
  return onSnapshot(collection(db, "users"), (snapshot) => {
    const users = [];
    snapshot.forEach((docSnap) => {
      users.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(users);
  }, (error) => {
    console.error("Firestore subscribeToUsers Error:", error);
    alert("Notice: Could not load real-time users list from Firestore (" + error.message + "). Please verify Firestore Security Rules.");
  });
}

/**
 * Firestore Patient Management Service
 */
export function subscribeToPatients(callback) {
  return onSnapshot(collection(db, "patients"), (snapshot) => {
    const patients = [];
    snapshot.forEach((docSnap) => {
      patients.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(patients);
  });
}

export async function registerPatient(data) {
  const patientData = {
    name: data.name,
    nationalId: data.nationalId || "",
    patientId: data.patientId.toUpperCase(),
    location: data.location,
    registrationTime: data.registrationTime,
    pendingAction: "Under assessment",
    isDischarged: false,
    hasReferral: "",
    diagnosis: "",
    supportiveTx: "",
    sepsisWorkup: ""
  };
  return await addDoc(collection(db, "patients"), patientData);
}

export async function updatePatientRecord(patientId, updateData) {
  const patientRef = doc(db, "patients", patientId);
  return await updateDoc(patientRef, updateData);
}

export async function dischargePatientRecord(patientId, outcome) {
  const patientRef = doc(db, "patients", patientId);
  return await updateDoc(patientRef, {
    isDischarged: true,
    dischargeOutcome: outcome,
    dischargeTime: new Date().toISOString()
  });
}

export async function deletePatientRecord(patientId) {
  const patientRef = doc(db, "patients", patientId);
  return await deleteDoc(patientRef);
}

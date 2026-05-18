import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";

const ADMIN_CONFIGURED =
  !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
  !!process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
  process.env.FIREBASE_ADMIN_PRIVATE_KEY !== '""';

function initAdmin() {
  if (!ADMIN_CONFIGURED) throw new Error("Firebase Admin not configured");
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getApp();
}

export function getAdminDb() {
  initAdmin();
  return getFirestore();
}

export function getAdminMessaging() {
  return getMessaging(initAdmin());
}

export function getAdminAuth() {
  return getAuth(initAdmin());
}
